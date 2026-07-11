import type { AdSpendRollups } from "@/lib/ads/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import {
  buildScenarioIntegrationSnapshot,
  isScenarioAwareDemoSnapshot,
} from "@/lib/demo/scenario-integrations";
import { emptyAdSpendRollups } from "@/lib/ads/spend";
import { PEAK_OUTFITTERS } from "@/lib/demo/peak-outfitters/constants";
import { peakOutfittersGoogleAdsSnapshot } from "@/lib/demo/peak-outfitters/google-campaigns";
import { peakOutfittersGA4Snapshot } from "@/lib/demo/peak-outfitters/ga4";
import type {
  AccountingSnapshot,
  GA4Snapshot,
  GoogleAdsSnapshot,
  InventoryPlatformSnapshot,
  KlaviyoSnapshot,
  MetaCapiStatus,
  OperationalCosts,
  ShippingSnapshot,
  SupportSnapshot,
  TikTokAdsSnapshot,
  WarehouseSnapshot,
} from "./types";

function rollupsFromWeekly(spend7d: number, rev7d: number): AdSpendRollups {
  const daily = spend7d / 7;
  const revDaily = rev7d / 7;
  const bucket = (days: number) => ({
    spend: Math.round(daily * days * 100) / 100,
    attributedRevenue: Math.round(revDaily * days * 100) / 100,
    orders: 0,
  });
  return {
    today: bucket(1),
    yesterday: bucket(1),
    last7d: bucket(7),
    last30d: bucket(30),
  };
}

export function demoGoogleAdsSnapshot(): GoogleAdsSnapshot {
  return peakOutfittersGoogleAdsSnapshot();
}

export function demoTikTokAdsSnapshot(): TikTokAdsSnapshot {
  const spend7d = 980;
  const rev7d = 2_140;
  return {
    campaigns: [
      {
        id: "tt-camp-1",
        name: "Spark Ads — Trail UGC",
        spend7d: 620,
        revenue7d: 1_480,
        roas7d: 2.39,
        impressions7d: 185_000,
        clicks7d: 4_200,
        conversions7d: 38,
      },
      {
        id: "tt-camp-2",
        name: "Prospecting — Day Hike Gear",
        spend7d: 360,
        revenue7d: 660,
        roas7d: 1.83,
        impressions7d: 92_000,
        clicks7d: 1_800,
        conversions7d: 18,
      },
    ],
    adGroups: [
      { id: "tt-ag-1", campaignId: "tt-camp-1", name: "Outdoor Enthusiasts 25-44", spend7d: 620 },
      { id: "tt-ag-2", campaignId: "tt-camp-2", name: "US Hiking Interest", spend7d: 360 },
    ],
    creatives: [
      { id: "tt-cr-1", campaignId: "tt-camp-1", name: "UGC — Summit Pack Review", spend7d: 380, revenue7d: 920, roas7d: 2.42, ctr7d: 2.3 },
      { id: "tt-cr-2", campaignId: "tt-camp-2", name: "Day Hike Essentials Hook", spend7d: 360, revenue7d: 660, roas7d: 1.83, ctr7d: 1.9 },
    ],
    rollups: rollupsFromWeekly(spend7d, rev7d),
    dailySpend: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
      spend: Math.round((spend7d / 7) * (0.9 + (i % 4) * 0.03) * 100) / 100,
    })),
  };
}

export function demoKlaviyoSnapshot(): KlaviyoSnapshot {
  return {
    campaignRevenue30d: 4280,
    flowRevenue30d: 6120,
    emailAttributedRevenue30d: 8940,
    smsAttributedRevenue30d: 1460,
    orders30d: 186,
    rollups: {
      today: { spend: 0, attributedRevenue: 280, orders: 4 },
      yesterday: { spend: 0, attributedRevenue: 310, orders: 5 },
      last7d: { spend: 0, attributedRevenue: 2180, orders: 38 },
      last30d: { spend: 420, attributedRevenue: 10400, orders: 186 },
    },
  };
}

export function demoGA4Snapshot(): GA4Snapshot {
  return peakOutfittersGA4Snapshot();
}

export function demoMetaCapiStatus(): MetaCapiStatus {
  return {
    enabled: true,
    eventsReceived30d: 4_820,
    matchRatePct: 89,
    events: {
      purchase: PEAK_OUTFITTERS.orders30d,
      addToCart: 1_240,
      initiateCheckout: 890,
      viewContent: 3_420,
    },
  };
}

export function demoInventorySnapshot(): InventoryPlatformSnapshot {
  return {
    platform: "stocky",
    skuCount: 30,
    unitsOnHand: 4_280,
    lowStockSkus: PEAK_OUTFITTERS.inventory.lowStock,
    liveSync: true,
  };
}

export function demoAccountingSnapshot(orders30d: number): AccountingSnapshot {
  return {
    provider: "quickbooks",
    actualCogs30d: Math.round(PEAK_OUTFITTERS.revenue30d * 0.42),
    operatingExpenses30d: 8_400,
    liveSync: true,
  };
}

export function demoShippingSnapshot(orders30d: number): ShippingSnapshot {
  return {
    provider: "shipstation",
    shippingCost30d: Math.round(orders30d * 6.85),
    costPerOrder: 6.85,
    orders30d,
    liveSync: true,
  };
}

export function demoSupportSnapshot(): SupportSnapshot {
  return {
    provider: "gorgias",
    tickets30d: 84,
    supportCost30d: 1260,
    costPerTicket: 15,
    liveSync: true,
  };
}

export function demoWarehouseSnapshot(orders30d: number): WarehouseSnapshot {
  return {
    avgFulfillmentHours: 18,
    packingCostPerOrder: 1.45,
    warehouseCost30d: Math.round(orders30d * 1.45 + 890),
    processingDelayPct: 4.2,
    liveSync: true,
  };
}

export function buildOperationalCosts(
  shipping: ShippingSnapshot,
  support: SupportSnapshot,
  warehouse: WarehouseSnapshot,
  accounting: AccountingSnapshot | null,
): OperationalCosts {
  return {
    shippingCost30d: shipping.shippingCost30d,
    supportCost30d: support.supportCost30d,
    warehouseCost30d: warehouse.warehouseCost30d,
    packingCost30d: Math.round(warehouse.packingCostPerOrder * shipping.orders30d),
    actualCogs30d: accounting?.actualCogs30d ?? null,
    sources: [
      shipping.provider,
      support.provider,
      "warehouse",
      ...(accounting ? [accounting.provider] : []),
    ],
  };
}

export function buildDemoIntegrationSnapshot(
  storeMetricsOrSnapshot:
    | {
        revenue30d: number;
        orders30d: number;
      }
    | StoreSnapshot,
  options?: { includeGoogleAds?: boolean },
): {
  googleAds?: GoogleAdsSnapshot;
  tiktokAds: TikTokAdsSnapshot;
  klaviyo: KlaviyoSnapshot;
  ga4: GA4Snapshot;
  metaCapi: MetaCapiStatus;
  inventory: InventoryPlatformSnapshot;
  accounting: AccountingSnapshot;
  shipping: ShippingSnapshot;
  support: SupportSnapshot;
  warehouse: WarehouseSnapshot;
  operationalCosts: OperationalCosts;
  connectedCount: number;
  estimatedCount: number;
  liveDataPct: number;
} {
  const snapshot: StoreSnapshot =
    "products" in storeMetricsOrSnapshot || "demoScenario" in storeMetricsOrSnapshot
      ? (storeMetricsOrSnapshot as StoreSnapshot)
      : {
          source: "demo",
          syncedAt: new Date().toISOString(),
          storeMetrics: storeMetricsOrSnapshot,
          products: [],
        };

  if (isScenarioAwareDemoSnapshot(snapshot)) {
    const scenarioBundle = buildScenarioIntegrationSnapshot(snapshot);
    const includeGoogleAds = options?.includeGoogleAds !== false;
    return {
      ...scenarioBundle,
      googleAds: includeGoogleAds ? scenarioBundle.googleAds : undefined,
    };
  }

  const storeMetrics = snapshot.storeMetrics;
  const includeGoogleAds = options?.includeGoogleAds !== false;
  const googleAds = includeGoogleAds ? demoGoogleAdsSnapshot() : undefined;
  const tiktokAds = demoTikTokAdsSnapshot();
  const klaviyo = demoKlaviyoSnapshot();
  const ga4 = demoGA4Snapshot();
  const metaCapi = demoMetaCapiStatus();
  const inventory = demoInventorySnapshot();
  const accounting = demoAccountingSnapshot(storeMetrics.orders30d);
  const shipping = demoShippingSnapshot(storeMetrics.orders30d);
  const support = demoSupportSnapshot();
  const warehouse = demoWarehouseSnapshot(storeMetrics.orders30d);
  const operationalCosts = buildOperationalCosts(shipping, support, warehouse, accounting);

  return {
    googleAds,
    tiktokAds,
    klaviyo,
    ga4,
    metaCapi,
    inventory,
    accounting,
    shipping,
    support,
    warehouse,
    operationalCosts,
    connectedCount: 10,
    estimatedCount: 0,
    liveDataPct: 100,
  };
}
