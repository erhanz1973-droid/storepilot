import {
  getInstallationByStoreId,
  getInstallationByShopDomain,
} from "@/lib/db/shopify";
import {
  ensureShopifySyncIfNeeded,
  type EnsureShopifySyncResult,
} from "@/lib/shopify/ensure-sync.server";

type ShopifyInstallationWithToken = NonNullable<
  Awaited<ReturnType<typeof getInstallationByStoreId>>
>;

export type ShopifyInstallationLookupResult =
  | { state: "installation_found"; installation: ShopifyInstallationWithToken }
  | { state: "installation_not_found"; installation: null }
  | { state: "installation_lookup_failed"; installation: null; error: string };

export async function lookupShopifyInstallation(input: {
  storeId?: string;
  shopDomain?: string;
}): Promise<ShopifyInstallationLookupResult> {
  try {
    const installation = input.storeId
      ? await getInstallationByStoreId(input.storeId)
      : input.shopDomain
        ? await getInstallationByShopDomain(input.shopDomain)
        : null;

    return installation
      ? { state: "installation_found", installation }
      : { state: "installation_not_found", installation: null };
  } catch (error) {
    return {
      state: "installation_lookup_failed",
      installation: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

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
}): Promise<
  | EnsureShopifySyncResult
  | { synced: false; skipped: true; reason: "installation_not_found" }
  | { synced: false; skipped: false; reason: "installation_lookup_failed"; error: string }
> {
  const lookup = await lookupShopifyInstallation(input);

  if (lookup.state !== "installation_found") {
    console.log(
      "[shopify-sync]",
      JSON.stringify({
        event: "resync_skipped",
        source: input.source,
        reason: lookup.state,
        storeId: input.storeId ?? null,
        shopDomain: input.shopDomain ?? null,
        error: lookup.state === "installation_lookup_failed" ? lookup.error : undefined,
      }),
    );
    return lookup.state === "installation_lookup_failed"
      ? {
          synced: false,
          skipped: false,
          reason: "installation_lookup_failed",
          error: lookup.error,
        }
      : { synced: false, skipped: true, reason: "installation_not_found" };
  }

  const installation = lookup.installation;
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
