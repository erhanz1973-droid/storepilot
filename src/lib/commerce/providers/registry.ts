import type { CommercePlatformId } from "../types";
import type { CommerceProviderAdapter } from "../provider";
import { shopifyCommerceProvider } from "./shopify";

/** Live commerce provider adapters — add Amazon, WooCommerce, etc. as they ship. */
export const COMMERCE_PROVIDER_ADAPTERS: Partial<
  Record<CommercePlatformId, CommerceProviderAdapter>
> = {
  shopify: shopifyCommerceProvider,
};

export function getCommerceProvider(platform: CommercePlatformId): CommerceProviderAdapter | null {
  return COMMERCE_PROVIDER_ADAPTERS[platform] ?? null;
}

export function listConfiguredCommerceProviders(): CommerceProviderAdapter[] {
  return Object.values(COMMERCE_PROVIDER_ADAPTERS).filter(
    (p): p is CommerceProviderAdapter => p != null && p.isConfigured(),
  );
}

/**
 * Resolve the active commerce provider for a store.
 * Today: Shopify or demo. Future: check installation records per platform.
 */
export async function resolveActiveCommerceProvider(
  storeId: string,
): Promise<CommerceProviderAdapter | null> {
  const shopifyStatus = await shopifyCommerceProvider.getStatus(storeId);
  if (shopifyStatus.status === "connected" || shopifyStatus.status === "demo") {
    return shopifyCommerceProvider;
  }

  for (const provider of Object.values(COMMERCE_PROVIDER_ADAPTERS)) {
    if (!provider || provider.platform === "shopify") continue;
    const status = await provider.getStatus(storeId);
    if (status.status === "connected" || status.status === "demo") {
      return provider;
    }
  }

  return shopifyCommerceProvider;
}
