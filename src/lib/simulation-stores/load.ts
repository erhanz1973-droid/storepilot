import type { StoreSnapshot } from "@/lib/connectors/types";
import { buildAdSpendSnapshot } from "@/lib/ads/spend";
import { mergeDailyMetrics } from "@/lib/profit/roas";
import { mergeIntegrationIntoSnapshot } from "@/lib/integrations/engine";
import { getCachedShopifySnapshot } from "@/lib/db/shopify";
import { getMetaSyncCache } from "@/lib/db/meta-sync-cache";
import { getGoogleSyncCache } from "@/lib/db/google-sync-cache";
import { isSimulationStoreId } from "@/lib/simulation-lab/store-ids";

function mergePartials(
  shopify: Partial<StoreSnapshot> | null,
  meta: Partial<StoreSnapshot> | null,
  google: Partial<StoreSnapshot> | null,
  storeId: string,
): StoreSnapshot {
  const products = shopify?.products ?? [];
  const collections = shopify?.collections ?? [];
  const storeMetrics = shopify?.storeMetrics ?? {
    revenue30d: 0,
    orders30d: 0,
    aov30d: 0,
    conversionRate30d: 0,
  };
  const campaigns = meta?.campaigns ?? [];
  const metaAccountRollups = meta?.metaAccountRollups ?? shopify?.metaAccountRollups;
  const googleAdsSnapshot = google?.googleAdsSnapshot ?? shopify?.googleAdsSnapshot;
  const metaDailySpend = meta?.metaDailySpend ?? [];
  const googleDailySpend = google?.googleDailySpend ?? googleAdsSnapshot?.dailySpend ?? [];

  let adSpendSnapshot =
    meta?.adSpendSnapshot ??
    shopify?.adSpendSnapshot ??
    buildAdSpendSnapshot({
      metaCampaigns: campaigns,
      metaAccountRollups,
      googleRollups: googleAdsSnapshot?.rollups,
    });

  let dailyMetrics = shopify?.dailyMetrics;
  if (dailyMetrics?.length || metaDailySpend.length || googleDailySpend.length) {
    const revenueByDate = new Map<string, { revenue: number; orders: number }>();
    for (const d of dailyMetrics ?? []) {
      revenueByDate.set(d.date, { revenue: d.revenue, orders: d.orders });
    }
    const spendByDate = new Map<string, number>();
    for (const d of [...metaDailySpend, ...googleDailySpend]) {
      spendByDate.set(d.date, (spendByDate.get(d.date) ?? 0) + d.spend);
    }
    dailyMetrics = mergeDailyMetrics(revenueByDate, spendByDate);
  }

  const connectorStates = {
    shopify: "connected" as const,
    meta_ads: "connected" as const,
    google_ads: "connected" as const,
    ...(shopify?.connectorStates ?? {}),
  };

  let base: StoreSnapshot = {
    source: "connected",
    syncedAt: shopify?.syncedAt ?? new Date().toISOString(),
    commerceProvider: "shopify",
    commerceStoreDomain: shopify?.commerceStoreDomain ?? `${storeId.slice(-8)}.simulation.local`,
    products,
    collections,
    campaigns,
    storeMetrics,
    salesTrends: shopify?.salesTrends,
    profitRollups: shopify?.profitRollups,
    productOrderStats: shopify?.productOrderStats,
    attributionEvents: shopify?.attributionEvents,
    adSpendSnapshot,
    dailyMetrics,
    metaAccountRollups,
    metaDailySpend,
    googleAdsSnapshot,
    googleDailySpend,
    ga4Snapshot: shopify?.ga4Snapshot,
    connectorStates,
  };

  base = mergeIntegrationIntoSnapshot(base);
  return base;
}

/** Load a persisted simulation snapshot from Supabase sync caches. */
export async function loadSimulationSnapshot(storeId: string): Promise<StoreSnapshot | null> {
  if (!isSimulationStoreId(storeId)) return null;

  const [shopify, meta, google] = await Promise.all([
    getCachedShopifySnapshot(storeId),
    getMetaSyncCache(storeId),
    getGoogleSyncCache(storeId),
  ]);

  if (!shopify && !meta && !google) return null;
  return mergePartials(shopify, meta, google, storeId);
}

export function splitSnapshotForCaches(snapshot: StoreSnapshot): {
  shopify: Partial<StoreSnapshot>;
  meta: Partial<StoreSnapshot>;
  google: Partial<StoreSnapshot>;
} {
  const metaDailySpend =
    snapshot.metaDailySpend ??
    snapshot.campaigns.map((c, i) => ({
      date: new Date(Date.now() - (6 - (i % 7)) * 86400000).toISOString().slice(0, 10),
      spend: Math.round((c.spend7d / 7) * 100) / 100,
    }));

  return {
    shopify: {
      source: "connected",
      syncedAt: snapshot.syncedAt,
      commerceProvider: snapshot.commerceProvider,
      commerceStoreDomain: snapshot.commerceStoreDomain,
      products: snapshot.products,
      collections: snapshot.collections,
      storeMetrics: snapshot.storeMetrics,
      salesTrends: snapshot.salesTrends,
      profitRollups: snapshot.profitRollups,
      productOrderStats: snapshot.productOrderStats,
      attributionEvents: snapshot.attributionEvents,
      dailyMetrics: snapshot.dailyMetrics,
      ga4Snapshot: snapshot.ga4Snapshot,
      connectorStates: {
        shopify: "connected",
        meta_ads: "connected",
        google_ads: "connected",
      },
    },
    meta: {
      campaigns: snapshot.campaigns,
      metaAccountRollups: snapshot.metaAccountRollups,
      metaDailySpend,
      adSpendSnapshot: snapshot.adSpendSnapshot,
    },
    google: {
      googleAdsSnapshot: snapshot.googleAdsSnapshot,
      googleDailySpend: snapshot.googleAdsSnapshot?.dailySpend ?? snapshot.googleDailySpend,
      adSpendSnapshot: snapshot.adSpendSnapshot,
    },
  };
}
