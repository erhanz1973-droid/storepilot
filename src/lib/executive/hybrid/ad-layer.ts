import { buildAdSpendSnapshot } from "@/lib/ads/spend";
import { mergeDailyMetrics } from "@/lib/profit/roas";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { GA4Snapshot } from "@/lib/integrations/types";
import { getGa4SyncCache } from "@/lib/db/ga4";
import { hasActiveGa4Installation } from "@/lib/db/ga4";
import { hasActiveGoogleAdsInstallations } from "@/lib/db/google-ads";
import { getGoogleSyncCache } from "@/lib/db/google-sync-cache";
import { hasActiveMetaAdsInstallations } from "@/lib/db/meta-ads";
import { getMetaSyncCache } from "@/lib/db/meta-sync-cache";
import { SIMULATION_STORE_BY_SLUG } from "@/lib/simulation-lab/store-ids";
import { mayUseSyntheticData } from "@/lib/trust/data-mode";
import { isAlpineOutfittersSnapshot } from "@/lib/demo/alpine-outfitters";
import {
  buildMetricLabels,
  GA4_SIMULATION_LABEL,
  GOOGLE_SIMULATION_LABEL,
  LIVE_GA4_LABEL,
  LIVE_GOOGLE_LABEL,
  LIVE_META_LABEL,
  META_SIMULATION_LABEL,
  type HybridDataSources,
} from "./types";

const SIMULATION_ADS_STORE_ID = SIMULATION_STORE_BY_SLUG.simulation_roas;

export type AdvertisingLayer = {
  partial: Partial<StoreSnapshot>;
  sources: HybridDataSources;
};

function mergeAdPartials(
  shopify: StoreSnapshot,
  meta: Partial<StoreSnapshot> | null,
  google: Partial<StoreSnapshot> | null,
  ga4Snapshot: GA4Snapshot | null | undefined,
  connectorStates: StoreSnapshot["connectorStates"],
): Partial<StoreSnapshot> {
  const campaigns = meta?.campaigns ?? [];
  const metaAccountRollups = meta?.metaAccountRollups;
  const googleAdsSnapshot = google?.googleAdsSnapshot;
  const metaDailySpend = meta?.metaDailySpend ?? [];
  const googleDailySpend =
    google?.googleDailySpend ?? googleAdsSnapshot?.dailySpend ?? [];

  const adSpendSnapshot = buildAdSpendSnapshot({
    metaCampaigns: campaigns,
    metaAccountRollups,
    googleRollups: googleAdsSnapshot?.rollups,
  });

  let dailyMetrics = shopify.dailyMetrics;
  if (shopify.dailyMetrics?.length || metaDailySpend.length || googleDailySpend.length) {
    const revenueByDate = new Map<string, { revenue: number; orders: number }>();
    for (const d of shopify.dailyMetrics ?? []) {
      revenueByDate.set(d.date, { revenue: d.revenue, orders: d.orders });
    }
    const spendByDate = new Map<string, number>();
    for (const d of [...metaDailySpend, ...googleDailySpend]) {
      spendByDate.set(d.date, (spendByDate.get(d.date) ?? 0) + d.spend);
    }
    dailyMetrics = mergeDailyMetrics(revenueByDate, spendByDate);
  }

  return {
    campaigns,
    metaAccountRollups,
    metaDailySpend,
    googleAdsSnapshot,
    googleDailySpend,
    adSpendSnapshot,
    dailyMetrics,
    ga4Snapshot: ga4Snapshot ?? undefined,
    connectorStates,
  };
}

/** Resolve Meta / Google / GA4 — live cache when connected; simulation only in demo/dev contexts. */
export async function loadHybridAdvertisingLayer(
  storeId: string,
  shopifySnapshot: StoreSnapshot,
): Promise<AdvertisingLayer> {
  /** Alpine Demo Provider owns ads — never inject simulation_roas leftovers */
  const allowSimulation =
    mayUseSyntheticData(storeId, shopifySnapshot) &&
    !isAlpineOutfittersSnapshot(shopifySnapshot);

  const [hasMeta, hasGoogle, hasGa4] = await Promise.all([
    hasActiveMetaAdsInstallations(storeId),
    hasActiveGoogleAdsInstallations(storeId),
    hasActiveGa4Installation(storeId),
  ]);

  let metaPartial: Partial<StoreSnapshot> | null = null;
  let metaMode: HybridDataSources["meta"]["mode"] = "hidden";
  let metaLabel = META_SIMULATION_LABEL;

  if (hasMeta) {
    metaPartial = await getMetaSyncCache(storeId);
    if (metaPartial?.campaigns?.length || metaPartial?.metaAccountRollups) {
      metaMode = "live";
      metaLabel = LIVE_META_LABEL;
    }
  }
  if (!metaPartial?.campaigns?.length && allowSimulation) {
    metaPartial = await getMetaSyncCache(SIMULATION_ADS_STORE_ID);
    if (metaPartial?.campaigns?.length) {
      metaMode = "simulation";
      metaLabel = META_SIMULATION_LABEL;
    }
  }

  let googlePartial: Partial<StoreSnapshot> | null = null;
  let googleMode: HybridDataSources["google"]["mode"] = "hidden";
  let googleLabel = GOOGLE_SIMULATION_LABEL;

  if (hasGoogle) {
    googlePartial = await getGoogleSyncCache(storeId);
    if (googlePartial?.googleAdsSnapshot?.campaigns?.length) {
      googleMode = "live";
      googleLabel = LIVE_GOOGLE_LABEL;
    }
  }
  if (!googlePartial?.googleAdsSnapshot?.campaigns?.length && allowSimulation) {
    googlePartial = await getGoogleSyncCache(SIMULATION_ADS_STORE_ID);
    if (googlePartial?.googleAdsSnapshot?.campaigns?.length) {
      googleMode = "simulation";
      googleLabel = GOOGLE_SIMULATION_LABEL;
    }
  }

  let ga4Snapshot: GA4Snapshot | null = null;
  let ga4Mode: HybridDataSources["ga4"]["mode"] = "hidden";
  let ga4Label = GA4_SIMULATION_LABEL;

  if (hasGa4) {
    ga4Snapshot = await getGa4SyncCache(storeId);
    if (ga4Snapshot?.sessions30d) {
      ga4Mode = "live";
      ga4Label = LIVE_GA4_LABEL;
    }
  }
  if (!ga4Snapshot?.sessions30d && allowSimulation) {
    ga4Snapshot = await getGa4SyncCache(SIMULATION_ADS_STORE_ID);
    if (ga4Snapshot?.sessions30d) {
      ga4Mode = "simulation";
      ga4Label = GA4_SIMULATION_LABEL;
    } else {
      ga4Snapshot = null;
      ga4Mode = "hidden";
    }
  }

  const connectorStates: StoreSnapshot["connectorStates"] = {
    shopify: "connected",
    meta_ads:
      metaMode === "live" ? "connected" : metaMode === "simulation" ? "demo" : "disconnected",
    google_ads:
      googleMode === "live" ? "connected" : googleMode === "simulation" ? "demo" : "disconnected",
  };

  const sources: HybridDataSources = {
    shopify: { mode: "live", label: "Live Shopify" },
    meta: { mode: metaMode, label: metaLabel },
    google: { mode: googleMode, label: googleLabel },
    ga4: { mode: ga4Mode, label: ga4Mode === "hidden" ? "Unavailable" : ga4Label },
    metricLabels: {},
    adsSimulated: metaMode === "simulation" || googleMode === "simulation",
  };
  sources.metricLabels = buildMetricLabels(sources);

  const partial = mergeAdPartials(
    shopifySnapshot,
    metaPartial,
    googlePartial,
    ga4Snapshot,
    connectorStates,
  );

  return { partial, sources };
}

export function applyAdvertisingLayer(
  shopifySnapshot: StoreSnapshot,
  layer: AdvertisingLayer,
): StoreSnapshot {
  return {
    ...shopifySnapshot,
    ...layer.partial,
    connectorStates: layer.partial.connectorStates ?? shopifySnapshot.connectorStates,
  };
}
