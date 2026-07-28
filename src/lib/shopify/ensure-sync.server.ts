import {
  getCachedShopifySnapshot,
  getInstallationForStore,
  updateShopifySyncResult,
} from "@/lib/db/shopify";
import { isShopifyReinstallRequiredError } from "@/lib/shopify/auth-errors";
import { syncShopifyStore } from "@/lib/shopify/sync";

const DEFAULT_STALE_MS = 60 * 60 * 1000; // 1 hour

export type EnsureShopifySyncResult = {
  synced: boolean;
  skipped: boolean;
  reason: string;
  products?: number;
  orders30d?: number;
};

function hasUsableSnapshot(snapshot: Awaited<ReturnType<typeof getCachedShopifySnapshot>>): boolean {
  if (!snapshot) return false;
  if ((snapshot.products?.length ?? 0) > 0) return true;
  if (snapshot.storeMetrics && typeof snapshot.storeMetrics.orders30d === "number") return true;
  if (snapshot.syncedAt) return true;
  return false;
}

/**
 * Runs GraphQL sync when the store has never synced, cache is empty, or data is stale.
 * Used by embedded bootstrap so App Review revisits still populate shopify_sync_cache
 * even when afterAuth does not re-fire.
 */
export async function ensureShopifySyncIfNeeded(input: {
  shop: string;
  accessToken: string;
  storeId: string;
  source: string;
  storedClientId?: string | null;
  installationId?: string | null;
  refreshToken?: string | null;
  /** Force sync even when cache looks fresh. */
  force?: boolean;
  staleAfterMs?: number;
}): Promise<EnsureShopifySyncResult> {
  const staleAfterMs = input.staleAfterMs ?? DEFAULT_STALE_MS;
  const installation = await getInstallationForStore(input.storeId);
  const cached = await getCachedShopifySnapshot(input.storeId);
  const lastSyncAt = installation?.last_sync_at ?? null;
  const lastSyncMs = lastSyncAt ? Date.parse(lastSyncAt) : NaN;
  const isFresh =
    Number.isFinite(lastSyncMs) && Date.now() - lastSyncMs < staleAfterMs && hasUsableSnapshot(cached);

  if (!input.force && isFresh) {
    console.log(
      "[shopify-sync]",
      JSON.stringify({
        event: "ensure_sync_skipped",
        source: input.source,
        shop: input.shop,
        storeId: input.storeId,
        lastSyncAt,
        reason: "fresh_cache",
      }),
    );
    return { synced: false, skipped: true, reason: "fresh_cache" };
  }

  console.log(
    "[shopify-sync]",
    JSON.stringify({
      event: "ensure_sync_start",
      source: input.source,
      shop: input.shop,
      storeId: input.storeId,
      lastSyncAt,
      force: Boolean(input.force),
      hasCache: hasUsableSnapshot(cached),
    }),
  );

  try {
    const syncResult = await syncShopifyStore(input.shop, input.accessToken, {
      storedClientId: input.storedClientId,
      installationId: input.installationId ?? installation?.id ?? null,
      refreshToken: input.refreshToken ?? installation?.refreshToken ?? null,
    });

    await updateShopifySyncResult(input.storeId, syncResult.stats, syncResult.snapshot, {
      shopName: syncResult.shopName,
      shopifyPlan: syncResult.shopifyPlan,
    });

    const products = syncResult.snapshot.products?.length ?? syncResult.stats.productCount;
    const orders30d = syncResult.snapshot.storeMetrics?.orders30d ?? syncResult.stats.orderCount;

    console.log(
      "[shopify-sync]",
      JSON.stringify({
        event: "ensure_sync_complete",
        source: input.source,
        shop: input.shop,
        storeId: input.storeId,
        products,
        orders30d,
        shopName: syncResult.shopName,
      }),
    );

    return {
      synced: true,
      skipped: false,
      reason: "synced",
      products,
      orders30d,
    };
  } catch (error) {
    if (isShopifyReinstallRequiredError(error)) {
      console.error("[shopify-sync] ensure_sync reinstall required", {
        source: input.source,
        shop: input.shop,
        storeId: input.storeId,
        reason: error.reason,
      });
      return { synced: false, skipped: false, reason: `reinstall_required:${error.reason}` };
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error("[shopify-sync] ensure_sync failed", {
      source: input.source,
      shop: input.shop,
      storeId: input.storeId,
      message,
    });

    try {
      await updateShopifySyncResult(
        input.storeId,
        installation?.sync_stats ?? {
          productCount: 0,
          inventoryCount: 0,
          orderCount: 0,
          customerCount: 0,
          collectionCount: 0,
          discountCount: 0,
        },
        {},
        { error: message },
      );
    } catch (persistError) {
      console.error("[shopify-sync] failed to persist sync error state", {
        shop: input.shop,
        message: persistError instanceof Error ? persistError.message : String(persistError),
      });
    }

    return { synced: false, skipped: false, reason: `failed:${message}` };
  }
}
