import type { MetaCampaign, ProfitOrderRollups, StoreSnapshot } from "@/lib/connectors/types";
import { buildAdSpendSnapshot } from "@/lib/ads/spend";
import { DEMO_STORE_SNAPSHOT } from "@/lib/connectors/demo-data";
import { mergeIntegrationIntoSnapshot } from "@/lib/integrations/engine";

export const ORDER_SCALE_TARGETS = [100, 1_000, 5_000, 50_000] as const;

export function profitRollupsForOrders(orders: number, aov = 78.84): ProfitOrderRollups {
  const revenue30d = Math.round(orders * aov * 100) / 100;
  const cogs = Math.round(revenue30d * 0.42);
  const shipping = Math.round(orders * 6.5);
  const refunds = Math.round(revenue30d * 0.02);
  const dailyRev = revenue30d / 30;
  const dailyCogs = cogs / 30;
  const dailyShip = shipping / 30;
  const dailyRefunds = refunds / 30;
  const dailyOrders = orders / 30;

  const bucket = (mult: number) => ({
    revenue: Math.round(dailyRev * mult * 100) / 100,
    cogs: Math.round(dailyCogs * mult * 100) / 100,
    shipping: Math.round(dailyShip * mult * 100) / 100,
    refunds: Math.round(dailyRefunds * mult * 100) / 100,
    orders: Math.round(dailyOrders * mult),
  });

  return {
    today: bucket(1),
    yesterday: bucket(0.95),
    last7d: bucket(7),
    last30d: { revenue: revenue30d, cogs, shipping, refunds, orders },
  };
}

function scaledCampaigns(orders: number): MetaCampaign[] {
  const factor = orders / 612;
  return DEMO_STORE_SNAPSHOT.campaigns.map((c) => ({
    ...c,
    spend7d: Math.round(c.spend7d * factor * 100) / 100,
    revenue7d: Math.round(c.revenue7d * factor * 100) / 100,
    impressions7d: Math.round(c.impressions7d * factor),
  }));
}

/** Synthetic snapshot at a given order volume for performance & accuracy tests */
export function buildScaledStoreSnapshot(orderCount: number): StoreSnapshot {
  const aov = 78.84;
  const revenue30d = Math.round(orderCount * aov * 100) / 100;
  const campaigns = scaledCampaigns(orderCount);
  const adSpendSnapshot = buildAdSpendSnapshot({ metaCampaigns: campaigns });

  let snapshot: StoreSnapshot = {
    ...DEMO_STORE_SNAPSHOT,
    syncedAt: new Date().toISOString(),
    storeMetrics: {
      revenue30d,
      orders30d: orderCount,
      aov30d: aov,
      conversionRate30d: 2.4,
    },
    profitRollups: profitRollupsForOrders(orderCount, aov),
    campaigns,
    adSpendSnapshot,
    products: DEMO_STORE_SNAPSHOT.products.map((p) => ({
      ...p,
      unitsSold30d: Math.max(1, Math.round(p.unitsSold30d * (orderCount / 612))),
      revenue30d: Math.round(p.revenue30d * (orderCount / 612) * 100) / 100,
    })),
  };

  snapshot = mergeIntegrationIntoSnapshot(snapshot);
  return snapshot;
}

/** Known manual calculation fixture — exact expected net profit (30d) */
export type ManualProfitFixture = {
  label: string;
  rollups: ProfitOrderRollups;
  adSpend30d: number;
  operationalCost30d: number;
  expectedNetProfit30d: number;
};

export const MANUAL_PROFIT_FIXTURES: ManualProfitFixture[] = [
  {
    label: "Standard 612-order store",
    rollups: profitRollupsForOrders(612),
    adSpend30d: 4200,
    operationalCost30d: 580,
    expectedNetProfit30d: 0, // computed at runtime
  },
  {
    label: "Small 100-order store",
    rollups: profitRollupsForOrders(100),
    adSpend30d: 680,
    operationalCost30d: 95,
    expectedNetProfit30d: 0,
  },
  {
    label: "Large 5000-order store",
    rollups: profitRollupsForOrders(5000),
    adSpend30d: 34200,
    operationalCost30d: 4750,
    expectedNetProfit30d: 0,
  },
];
