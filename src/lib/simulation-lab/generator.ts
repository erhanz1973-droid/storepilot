import type { AdSpendRollups } from "@/lib/ads/types";
import { buildAdSpendSnapshot } from "@/lib/ads/spend";
import { synthesizeAttributionEvents } from "@/lib/attribution/touchpoints";
import { estimateProductOrderStats } from "@/lib/products/enrich";
import type { StoreSnapshot, MetaCampaign } from "@/lib/connectors/types";
import type { GA4Snapshot, GoogleAdsSnapshot } from "@/lib/integrations/types";
import type { ScenarioParams } from "./types";

function rollupsFromWeekly(spend7d: number, rev7d: number): AdSpendRollups {
  const daily = spend7d / 7;
  const revDaily = rev7d / 7;
  const bucket = (days: number) => ({
    spend: Math.round(daily * days * 100) / 100,
    attributedRevenue: Math.round(revDaily * days * 100) / 100,
    orders: Math.max(1, Math.round((rev7d / Math.max(rev7d / 7, 1)) * (days / 7))),
  });
  return {
    today: bucket(1),
    yesterday: bucket(1),
    last7d: bucket(7),
    last30d: bucket(30),
  };
}

function ctrForFatigue(level: ScenarioParams["creativeFatigue"]): number {
  if (level === "high") return 0.85;
  if (level === "medium") return 1.4;
  return 2.2;
}

function buildMetaCampaigns(
  spend7d: number,
  revenue7d: number,
  fatigue: ScenarioParams["creativeFatigue"],
): MetaCampaign[] {
  const roas = spend7d > 0 ? revenue7d / spend7d : 0;
  const ctr = ctrForFatigue(fatigue);
  const split = [0.55, 0.45];
  const names = ["Prospecting — Core", "Retargeting — Warm"];
  return names.map((name, i) => {
    const spend = Math.round(spend7d * split[i] * 100) / 100;
    const revenue = Math.round(revenue7d * split[i] * 100) / 100;
    const impressions = Math.round((spend / 8) * 1000);
    const clicks = Math.max(1, Math.round(impressions * (ctr / 100)));
    return {
      id: `sim-meta-${i + 1}`,
      name,
      status: "ACTIVE",
      effectiveStatus: "ACTIVE",
      metaEffectiveStatus: "ACTIVE",
      spend7d: spend,
      revenue7d: revenue,
      roas7d: spend > 0 ? Math.round((revenue / spend) * 100) / 100 : 0,
      ctr7d: ctr,
      frequency7d: fatigue === "high" ? 3.8 : 1.6,
      impressions7d: impressions,
    };
  });
}

function buildGoogleSnapshot(spend7d: number, revenue7d: number): GoogleAdsSnapshot {
  const roas = spend7d > 0 ? revenue7d / spend7d : 0;
  return {
    campaigns: [
      {
        id: "sim-g-search",
        name: "Simulation Search",
        type: "search",
        status: "ENABLED",
        spend7d: Math.round(spend7d * 0.6 * 100) / 100,
        revenue7d: Math.round(revenue7d * 0.6 * 100) / 100,
        roas7d: roas,
        impressions7d: 42000,
        clicks7d: 1200,
        conversions7d: Math.max(1, Math.round(revenue7d / 55)),
      },
      {
        id: "sim-g-pmax",
        name: "Simulation PMax",
        type: "performance_max",
        status: "ENABLED",
        spend7d: Math.round(spend7d * 0.4 * 100) / 100,
        revenue7d: Math.round(revenue7d * 0.4 * 100) / 100,
        roas7d: roas,
        impressions7d: 88000,
        clicks7d: 2100,
        conversions7d: Math.max(1, Math.round(revenue7d / 60)),
      },
    ],
    adGroups: [],
    keywords: [],
    searchTerms: [],
    rollups: rollupsFromWeekly(spend7d, revenue7d),
    dailySpend: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10),
      spend: Math.round((spend7d / 7) * 100) / 100,
    })),
  };
}

function buildGa4Snapshot(
  params: ScenarioParams,
  metaSpend7d: number,
  googleSpend7d: number,
): GA4Snapshot {
  const { revenue30d, sessions30d, orders30d } = params;
  const metaSessions = Math.round(sessions30d * 0.42);
  const googleSessions = Math.round(sessions30d * 0.28);
  const organicSessions = sessions30d - metaSessions - googleSessions;
  return {
    sessions30d,
    landingPages: params.products.slice(0, 3).map((p, i) => ({
      path: `/products/${p.id}`,
      sessions: Math.round(sessions30d * (0.35 - i * 0.08)),
      revenue: Math.round(p.price * p.unitsSold30d * 100) / 100,
    })),
    sourceMedium: [
      {
        source: "facebook",
        medium: "paid",
        campaign: "sim_meta",
        sessions: metaSessions,
        revenue: Math.round(params.metaRevenue7d * 4.2 * 100) / 100,
        conversions: Math.round(orders30d * 0.4),
      },
      {
        source: "google",
        medium: "cpc",
        campaign: "sim_google",
        sessions: googleSessions,
        revenue: Math.round(params.googleRevenue7d * 4.2 * 100) / 100,
        conversions: Math.round(orders30d * 0.28),
      },
      {
        source: "(direct)",
        medium: "(none)",
        campaign: "(direct)",
        sessions: organicSessions,
        revenue: Math.round(revenue30d * 0.22 * 100) / 100,
        conversions: Math.round(orders30d * 0.2),
      },
    ],
    utmCampaigns: [
      { campaign: "sim_meta", sessions: metaSessions, revenue: params.metaRevenue7d * 4 },
      { campaign: "sim_google", sessions: googleSessions, revenue: params.googleRevenue7d * 4 },
    ],
    devices: [
      { device: "mobile", sessions: Math.round(sessions30d * 0.68), revenue: Math.round(revenue30d * 0.62 * 100) / 100 },
      { device: "desktop", sessions: Math.round(sessions30d * 0.28), revenue: Math.round(revenue30d * 0.34 * 100) / 100 },
      { device: "tablet", sessions: Math.round(sessions30d * 0.04), revenue: Math.round(revenue30d * 0.04 * 100) / 100 },
    ],
    countries: [{ country: "US", sessions: sessions30d, revenue: revenue30d }],
  };
}

function buildProfitRollups(params: ScenarioParams) {
  const cogs = params.products.reduce(
    (sum, p) => sum + p.unitCost * p.unitsSold30d,
    0,
  );
  const refunds = Math.round(params.revenue30d * (params.refundRatePct / 100) * 100) / 100;
  const shipping = Math.round(params.orders30d * 6.5 * 100) / 100;
  const bucket = (factor: number) => ({
    revenue: Math.round(params.revenue30d * factor * 100) / 100,
    cogs: Math.round(cogs * factor * 100) / 100,
    shipping: Math.round(shipping * factor * 100) / 100,
    refunds: Math.round(refunds * factor * 100) / 100,
    orders: Math.max(1, Math.round(params.orders30d * factor)),
  });
  return {
    today: bucket(1 / 30),
    yesterday: bucket(1 / 30),
    last7d: bucket(7 / 30),
    last30d: bucket(1),
  };
}

/** Verify internal consistency — throws if metrics disagree. */
export function assertSnapshotConsistency(params: ScenarioParams): void {
  const productRevenue = params.products.reduce(
    (s, p) => s + p.price * p.unitsSold30d,
    0,
  );
  const tolerance = params.revenue30d * 0.35;
  if (Math.abs(productRevenue - params.revenue30d) > tolerance && params.products.length > 0) {
    // Allow aggregate revenue to differ from SKU sum when scenario sets headline revenue
    return;
  }
  const metaRoas =
    params.metaSpend7d > 0 ? params.metaRevenue7d / params.metaSpend7d : 0;
  const googleRoas =
    params.googleSpend7d > 0 ? params.googleRevenue7d / params.googleSpend7d : 0;
  if (metaRoas < 0 || googleRoas < 0) {
    throw new Error("ROAS cannot be negative");
  }
  if (params.conversionRate30d < 0 || params.conversionRate30d > 100) {
    throw new Error("Conversion rate out of range");
  }
}

export function generateSimulationSnapshot(
  storeId: string,
  params: ScenarioParams,
): StoreSnapshot {
  assertSnapshotConsistency(params);
  const now = new Date().toISOString();
  const aov =
    params.orders30d > 0
      ? Math.round((params.revenue30d / params.orders30d) * 100) / 100
      : 0;

  const products = params.products.map((p) => ({
    id: p.id,
    title: p.title,
    inventoryQuantity: p.inventory,
    unitsSold30d: p.unitsSold30d,
    revenue30d: Math.round(p.price * p.unitsSold30d * 100) / 100,
    price: p.price,
    unitCost: p.unitCost,
    collectionIds: [] as string[],
    tags: p.tags ?? [],
  }));

  const campaigns = buildMetaCampaigns(
    params.metaSpend7d,
    params.metaRevenue7d,
    params.creativeFatigue ?? "low",
  );

  const metaRollups = rollupsFromWeekly(params.metaSpend7d, params.metaRevenue7d);
  const googleRollups = rollupsFromWeekly(params.googleSpend7d, params.googleRevenue7d);
  const adSpendSnapshot = buildAdSpendSnapshot({
    metaCampaigns: campaigns,
    metaAccountRollups: metaRollups,
    googleRollups: googleRollups,
  });

  const productOrderStats = Object.fromEntries(
    products.map((p) => [
      p.id,
      estimateProductOrderStats(p.id, p.unitsSold30d, p.revenue30d),
    ]),
  );

  const attributionEvents = synthesizeAttributionEvents(
    campaigns,
    params.revenue30d,
    params.orders30d,
  );

  return {
    source: "connected",
    syncedAt: now,
    commerceProvider: "shopify",
    commerceStoreDomain: `${storeId.slice(-8)}.simulation.local`,
    products,
    collections: [
      {
        id: "sim-col-1",
        title: "Simulation Collection",
        productCount: products.length,
        homepageFeatured: true,
        revenue30d: params.revenue30d,
      },
    ],
    campaigns,
    storeMetrics: {
      revenue30d: params.revenue30d,
      orders30d: params.orders30d,
      aov30d: aov,
      conversionRate30d: params.conversionRate30d,
    },
    salesTrends: {
      thisWeek: { revenue: params.revenue30d / 4, orders: Math.round(params.orders30d / 4), aov },
      lastWeek: { revenue: params.revenue30d / 4.2, orders: Math.round(params.orders30d / 4.2), aov },
      last30Days: { revenue: params.revenue30d, orders: params.orders30d, aov },
      previous30Days: {
        revenue: params.revenue30d * 0.88,
        orders: Math.round(params.orders30d * 0.88),
        aov,
      },
    },
    profitRollups: buildProfitRollups(params),
    adSpendSnapshot,
    metaAccountRollups: metaRollups,
    googleAdsSnapshot: buildGoogleSnapshot(params.googleSpend7d, params.googleRevenue7d),
    ga4Snapshot: buildGa4Snapshot(params, params.metaSpend7d, params.googleSpend7d),
    productOrderStats,
    attributionEvents,
    connectorStates: {
      shopify: "connected",
      meta_ads: "connected",
      google_ads: "connected",
    },
  };
}

export function generationPerformanceMs(start: number): number {
  return Math.round(performance.now() - start);
}
