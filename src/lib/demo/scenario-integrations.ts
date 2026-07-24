import type { StoreSnapshot } from "@/lib/connectors/types";
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
} from "@/lib/integrations/types";
import { PEAK_OUTFITTERS } from "@/lib/demo/peak-outfitters/constants";
import { peakOutfittersGA4Snapshot } from "@/lib/demo/peak-outfitters/ga4";
import { peakOutfittersGoogleAdsSnapshot } from "@/lib/demo/peak-outfitters/google-campaigns";
import {
  alpineOutfittersGA4Snapshot,
  alpineOutfittersGoogleAdsSnapshot,
} from "@/lib/demo/alpine-outfitters";
import { getDemoScenario } from "@/lib/demo/scenarios/registry";
import type { DemoScenarioDefinition } from "@/lib/demo/scenarios/types";
import {
  buildOperationalCosts,
} from "@/lib/integrations/demo-data";

function scenarioDef(snapshot: StoreSnapshot): DemoScenarioDefinition | null {
  if (!snapshot.demoScenario) return null;
  return getDemoScenario(snapshot.demoScenario);
}

function revenueRatio(snapshot: StoreSnapshot): number {
  return snapshot.storeMetrics.revenue30d / PEAK_OUTFITTERS.revenue30d;
}

function sessionRatio(snapshot: StoreSnapshot, scenario: DemoScenarioDefinition | null): number {
  const sessions =
    scenario?.sessions30d ??
    (snapshot.storeMetrics.conversionRate30d > 0
      ? snapshot.storeMetrics.orders30d / (snapshot.storeMetrics.conversionRate30d / 100)
      : PEAK_OUTFITTERS.sessions30d);
  return sessions / PEAK_OUTFITTERS.sessions30d;
}

function orderRatio(snapshot: StoreSnapshot): number {
  return snapshot.storeMetrics.orders30d / PEAK_OUTFITTERS.orders30d;
}

export function buildScenarioGA4Snapshot(snapshot: StoreSnapshot): GA4Snapshot {
  const scenario = scenarioDef(snapshot);
  if (scenario?.id === "healthy_growth") {
    return alpineOutfittersGA4Snapshot();
  }
  const base = peakOutfittersGA4Snapshot();
  const m = snapshot.storeMetrics;
  const sRatio = sessionRatio(snapshot, scenario);
  const rRatio = revenueRatio(snapshot);
  const sessions = Math.round(
    scenario?.sessions30d ?? base.sessions30d * sRatio,
  );
  const users = Math.round(sessions * 0.82);
  const newUsers = Math.round(users * 0.69);
  const returningUsers = users - newUsers;
  const events = base.funnelEvents!;

  return {
    ...base,
    sessions30d: sessions,
    users30d: users,
    newUsers30d: newUsers,
    returningUsers30d: returningUsers,
    returningUserRatePct: users > 0 ? (returningUsers / users) * 100 : 0,
    engagedSessions30d: Math.round(sessions * 0.64),
    purchases30d: m.orders30d,
    purchaseRevenue30d: m.revenue30d,
    transactions30d: m.orders30d,
    ecommerceConversionRatePct: m.conversionRate30d,
    landingPages: base.landingPages.map((p) => ({
      ...p,
      sessions: Math.max(1, Math.round(p.sessions * sRatio)),
      revenue: Math.max(0, Math.round(p.revenue * rRatio)),
    })),
    sourceMedium: base.sourceMedium.map((row) => ({
      ...row,
      sessions: Math.max(1, Math.round(row.sessions * sRatio)),
      revenue: Math.max(0, Math.round(row.revenue * rRatio)),
      conversions: Math.max(0, Math.round(row.conversions * orderRatio(snapshot))),
    })),
    utmCampaigns: base.utmCampaigns.map((row) => ({
      ...row,
      sessions: Math.max(1, Math.round(row.sessions * sRatio)),
      revenue: Math.max(0, Math.round(row.revenue * rRatio)),
    })),
    channelGroups: base.channelGroups?.map((row) => ({
      ...row,
      sessions: Math.max(1, Math.round(row.sessions * sRatio)),
      revenue: Math.max(0, Math.round(row.revenue * rRatio)),
    })),
    dailySessions: base.dailySessions?.map((row) => ({
      ...row,
      sessions: Math.max(1, Math.round(row.sessions * sRatio)),
    })),
    devices: base.devices.map((d) => ({
      ...d,
      sessions: Math.max(1, Math.round(d.sessions * sRatio)),
      revenue: Math.max(0, Math.round(d.revenue * rRatio)),
    })),
    countries: base.countries.map((c) => ({
      ...c,
      sessions: Math.max(1, Math.round(c.sessions * sRatio)),
      revenue: Math.max(0, Math.round(c.revenue * rRatio)),
    })),
    funnelEvents: {
      productViews30d: Math.max(m.orders30d, Math.round(events.productViews30d * sRatio)),
      addToCart30d: Math.max(
        Math.round(m.orders30d * 1.4),
        Math.round(events.addToCart30d * sRatio),
      ),
      checkout30d: Math.max(
        Math.round(m.orders30d * 1.1),
        Math.round(events.checkout30d * sRatio),
      ),
      purchases30d: m.orders30d,
      verified: true,
    },
    syncedAt: new Date().toISOString(),
  };
}

export function buildScenarioGoogleAdsSnapshot(snapshot: StoreSnapshot): GoogleAdsSnapshot {
  const scenario = scenarioDef(snapshot);
  if (scenario?.id === "healthy_growth") {
    return alpineOutfittersGoogleAdsSnapshot();
  }
  const base = peakOutfittersGoogleAdsSnapshot();
  const targetSpend = scenario?.googleSpend7d ?? base.campaigns.reduce((s, c) => s + c.spend7d, 0);
  const targetRev = scenario?.googleRevenue7d ?? base.campaigns.reduce((s, c) => s + c.revenue7d, 0);
  const baseSpend = base.campaigns.reduce((s, c) => s + c.spend7d, 0) || 1;
  const spendScale = targetSpend / baseSpend;

  const campaigns = base.campaigns.map((c) => {
    const spend7d = Math.round(c.spend7d * spendScale);
    const roas7d = c.roas7d;
    const revenue7d = Math.round(spend7d * roas7d);
    return {
      ...c,
      spend7d,
      revenue7d,
      conversions7d: Math.max(
        1,
        Math.round(
          c.conversions7d * (snapshot.storeMetrics.orders30d / PEAK_OUTFITTERS.orders30d),
        ),
      ),
    };
  });

  const actualRev = campaigns.reduce((s, c) => s + c.revenue7d, 0) || targetRev;
  const actualSpend = campaigns.reduce((s, c) => s + c.spend7d, 0);
  const revScale = targetRev / Math.max(actualRev, 1);

  const scaledCampaigns = campaigns.map((c) => ({
    ...c,
    revenue7d: Math.round(c.revenue7d * revScale),
  }));

  const spendTotal = scaledCampaigns.reduce((s, c) => s + c.spend7d, 0);
  if (spendTotal !== targetSpend && scaledCampaigns.length > 0) {
    const diff = targetSpend - spendTotal;
    scaledCampaigns[0] = {
      ...scaledCampaigns[0]!,
      spend7d: scaledCampaigns[0]!.spend7d + diff,
      revenue7d: Math.round((scaledCampaigns[0]!.spend7d + diff) * scaledCampaigns[0]!.roas7d),
    };
  }

  const finalSpend = scaledCampaigns.reduce((s, c) => s + c.spend7d, 0);
  const finalRev = scaledCampaigns.reduce((s, c) => s + c.revenue7d, 0);

  const rollupsFromWeekly = (spend7d: number, rev7d: number) => {
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
  };

  return {
    ...base,
    campaigns: scaledCampaigns,
    adGroups: base.adGroups.map((ag) => ({
      ...ag,
      spend7d: Math.round(ag.spend7d * spendScale),
      revenue7d: Math.round(ag.revenue7d * spendScale * revScale),
    })),
    keywords: base.keywords.map((kw) => ({
      ...kw,
      spend7d: Math.round(kw.spend7d * spendScale),
      revenue7d: Math.round(kw.revenue7d * spendScale * revScale),
    })),
    searchTerms: base.searchTerms.map((st) => ({
      ...st,
      spend7d: Math.round(st.spend7d * spendScale),
      revenue7d: Math.round(st.revenue7d * spendScale * revScale),
    })),
    rollups: rollupsFromWeekly(finalSpend, finalRev),
    dailySpend: base.dailySpend.map((d) => ({
      ...d,
      spend: Math.round(d.spend * spendScale * 100) / 100,
    })),
  };
}

export function buildScenarioInventorySnapshot(snapshot: StoreSnapshot): InventoryPlatformSnapshot {
  const products = snapshot.products ?? [];
  const unitsOnHand = products.reduce((s, p) => s + p.inventoryQuantity, 0);
  const lowStockSkus = products.filter(
    (p) => p.inventoryQuantity > 0 && p.inventoryQuantity <= 5,
  ).length;
  const scenario = scenarioDef(snapshot);

  return {
    platform: "stocky",
    skuCount: products.length,
    unitsOnHand,
    lowStockSkus:
      scenario?.inventoryRisk === "low"
        ? Math.min(lowStockSkus, 1)
        : scenario?.inventoryRisk === "high"
          ? Math.max(lowStockSkus, scenario.lowStockHeroSkus ?? 3)
          : lowStockSkus,
    liveSync: true,
  };
}

function buildScenarioTikTokAds(snapshot: StoreSnapshot): TikTokAdsSnapshot {
  const rRatio = revenueRatio(snapshot);
  const spend7d = Math.round(980 * rRatio);
  const rev7d = Math.round(2_140 * rRatio);
  const rollupsFromWeekly = (s7: number, r7: number) => {
    const daily = s7 / 7;
    const revDaily = r7 / 7;
    const bucket = (days: number) => ({
      spend: Math.round(daily * days * 100) / 100,
      attributedRevenue: Math.round(revDaily * days * 100) / 100,
      orders: 0,
    });
    return { today: bucket(1), yesterday: bucket(1), last7d: bucket(7), last30d: bucket(30) };
  };
  return {
    campaigns: [
      {
        id: "tt-camp-1",
        name: "Spark Ads — Trail UGC",
        spend7d: Math.round(spend7d * 0.63),
        revenue7d: Math.round(rev7d * 0.69),
        roas7d: 2.39,
        impressions7d: Math.round(185_000 * rRatio),
        clicks7d: Math.round(4_200 * rRatio),
        conversions7d: Math.max(1, Math.round(38 * orderRatio(snapshot))),
      },
      {
        id: "tt-camp-2",
        name: "Prospecting — Day Hike Gear",
        spend7d: Math.round(spend7d * 0.37),
        revenue7d: Math.round(rev7d * 0.31),
        roas7d: 1.83,
        impressions7d: Math.round(92_000 * rRatio),
        clicks7d: Math.round(1_800 * rRatio),
        conversions7d: Math.max(1, Math.round(18 * orderRatio(snapshot))),
      },
    ],
    adGroups: [],
    creatives: [],
    rollups: rollupsFromWeekly(spend7d, rev7d),
    dailySpend: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
      spend: Math.round((spend7d / 7) * (0.9 + (i % 4) * 0.03) * 100) / 100,
    })),
  };
}

function buildScenarioKlaviyo(snapshot: StoreSnapshot): KlaviyoSnapshot {
  const rRatio = revenueRatio(snapshot);
  const oRatio = orderRatio(snapshot);
  return {
    campaignRevenue30d: Math.round(4_280 * rRatio),
    flowRevenue30d: Math.round(6_120 * rRatio),
    emailAttributedRevenue30d: Math.round(8_940 * rRatio),
    smsAttributedRevenue30d: Math.round(1_460 * rRatio),
    orders30d: Math.max(1, Math.round(186 * oRatio)),
    rollups: {
      today: { spend: 0, attributedRevenue: Math.round(280 * rRatio), orders: Math.max(1, Math.round(4 * oRatio)) },
      yesterday: { spend: 0, attributedRevenue: Math.round(310 * rRatio), orders: Math.max(1, Math.round(5 * oRatio)) },
      last7d: { spend: 0, attributedRevenue: Math.round(2_180 * rRatio), orders: Math.max(1, Math.round(38 * oRatio)) },
      last30d: {
        spend: Math.round(420 * rRatio),
        attributedRevenue: Math.round(10_400 * rRatio),
        orders: Math.max(1, Math.round(186 * oRatio)),
      },
    },
  };
}

function buildScenarioMetaCapi(snapshot: StoreSnapshot): MetaCapiStatus {
  const oRatio = orderRatio(snapshot);
  const orders = snapshot.storeMetrics.orders30d;
  return {
    enabled: true,
    eventsReceived30d: Math.round(4_820 * oRatio),
    matchRatePct: 89,
    events: {
      purchase: orders,
      addToCart: Math.max(orders, Math.round(1_240 * oRatio)),
      initiateCheckout: Math.max(Math.round(orders * 0.8), Math.round(890 * oRatio)),
      viewContent: Math.max(Math.round(orders * 2.5), Math.round(3_420 * oRatio)),
    },
  };
}

function buildScenarioAccounting(snapshot: StoreSnapshot): AccountingSnapshot {
  const cogs =
    snapshot.profitRollups?.last30d.cogs ??
    Math.round(snapshot.storeMetrics.revenue30d * 0.42);
  const scenario = scenarioDef(snapshot);
  const opexBase = scenario?.personality === "recovery" ? 11_200 : 8_400;
  return {
    provider: "quickbooks",
    actualCogs30d: cogs,
    operatingExpenses30d: Math.round(opexBase * Math.max(0.5, revenueRatio(snapshot))),
    liveSync: true,
  };
}

function buildScenarioShipping(snapshot: StoreSnapshot): ShippingSnapshot {
  const orders = snapshot.storeMetrics.orders30d;
  return {
    provider: "shipstation",
    shippingCost30d: Math.round(orders * 6.85),
    costPerOrder: 6.85,
    orders30d: orders,
    liveSync: true,
  };
}

function buildScenarioSupport(snapshot: StoreSnapshot): SupportSnapshot {
  const scenario = scenarioDef(snapshot);
  const tickets = Math.round(
    (scenario?.personality === "recovery" ? 112 : 84) * Math.max(0.4, revenueRatio(snapshot)),
  );
  return {
    provider: "gorgias",
    tickets30d: tickets,
    supportCost30d: Math.round(tickets * 15),
    costPerTicket: 15,
    liveSync: true,
  };
}

function buildScenarioWarehouse(snapshot: StoreSnapshot): WarehouseSnapshot {
  const orders = snapshot.storeMetrics.orders30d;
  const scenario = scenarioDef(snapshot);
  const delayPct =
    scenario?.inventoryRisk === "high" ? 9.5 : scenario?.inventoryRisk === "low" ? 2.8 : 4.2;
  const fulfillmentHours =
    scenario?.inventoryRisk === "high" ? 28 : scenario?.inventoryRisk === "low" ? 14 : 18;
  return {
    avgFulfillmentHours: fulfillmentHours,
    packingCostPerOrder: 1.45,
    warehouseCost30d: Math.round(orders * 1.45 + 890 * Math.max(0.5, revenueRatio(snapshot))),
    processingDelayPct: delayPct,
    liveSync: true,
  };
}

export function buildScenarioIntegrationSnapshot(snapshot: StoreSnapshot): {
  googleAds: GoogleAdsSnapshot;
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
  const googleAds = buildScenarioGoogleAdsSnapshot(snapshot);
  const tiktokAds = buildScenarioTikTokAds(snapshot);
  const klaviyo = buildScenarioKlaviyo(snapshot);
  const ga4 = buildScenarioGA4Snapshot(snapshot);
  const metaCapi = buildScenarioMetaCapi(snapshot);
  const inventory = buildScenarioInventorySnapshot(snapshot);
  const accounting = buildScenarioAccounting(snapshot);
  const shipping = buildScenarioShipping(snapshot);
  const support = buildScenarioSupport(snapshot);
  const warehouse = buildScenarioWarehouse(snapshot);
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

export function isScenarioAwareDemoSnapshot(snapshot: StoreSnapshot): boolean {
  return snapshot.source === "demo" && Boolean(snapshot.demoScenario);
}
