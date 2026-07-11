/**
 * Struggling store — preserves the original Peak Outfitters demo dataset.
 */
import { estimateProductOrderStats } from "@/lib/products/enrich";
import { buildAdSpendSnapshot, scaleCampaignSpendToRollups } from "@/lib/ads/spend";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { DailyMetricPoint } from "@/lib/ads/types";
import { getDemoScenario } from "@/lib/demo/scenarios/registry";
import { DEMO_COLLECTIONS, PEAK_OUTFITTERS } from "@/lib/demo/peak-outfitters/constants";
import { PEAK_OUTFITTERS_PRODUCTS } from "@/lib/demo/peak-outfitters/products";
import { PEAK_OUTFITTERS_META_CAMPAIGNS } from "@/lib/demo/peak-outfitters/meta-campaigns";
import { peakOutfittersDailyMetrics } from "@/lib/demo/peak-outfitters/daily-metrics";
import { peakOutfittersAttributionEvents } from "@/lib/demo/peak-outfitters/attribution";
import { peakOutfittersCustomerSnapshot } from "@/lib/demo/peak-outfitters/customers";
import { peakOutfittersCommerceOrders } from "@/lib/demo/peak-outfitters/orders";
import type { ProfitOrderRollups } from "@/lib/connectors/types";

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

const strugglingScenario = getDemoScenario("struggling");

const prevRevenue = Math.round(
  strugglingScenario.revenue30d / (1 + strugglingScenario.revenueChangePct / 100),
);
const prevOrders = Math.round(
  strugglingScenario.orders30d / (1 + strugglingScenario.revenueChangePct / 100),
);

export function buildStrugglingStoreSnapshot(): StoreSnapshot {
  const adSpendSnapshot = buildAdSpendSnapshot({
    metaCampaigns: PEAK_OUTFITTERS_META_CAMPAIGNS,
    metaAccountRollups: scaleCampaignSpendToRollups(PEAK_OUTFITTERS_META_CAMPAIGNS),
  });
  const dailyMetrics: DailyMetricPoint[] = peakOutfittersDailyMetrics();

  const productOrderStats: NonNullable<StoreSnapshot["productOrderStats"]> = {};
  for (const p of PEAK_OUTFITTERS_PRODUCTS) {
    productOrderStats[p.id] = estimateProductOrderStats(p.id, p.unitsSold30d, p.revenue30d);
  }

  return {
    source: "demo",
    demoScenario: "struggling",
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
    adSpendSnapshot,
    dailyMetrics,
    metaAccountRollups: scaleCampaignSpendToRollups(PEAK_OUTFITTERS_META_CAMPAIGNS),
    productOrderStats,
    commerceOrders: peakOutfittersCommerceOrders(),
    attributionEvents: peakOutfittersAttributionEvents(),
    customerSnapshot: peakOutfittersCustomerSnapshot(),
  };
}
