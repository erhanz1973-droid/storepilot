import {
  getGa4AccessToken,
  getGa4SyncCache,
  listGa4Installations,
  markGa4InstallationSyncError,
  markGa4InstallationSyncHealthy,
  saveGa4SyncCache,
  touchGa4Sync,
} from "@/lib/db/ga4";
import { getCachedShopifySnapshot } from "@/lib/db/shopify";
import { fetchGa4Snapshot } from "@/lib/ga4/sync";
import type { GA4Snapshot } from "@/lib/integrations/types";

/** Re-sync when cache is older than this (default: 4 hours). */
export const GA4_SYNC_STALE_MS = 4 * 60 * 60 * 1000;

export async function resolveShopifyOrders30d(storeId: string): Promise<number | undefined> {
  const shopify = await getCachedShopifySnapshot(storeId);
  const orders = shopify?.storeMetrics?.orders30d;
  return orders != null && orders > 0 ? orders : undefined;
}

export function isGa4SnapshotStale(
  lastSyncAt: string | null | undefined,
  staleMs = GA4_SYNC_STALE_MS,
): boolean {
  if (!lastSyncAt) return true;
  return Date.now() - new Date(lastSyncAt).getTime() > staleMs;
}

export async function syncGa4ForStore(
  storeId: string,
  shopifyOrders30d?: number,
): Promise<{ ga4Snapshot: GA4Snapshot }> {
  const installs = await listGa4Installations(storeId);
  if (installs.length === 0) {
    throw new Error("No GA4 property connected");
  }

  const install = installs[0];
  const orders =
    shopifyOrders30d ?? (await resolveShopifyOrders30d(storeId));

  try {
    const accessToken = await getGa4AccessToken(install);
    const ga4Snapshot = await fetchGa4Snapshot(accessToken, install.property_id, orders);

    await saveGa4SyncCache(storeId, ga4Snapshot);
    await touchGa4Sync(install.id);
    await markGa4InstallationSyncHealthy(install.id, {
      sessions30d: ga4Snapshot.sessions30d,
      funnelVerified: ga4Snapshot.funnelEvents?.verified ?? false,
    });

    return { ga4Snapshot };
  } catch (err) {
    const message = err instanceof Error ? err.message : "GA4 sync failed";
    await markGa4InstallationSyncError(install.id, message);
    throw err;
  }
}

export async function loadGa4SnapshotFromCache(storeId: string): Promise<GA4Snapshot | null> {
  return getGa4SyncCache(storeId);
}

export async function syncGa4IfStale(storeId: string): Promise<{ ga4Snapshot: GA4Snapshot } | null> {
  const installs = await listGa4Installations(storeId);
  if (installs.length === 0) return null;

  const install = installs[0];
  const cached = await loadGa4SnapshotFromCache(storeId);
  if (cached && !isGa4SnapshotStale(install.last_sync_at)) {
    return { ga4Snapshot: cached };
  }

  return syncGa4ForStore(storeId);
}
