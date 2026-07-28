import {
  getInstallationByStoreId,
  getInstallationByShopDomain,
} from "@/lib/db/shopify";
import {
  ensureShopifySyncIfNeeded,
  type EnsureShopifySyncResult,
} from "@/lib/shopify/ensure-sync.server";

/**
 * Force (or ensure) a Shopify commerce sync for a store id / shop domain.
 * Used by first-run Retry Analysis and order webhooks so new orders appear
 * without manual DB intervention.
 */
export async function resyncShopifyCommerce(input: {
  storeId?: string;
  shopDomain?: string;
  source: string;
  force?: boolean;
  staleAfterMs?: number;
}): Promise<EnsureShopifySyncResult | { synced: false; skipped: true; reason: string }> {
  const installation = input.storeId
    ? await getInstallationByStoreId(input.storeId)
    : input.shopDomain
      ? await getInstallationByShopDomain(input.shopDomain)
      : null;

  if (!installation) {
    console.log(
      "[shopify-sync]",
      JSON.stringify({
        event: "resync_skipped",
        source: input.source,
        reason: "no_installation",
        storeId: input.storeId ?? null,
        shopDomain: input.shopDomain ?? null,
      }),
    );
    return { synced: false, skipped: true, reason: "no_installation" };
  }

  return ensureShopifySyncIfNeeded({
    shop: installation.shop_domain,
    accessToken: installation.accessToken,
    storeId: installation.store_id,
    source: input.source,
    storedClientId: installation.clientId,
    installationId: installation.id,
    refreshToken: installation.refreshToken,
    force: input.force ?? true,
    staleAfterMs: input.staleAfterMs,
  });
}
