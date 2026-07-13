import { cookies, headers } from "next/headers";
import { getActiveStoreIdForShopDomain } from "@/lib/db/shopify";
import { isShopifyReinstallRequiredError } from "@/lib/shopify/auth-errors";
import { EMBEDDED_SHOP_COOKIE } from "@/lib/store/embedded-shop";

export type EmbeddedBootstrapDiagnostics = {
  shopDomain: string | null;
  shopSource: "header" | "cookie" | null;
  storeId: string | null;
  installationFound: boolean;
};

/** Resolve shop domain from middleware header or embedded shop cookie. */
export async function resolveEmbeddedShopDomain(): Promise<string | null> {
  const headerStore = await headers();
  const fromHeader = headerStore.get("x-storepilot-shop-domain")?.trim().toLowerCase();
  if (fromHeader) {
    return fromHeader.includes(".") ? fromHeader : `${fromHeader}.myshopify.com`;
  }

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(EMBEDDED_SHOP_COOKIE)?.value?.trim().toLowerCase();
  if (!fromCookie) return null;
  return fromCookie.includes(".") ? fromCookie : `${fromCookie}.myshopify.com`;
}

export async function readEmbeddedBootstrapDiagnostics(): Promise<EmbeddedBootstrapDiagnostics> {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const fromHeader = headerStore.get("x-storepilot-shop-domain");
  const fromCookie = cookieStore.get(EMBEDDED_SHOP_COOKIE)?.value;

  let shopDomain: string | null = null;
  let shopSource: EmbeddedBootstrapDiagnostics["shopSource"] = null;

  if (fromHeader) {
    shopDomain = fromHeader.includes(".") ? fromHeader : `${fromHeader}.myshopify.com`;
    shopSource = "header";
  } else if (fromCookie) {
    shopDomain = fromCookie.includes(".") ? fromCookie : `${fromCookie}.myshopify.com`;
    shopSource = "cookie";
  }

  if (!shopDomain) {
    return { shopDomain: null, shopSource: null, storeId: null, installationFound: false };
  }

  const storeId = await getActiveStoreIdForShopDomain(shopDomain);
  return {
    shopDomain,
    shopSource,
    storeId,
    installationFound: storeId != null,
  };
}

export function logEmbeddedBootstrap(phase: string, diagnostics: EmbeddedBootstrapDiagnostics): void {
  console.log(
    "[embedded-bootstrap]",
    JSON.stringify({
      phase,
      ...diagnostics,
    }),
  );
}

/**
 * Resolve merchant store id from embedded Shopify context.
 * Uses metadata-only lookup so tenant selection never depends on token decryption.
 */
export async function resolveStoreIdForEmbeddedShop(): Promise<string | null> {
  const diagnostics = await readEmbeddedBootstrapDiagnostics();
  logEmbeddedBootstrap("resolve store", diagnostics);

  if (!diagnostics.shopDomain) return null;

  try {
    return await getActiveStoreIdForShopDomain(diagnostics.shopDomain);
  } catch (error) {
    if (isShopifyReinstallRequiredError(error)) {
      console.error("[embedded-bootstrap] installation requires reinstall", {
        shopDomain: diagnostics.shopDomain,
        reason: error.reason,
      });
      return null;
    }
    throw error;
  }
}
