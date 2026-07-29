import { headers } from "next/headers";
import { getActiveStoreIdForShopDomain } from "@/lib/db/shopify";
import { isShopifyReinstallRequiredError } from "@/lib/shopify/auth-errors";
import {
  AUTHENTICATED_FLAG_HEADER,
  AUTHENTICATED_SHOP_HEADER,
} from "@/lib/api/route-auth";
import { normalizeShopDomain } from "@/lib/store/embedded-shop";

export type EmbeddedBootstrapDiagnostics = {
  shopDomain: string | null;
  /**
   * Diagnostic-only origin of a shop string.
   * - `authenticated_header`: middleware-verified Shopify session shop
   * - `unverified_request_hint`: pre-auth ?shop= / host / request metadata (logging only — never tenant identity)
   */
  shopSource: "authenticated_header" | "unverified_request_hint" | null;
  storeId: string | null;
  installationFound: boolean;
};

/**
 * Resolve shop domain from verified tenant signals only.
 * Never reads ?shop=, host, EMBEDDED_SHOP_COOKIE, or unverified x-storepilot-shop-domain.
 */
export async function resolveEmbeddedShopDomain(): Promise<string | null> {
  const headerStore = await headers();
  const authFlag = headerStore.get(AUTHENTICATED_FLAG_HEADER);
  if (authFlag === "1") {
    const fromAuth = normalizeShopDomain(headerStore.get(AUTHENTICATED_SHOP_HEADER));
    if (fromAuth) return fromAuth;
  }

  return null;
}

export async function readEmbeddedBootstrapDiagnostics(): Promise<EmbeddedBootstrapDiagnostics> {
  const headerStore = await headers();
  const authFlag = headerStore.get(AUTHENTICATED_FLAG_HEADER);
  const authenticatedShop =
    authFlag === "1"
      ? normalizeShopDomain(headerStore.get(AUTHENTICATED_SHOP_HEADER))
      : null;

  if (authenticatedShop) {
    const storeId = await getActiveStoreIdForShopDomain(authenticatedShop);
    return {
      shopDomain: authenticatedShop,
      shopSource: "authenticated_header",
      storeId,
      installationFound: storeId != null,
    };
  }

  return { shopDomain: null, shopSource: null, storeId: null, installationFound: false };
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
 * Resolve merchant store id from verified embedded Shopify context only.
 */
export async function resolveStoreIdForEmbeddedShop(): Promise<string | null> {
  const diagnostics = await readEmbeddedBootstrapDiagnostics();
  logEmbeddedBootstrap("resolve store", diagnostics);

  if (!diagnostics.shopDomain) return null;

  try {
    if (diagnostics.storeId) return diagnostics.storeId;
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
