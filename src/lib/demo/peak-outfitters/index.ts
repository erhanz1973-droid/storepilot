import { estimateProductOrderStats } from "@/lib/products/enrich";
import { buildAdSpendSnapshot, scaleCampaignSpendToRollups } from "@/lib/ads/spend";
import type { ProfitOrderRollups, StoreSnapshot } from "@/lib/connectors/types";
import type { AdSpendSnapshot, DailyMetricPoint } from "@/lib/ads/types";
import { PEAK_OUTFITTERS, DEMO_COLLECTIONS } from "./constants";
import { PEAK_OUTFITTERS_PRODUCTS } from "./products";
import { PEAK_OUTFITTERS_META_CAMPAIGNS } from "./meta-campaigns";
import { peakOutfittersDailyMetrics } from "./daily-metrics";
import { peakOutfittersAttributionEvents } from "./attribution";
import { peakOutfittersCustomerSnapshot } from "./customers";

function buildProfitRollups(): ProfitOrderRollups {
  const revenue30d = PEAK_OUTFITTERS.revenue30d;
  const orders30d = PEAK_OUTFITTERS.orders30d;
  const cogs = PEAK_OUTFITTERS_PRODUCTS.reduce(
    (s, p) => s + (p.unitCost ?? p.price * 0.42) * p.unitsSold30d,
    0,
  );
  const shipping = Math.round(orders30d * 8);
  const refunds = Math.round(revenue30d * 0.02);
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
    orders: Math.round(dailyOrders * mult),
  });

  return {
    today: bucket(1),
    yesterday: bucket(0.96),
    last7d: bucket(7),
    last30d: { revenue: revenue30d, cogs: Math.round(cogs), shipping, refunds, orders: orders30d },
  };
}

const prevRevenue = Math.round(PEAK_OUTFITTERS.revenue30d / (1 + PEAK_OUTFITTERS.trends.revenueChangePct / 100));
const prevOrders = Math.round(PEAK_OUTFITTERS.orders30d / (1 + PEAK_OUTFITTERS.trends.ordersChangePct / 100));

export const PEAK_OUTFITTERS_BASE_SNAPSHOT: StoreSnapshot = {
  source: "demo",
  commerceStoreDomain: PEAK_OUTFITTERS.shopDomain,
  syncedAt: new Date().toISOString(),
  connectorStates: { shopify: "demo", meta_ads: "demo", google_ads: "demo" },
  storeMetrics: {
    revenue30d: PEAK_OUTFITTERS.revenue30d,
    orders30d: PEAK_OUTFITTERS.orders30d,
    aov30d: PEAK_OUTFITTERS.aov,
    conversionRate30d: PEAK_OUTFITTERS.conversionRatePct,
  },
  salesTrends: {
    thisWeek: {
      revenue: Math.round(PEAK_OUTFITTERS.revenue30d * 0.26),
      orders: Math.round(PEAK_OUTFITTERS.orders30d * 0.26),
      aov: PEAK_OUTFITTERS.aov,
    },
    lastWeek: {
      revenue: Math.round(PEAK_OUTFITTERS.revenue30d * 0.24),
      orders: Math.round(PEAK_OUTFITTERS.orders30d * 0.24),
      aov: PEAK_OUTFITTERS.aov,
    },
    last30Days: {
      revenue: PEAK_OUTFITTERS.revenue30d,
      orders: PEAK_OUTFITTERS.orders30d,
      aov: PEAK_OUTFITTERS.aov,
    },
    previous30Days: {
      revenue: prevRevenue,
      orders: prevOrders,
      aov: Math.round((prevRevenue / prevOrders) * 100) / 100,
    },
  },
  profitRollups: buildProfitRollups(),
  products: PEAK_OUTFITTERS_PRODUCTS,
  collections: DEMO_COLLECTIONS.map((c) => ({
    id: `gid://shopify/Collection/${c.id}`,
    title: c.title,
    productCount: c.productCount,
    homepageFeatured: c.homepageFeatured,
    revenue30d: c.revenue30d,
  })),
  campaigns: PEAK_OUTFITTERS_META_CAMPAIGNS,
};

export const PEAK_OUTFITTERS_AD_SPEND: AdSpendSnapshot = buildAdSpendSnapshot({
  metaCampaigns: PEAK_OUTFITTERS_META_CAMPAIGNS,
  metaAccountRollups: scaleCampaignSpendToRollups(PEAK_OUTFITTERS_META_CAMPAIGNS),
});

export const PEAK_OUTFITTERS_DAILY_METRICS: DailyMetricPoint[] = peakOutfittersDailyMetrics();

export function getPeakOutfittersSnapshot(): StoreSnapshot {
  const productOrderStats: NonNullable<StoreSnapshot["productOrderStats"]> = {};
  for (const p of PEAK_OUTFITTERS_PRODUCTS) {
    productOrderStats[p.id] = estimateProductOrderStats(p.id, p.unitsSold30d, p.revenue30d);
  }

  return {
    ...PEAK_OUTFITTERS_BASE_SNAPSHOT,
    adSpendSnapshot: PEAK_OUTFITTERS_AD_SPEND,
    dailyMetrics: PEAK_OUTFITTERS_DAILY_METRICS,
    metaAccountRollups: scaleCampaignSpendToRollups(PEAK_OUTFITTERS_META_CAMPAIGNS),
    productOrderStats,
    attributionEvents: peakOutfittersAttributionEvents(),
    customerSnapshot: peakOutfittersCustomerSnapshot(),
  };
}

/** @deprecated Use getPeakOutfittersSnapshot — alias for legacy imports */
export const getDemoStoreSnapshot = getPeakOutfittersSnapshot;
export const DEMO_STORE_SNAPSHOT = PEAK_OUTFITTERS_BASE_SNAPSHOT;
export const DEMO_AD_SPEND_SNAPSHOT = PEAK_OUTFITTERS_AD_SPEND;
export const DEMO_DAILY_METRICS = PEAK_OUTFITTERS_DAILY_METRICS;

export { PEAK_OUTFITTERS } from "./constants";
export {
  peakOutfittersCommerceOrders,
  peakOutfittersCommerceCustomers,
} from "./orders";
