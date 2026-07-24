import { estimateProductOrderStats } from "@/lib/products/enrich";
import { buildAdSpendSnapshot, scaleCampaignSpendToRollups } from "@/lib/ads/spend";
import type { ProfitOrderRollups, StoreSnapshot } from "@/lib/connectors/types";
import type { AdSpendSnapshot, DailyMetricPoint } from "@/lib/ads/types";
import { ALPINE_OUTFITTERS, ALPINE_COLLECTIONS } from "./constants";
import { ALPINE_OUTFITTERS_PRODUCTS, assertAlpineProductRevenue } from "./products";
import { ALPINE_META_CAMPAIGNS, assertAlpineMetaTotals } from "./meta-campaigns";
import { alpineOutfittersDailyMetrics } from "./daily-metrics";
import { alpineOutfittersGA4Snapshot } from "./ga4";
import { alpineOutfittersGoogleAdsSnapshot } from "./google-campaigns";
import { ALPINE_CURATED_RECOMMENDATIONS } from "./recommendations";
import { peakOutfittersCustomerSnapshot } from "@/lib/demo/peak-outfitters/customers";
import { peakOutfittersCommerceOrders } from "@/lib/demo/peak-outfitters/orders";
import { peakOutfittersAttributionEvents } from "@/lib/demo/peak-outfitters/attribution";

const DEMO_SYNCED_AT = "2026-07-20T12:00:00.000Z";

function buildProfitRollups(): ProfitOrderRollups {
  const revenue30d = ALPINE_OUTFITTERS.revenue30d;
  const orders30d = ALPINE_OUTFITTERS.orders30d;
  const targetProfit = ALPINE_OUTFITTERS.netProfit30d;
  const cogs = ALPINE_OUTFITTERS_PRODUCTS.reduce(
    (s, p) => s + (p.unitCost ?? p.price * 0.38) * p.unitsSold30d,
    0,
  );
  const shipping = Math.round(orders30d * 6.5);
  const refunds = Math.round(revenue30d * 0.015);
  /** Ads + ops approximated so net profit lands on showcase figure */
  const adSpend =
    ALPINE_OUTFITTERS.metaSpend30d + ALPINE_OUTFITTERS.googleSpend30d;
  const grossAfterCogs = revenue30d - cogs - shipping - refunds;
  const impliedOtherCosts = Math.max(0, Math.round(grossAfterCogs - adSpend - targetProfit));
  void impliedOtherCosts;

  const dailyRev = revenue30d / 30;
  const dailyCogs = cogs / 30;
  const dailyShip = shipping / 30;
  const dailyRefunds = refunds / 30;
  const dailyOrders = orders30d / 30;

  const bucket = (mult: number) => ({
    revenue: Math.round(dailyRev * mult * 100) / 100,
    cogs: Math.round(dailyCogs * mult * 100) / 100,
    shipping: Math.round(dailyShip * mult * 100) / 100,
    refunds: Math.round(dailyRefunds * mult * 100) / 100,
    orders: Math.max(1, Math.round(dailyOrders * mult)),
  });

  return {
    today: bucket(1),
    yesterday: bucket(0.97),
    last7d: bucket(7),
    last30d: {
      revenue: revenue30d,
      cogs: Math.round(cogs),
      shipping,
      refunds,
      orders: orders30d,
    },
  };
}

const prevRevenue = Math.round(
  ALPINE_OUTFITTERS.revenue30d / (1 + ALPINE_OUTFITTERS.trends.revenueChangePct / 100),
);
const prevOrders = Math.round(
  ALPINE_OUTFITTERS.orders30d / (1 + ALPINE_OUTFITTERS.trends.ordersChangePct / 100),
);

function buildAlpineBaseSnapshot(): StoreSnapshot {
  assertAlpineProductRevenue();
  assertAlpineMetaTotals();

  const productOrderStats: NonNullable<StoreSnapshot["productOrderStats"]> = {};
  for (const p of ALPINE_OUTFITTERS_PRODUCTS) {
    productOrderStats[p.id] = estimateProductOrderStats(p.id, p.unitsSold30d, p.revenue30d);
  }

  const adSpendSnapshot = buildAdSpendSnapshot({
    metaCampaigns: ALPINE_META_CAMPAIGNS,
    metaAccountRollups: scaleCampaignSpendToRollups(ALPINE_META_CAMPAIGNS),
  });

  const ratio = ALPINE_OUTFITTERS.revenue30d / 184_250;
  const customers = peakOutfittersCustomerSnapshot();
  const customerKeep = Math.max(
    20,
    Math.min(customers.customers.length, Math.round(customers.customers.length * ratio)),
  );

  return {
    source: "demo",
    demoScenario: "healthy_growth",
    commerceStoreDomain: ALPINE_OUTFITTERS.shopDomain,
    syncedAt: DEMO_SYNCED_AT,
    connectorStates: { shopify: "demo", meta_ads: "demo", google_ads: "demo" },
    storeMetrics: {
      revenue30d: ALPINE_OUTFITTERS.revenue30d,
      orders30d: ALPINE_OUTFITTERS.orders30d,
      aov30d: ALPINE_OUTFITTERS.aov,
      conversionRate30d: ALPINE_OUTFITTERS.conversionRatePct,
    },
    salesTrends: {
      thisWeek: {
        revenue: Math.round(ALPINE_OUTFITTERS.revenue30d * 0.27),
        orders: Math.round(ALPINE_OUTFITTERS.orders30d * 0.27),
        aov: ALPINE_OUTFITTERS.aov,
      },
      lastWeek: {
        revenue: Math.round(ALPINE_OUTFITTERS.revenue30d * 0.24),
        orders: Math.round(ALPINE_OUTFITTERS.orders30d * 0.24),
        aov: ALPINE_OUTFITTERS.aov,
      },
      last30Days: {
        revenue: ALPINE_OUTFITTERS.revenue30d,
        orders: ALPINE_OUTFITTERS.orders30d,
        aov: ALPINE_OUTFITTERS.aov,
      },
      previous30Days: {
        revenue: prevRevenue,
        orders: prevOrders,
        aov: Math.round((prevRevenue / prevOrders) * 100) / 100,
      },
    },
    profitRollups: buildProfitRollups(),
    products: ALPINE_OUTFITTERS_PRODUCTS,
    collections: ALPINE_COLLECTIONS.map((c) => ({
      id: `gid://shopify/Collection/${c.id}`,
      title: c.title,
      productCount: c.productCount,
      homepageFeatured: c.homepageFeatured,
      revenue30d: c.revenue30d,
    })),
    campaigns: ALPINE_META_CAMPAIGNS,
    adSpendSnapshot,
    dailyMetrics: alpineOutfittersDailyMetrics(),
    metaAccountRollups: scaleCampaignSpendToRollups(ALPINE_META_CAMPAIGNS),
    productOrderStats,
    commerceOrders: peakOutfittersCommerceOrders().slice(0, 48),
    attributionEvents: peakOutfittersAttributionEvents().slice(0, 40),
    customerSnapshot: {
      ...customers,
      orders30d: ALPINE_OUTFITTERS.orders30d,
      totalCustomers: ALPINE_OUTFITTERS.customerCount,
      newCustomers30d: Math.round(ALPINE_OUTFITTERS.orders30d * 0.68),
      returningCustomers30d: Math.round(ALPINE_OUTFITTERS.orders30d * 0.32),
      aov: ALPINE_OUTFITTERS.aov,
      customers: customers.customers.slice(0, customerKeep),
    },
  };
}

let cachedSnapshot: StoreSnapshot | null = null;

/** Deterministic Alpine Outfitters showcase snapshot (App Store / website demo). */
export function getAlpineOutfittersSnapshot(): StoreSnapshot {
  if (!cachedSnapshot) {
    cachedSnapshot = buildAlpineBaseSnapshot();
  }
  return cachedSnapshot;
}

export const ALPINE_OUTFITTERS_AD_SPEND: AdSpendSnapshot = buildAdSpendSnapshot({
  metaCampaigns: ALPINE_META_CAMPAIGNS,
  metaAccountRollups: scaleCampaignSpendToRollups(ALPINE_META_CAMPAIGNS),
});

export const ALPINE_OUTFITTERS_DAILY_METRICS: DailyMetricPoint[] =
  alpineOutfittersDailyMetrics();

export function isAlpineOutfittersSnapshot(snapshot: StoreSnapshot): boolean {
  return (
    snapshot.source === "demo" &&
    (snapshot.demoScenario === "healthy_growth" ||
      snapshot.commerceStoreDomain === ALPINE_OUTFITTERS.shopDomain)
  );
}

export {
  ALPINE_OUTFITTERS,
  ALPINE_COLLECTIONS,
  ALPINE_OUTFITTERS_PRODUCTS,
  ALPINE_META_CAMPAIGNS,
  ALPINE_CURATED_RECOMMENDATIONS,
  alpineOutfittersGA4Snapshot,
  alpineOutfittersGoogleAdsSnapshot,
  alpineOutfittersDailyMetrics,
};

export { alpineProductRevenueTotal } from "./products";
export { alpineMetaSpend7dTotal, alpineMetaRevenue7dTotal } from "./meta-campaigns";
export { alpineGoogleSpend7dTotal, alpineGoogleRevenue7dTotal } from "./google-campaigns";
export { ALPINE_UI_METRICS, getAlpineHeroRecommendation } from "./ui-metrics";
export type { AlpineUiMetrics } from "./ui-metrics";
