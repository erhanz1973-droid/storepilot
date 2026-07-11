import { headers } from "next/headers";
import { getInstallationByShopDomain } from "@/lib/db/shopify";

/** Resolve store from embedded ?shop= param (set by middleware) when no cookie is present. */
export async function resolveEmbeddedShopDomain(): Promise<string | null> {
  const headerStore = await headers();
  const fromHeader = headerStore.get("x-storepilot-shop-domain")?.trim().toLowerCase();
  if (!fromHeader) return null;
  return fromHeader.includes(".") ? fromHeader : `${fromHeader}.myshopify.com`;
}

export async function resolveStoreIdForEmbeddedShop(): Promise<string | null> {
  const shopDomain = await resolveEmbeddedShopDomain();
  if (!shopDomain) return null;
  const installation = await getInstallationByShopDomain(shopDomain);
  return installation?.store_id ?? null;
}
