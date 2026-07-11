import { buildAdSpendSnapshot, scaleCampaignSpendToRollups } from "@/lib/ads/spend";
import { estimateProductOrderStats } from "@/lib/products/enrich";
import type { DailyMetricPoint } from "@/lib/ads/types";
import type { MetaCampaign, ProfitOrderRollups, ShopifyProduct, StoreSnapshot } from "@/lib/connectors/types";
import { DEMO_COLLECTIONS, PEAK_OUTFITTERS } from "@/lib/demo/peak-outfitters/constants";
import { PEAK_OUTFITTERS_PRODUCTS } from "@/lib/demo/peak-outfitters/products";
import { peakOutfittersCommerceOrders } from "@/lib/demo/peak-outfitters/orders";
import { peakOutfittersCustomerSnapshot } from "@/lib/demo/peak-outfitters/customers";
import { peakOutfittersAttributionEvents } from "@/lib/demo/peak-outfitters/attribution";
import type { DemoScenarioDefinition } from "@/lib/demo/scenarios/types";
import type { AttributionEvent } from "@/lib/attribution/models";
import type { CustomerSnapshot } from "@/lib/customers/types";

function scaleAttributionEvents(scenario: DemoScenarioDefinition): AttributionEvent[] {
  const base = peakOutfittersAttributionEvents();
  const orderScale = scenario.orders30d / PEAK_OUTFITTERS.orders30d;
  const valueScale = scenario.aov / PEAK_OUTFITTERS.aov;
  const keep = Math.max(8, Math.min(base.length, Math.round(base.length * orderScale)));
  return base.slice(0, keep).map((event) => ({
    ...event,
    orderValue: Math.round(event.orderValue * valueScale * 100) / 100,
  }));
}

function scaleCustomerSnapshot(scenario: DemoScenarioDefinition): CustomerSnapshot {
  const base = peakOutfittersCustomerSnapshot();
  const ratio = scenario.revenue30d / PEAK_OUTFITTERS.revenue30d;
  const customerKeep = Math.max(12, Math.min(base.customers.length, Math.round(base.customers.length * ratio)));
  return {
    ...base,
    orders30d: scenario.orders30d,
    totalCustomers: Math.max(customerKeep, Math.round(base.totalCustomers * ratio)),
    newCustomers30d: Math.max(1, Math.round(base.newCustomers30d * ratio)),
    returningCustomers30d: Math.max(1, Math.round(base.returningCustomers30d * ratio)),
    aov: scenario.aov,
    customers: base.customers.slice(0, customerKeep).map((c) => ({
      ...c,
      lifetimeRevenue: Math.round(c.lifetimeRevenue * ratio * 100) / 100,
      ordersCount: Math.max(1, Math.round(c.ordersCount * ratio)),
    })),
  };
}

function scaleProducts(
  products: ShopifyProduct[],
  targetRevenue: number,
  scenario: DemoScenarioDefinition,
): ShopifyProduct[] {
  const baseRevenue = products.reduce((s, p) => s + p.revenue30d, 0) || 1;
  const scale = targetRevenue / baseRevenue;
  const heroes = [...products].sort((a, b) => b.unitsSold30d - a.unitsSold30d);

  return products.map((p, i) => {
    const unitsSold30d = Math.max(1, Math.round(p.unitsSold30d * scale));
    const revenue30d = Math.round(p.price * unitsSold30d * 100) / 100;
    let inventoryQuantity = p.inventoryQuantity;

    if (scenario.inventoryRisk === "high" && scenario.lowStockHeroSkus) {
      const heroIndex = heroes.findIndex((h) => h.id === p.id);
      if (heroIndex >= 0 && heroIndex < scenario.lowStockHeroSkus) {
        inventoryQuantity = Math.max(2, Math.min(5, Math.round(unitsSold30d / 20)));
      }
    }

    if (scenario.inventoryRisk === "low") {
      inventoryQuantity = Math.max(inventoryQuantity, Math.round(unitsSold30d * 1.5));
    }

    return {
      ...p,
      unitsSold30d,
      revenue30d,
      inventoryQuantity,
      cartAdds30d: Math.round(unitsSold30d * 1.8),
    };
  });
}

function buildCampaigns(
  scenario: DemoScenarioDefinition,
  personality: DemoScenarioDefinition["personality"],
): MetaCampaign[] {
  const metaRoas =
    scenario.metaSpend7d > 0 ? scenario.metaRevenue7d / scenario.metaSpend7d : 0;
  const splits =
    personality === "growth"
      ? [
          { name: "Google Search — Winners", share: 0.35, roasMult: 1.15 },
          { name: "Prospecting — Lookalike", share: 0.3, roasMult: 1.05 },
          { name: "Retargeting — Cart", share: 0.2, roasMult: 1.2 },
          { name: "Brand — Community", share: 0.15, roasMult: 1.1 },
        ]
      : personality === "operations" || personality === "seasonal"
        ? [
            { name: "Seasonal Prospecting", share: 0.4, roasMult: 1.0 },
            { name: "Retargeting — High Intent", share: 0.25, roasMult: 1.1 },
            { name: "Google Shopping", share: 0.2, roasMult: 0.95 },
            { name: "Brand Awareness", share: 0.15, roasMult: 0.85 },
          ]
        : [
            { name: "Prospecting Broad", share: 0.45, roasMult: 0.55 },
            { name: "Instagram Stories", share: 0.25, roasMult: 0.7 },
            { name: "Spring Collection", share: 0.2, roasMult: 0.9 },
            { name: "Retargeting", share: 0.1, roasMult: 1.1 },
          ];

  return splits.map((split, i) => {
    const spend7d = Math.round(scenario.metaSpend7d * split.share);
    const roas7d = Math.round(metaRoas * split.roasMult * 100) / 100;
    const revenue7d = Math.round(spend7d * roas7d);
    const profit7d = Math.round(revenue7d * 0.35 - spend7d);
    return {
      id: `demo-${scenario.id}-meta-${i}`,
      name: split.name,
      status: "ACTIVE" as const,
      effectiveStatus: "ACTIVE" as const,
      metaEffectiveStatus: "ACTIVE" as const,
      objective: "OUTCOME_SALES",
      spend7d,
      revenue7d,
      roas7d,
      profit7d,
      ctr7d: personality === "growth" ? 2.6 : 1.4,
      frequency7d: personality === "seasonal" ? 2.2 : 1.8,
      impressions7d: spend7d * 90,
      clicks7d: Math.round(spend7d * 1.2),
      conversions7d: Math.max(1, Math.round(revenue7d / scenario.aov)),
    };
  });
}

function buildProfitRollups(scenario: DemoScenarioDefinition, products: ShopifyProduct[]): ProfitOrderRollups {
  const cogs = products.reduce(
    (s, p) => s + (p.unitCost ?? p.price * 0.38) * p.unitsSold30d,
    0,
  );
  const shipping = Math.round(scenario.orders30d * 7.5);
  const refunds = Math.round(scenario.revenue30d * 0.018);
  const bucket = (factor: number) => ({
    revenue: Math.round(scenario.revenue30d * factor * 100) / 100,
    cogs: Math.round(cogs * factor * 100) / 100,
    shipping: Math.round(shipping * factor * 100) / 100,
    refunds: Math.round(refunds * factor * 100) / 100,
    orders: Math.max(1, Math.round(scenario.orders30d * factor)),
  });
  return {
    today: bucket(1 / 30),
    yesterday: bucket(1 / 30),
    last7d: bucket(7 / 30),
    last30d: bucket(1),
  };
}

function buildDailyMetrics(scenario: DemoScenarioDefinition): DailyMetricPoint[] {
  const days = 90;
  const dailyRev = scenario.revenue30d / 30;
  const dailySpend = (scenario.metaSpend7d + scenario.googleSpend7d) / 7;
  const seasonalBoost = scenario.personality === "seasonal" ? 1.8 : 1;

  return Array.from({ length: days }, (_, i) => {
    const dayOffset = days - 1 - i;
    const date = new Date(Date.now() - dayOffset * 86400000).toISOString().slice(0, 10);
    const seasonal =
      scenario.personality === "seasonal" && dayOffset < 30 ? seasonalBoost : 0.55;
    const wave = 0.85 + Math.sin(i / 5) * 0.08;
    return {
      date,
      revenue: Math.round(dailyRev * seasonal * wave),
      orders: Math.max(1, Math.round((scenario.orders30d / 30) * seasonal * wave)),
      adSpend: Math.round(dailySpend * wave * 100) / 100,
    };
  });
}

export function buildParameterizedDemoSnapshot(scenario: DemoScenarioDefinition): StoreSnapshot {
  const products = scaleProducts(PEAK_OUTFITTERS_PRODUCTS, scenario.revenue30d, scenario);
  const campaigns = buildCampaigns(scenario, scenario.personality);
  const adSpendSnapshot = buildAdSpendSnapshot({
    metaCampaigns: campaigns,
    metaAccountRollups: scaleCampaignSpendToRollups(campaigns),
  });
  const dailyMetrics = buildDailyMetrics(scenario);

  const prevRevenue =
    scenario.previous30Revenue ??
    Math.round(scenario.revenue30d / (1 + scenario.revenueChangePct / 100));
  const prevOrders = Math.round(scenario.orders30d / (1 + scenario.revenueChangePct / 100));

  const productOrderStats: NonNullable<StoreSnapshot["productOrderStats"]> = {};
  for (const p of products) {
    productOrderStats[p.id] = estimateProductOrderStats(p.id, p.unitsSold30d, p.revenue30d);
  }

  const baseOrders = peakOutfittersCommerceOrders();
  const orderScale = scenario.orders30d / Math.max(1, PEAK_OUTFITTERS_PRODUCTS.reduce((s, p) => s + p.unitsSold30d, 0) / 30);

  return {
    source: "demo",
    demoScenario: scenario.id,
    commerceStoreDomain: `${scenario.id}.demo.storepilot.ai`,
    syncedAt: new Date().toISOString(),
    connectorStates: { shopify: "demo", meta_ads: "demo", google_ads: "demo" },
    storeMetrics: {
      revenue30d: scenario.revenue30d,
      orders30d: scenario.orders30d,
      aov30d: scenario.aov,
      conversionRate30d: scenario.conversionRatePct,
    },
    salesTrends: {
      thisWeek: {
        revenue: Math.round(scenario.revenue30d * 0.26),
        orders: Math.round(scenario.orders30d * 0.26),
        aov: scenario.aov,
      },
      lastWeek: {
        revenue: Math.round(scenario.revenue30d * 0.24),
        orders: Math.round(scenario.orders30d * 0.24),
        aov: scenario.aov,
      },
      last30Days: {
        revenue: scenario.revenue30d,
        orders: scenario.orders30d,
        aov: scenario.aov,
      },
      previous30Days: {
        revenue: prevRevenue,
        orders: Math.max(1, prevOrders),
        aov: Math.round((prevRevenue / Math.max(1, prevOrders)) * 100) / 100,
      },
    },
    profitRollups: buildProfitRollups(scenario, products),
    products,
    collections: DEMO_COLLECTIONS.map((c) => ({
      id: `gid://shopify/Collection/${c.id}`,
      title: c.title,
      productCount: c.productCount,
      homepageFeatured: c.homepageFeatured,
      revenue30d: Math.round(c.revenue30d * (scenario.revenue30d / 184_250)),
    })),
    campaigns,
    adSpendSnapshot,
    dailyMetrics,
    metaAccountRollups: scaleCampaignSpendToRollups(campaigns),
    productOrderStats,
    commerceOrders: baseOrders.slice(0, Math.min(baseOrders.length, Math.round(40 * orderScale))),
    attributionEvents: scaleAttributionEvents(scenario),
    customerSnapshot: scaleCustomerSnapshot(scenario),
  };
}
