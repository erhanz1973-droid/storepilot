import { aggregateStoreSnapshot } from "@/lib/connectors/registry";
import { normalizeCommerceSnapshot } from "@/lib/commerce/normalize";
import { COMMERCE_PLATFORMS } from "@/lib/commerce/registry";
import type { CommercePlatformDefinition, NormalizedCommerceSnapshot } from "@/lib/commerce/types";
import { getConnectionsView } from "@/lib/services/connections";
import { resolveActiveStoreId } from "@/lib/store/context";

export type CommerceStoreRow = {
  platform: CommercePlatformDefinition;
  connected: boolean;
  storeDomain: string | null;
  lastSyncAt: string | null;
  products: number;
  orders30d: number;
  revenue30d: number;
};

export type CommerceWorkspace = {
  commerce: NormalizedCommerceSnapshot;
  stores: CommerceStoreRow[];
  syncedAt: string;
};

export async function buildCommerceWorkspace(): Promise<CommerceWorkspace | null> {
  const storeId = await resolveActiveStoreId();
  const [snapshot, view] = await Promise.all([
    aggregateStoreSnapshot(storeId),
    getConnectionsView(),
  ]);

  const commerce = normalizeCommerceSnapshot(snapshot, {
    storeDomain: view.commerceDomain ?? undefined,
  });

  if (!commerce.isLive && !view.isDemo) {
    return null;
  }

  const stores: CommerceStoreRow[] = COMMERCE_PLATFORMS.map((platform) => {
    const isActivePlatform = commerce.platform === platform.id;
    const connected =
      platform.id === "shopify"
        ? view.commerceConnected || view.isDemo
        : isActivePlatform && commerce.isLive;

    return {
      platform,
      connected,
      storeDomain: connected && isActivePlatform ? commerce.storeDomain ?? null : null,
      lastSyncAt: connected && isActivePlatform ? commerce.syncedAt : null,
      products: connected && isActivePlatform ? commerce.products.length : 0,
      orders30d: connected && isActivePlatform ? commerce.metrics.orders30d : 0,
      revenue30d: connected && isActivePlatform ? commerce.metrics.revenue30d : 0,
    };
  });

  return {
    commerce,
    stores,
    syncedAt: commerce.syncedAt,
  };
}
