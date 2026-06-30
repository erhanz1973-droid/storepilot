import { describe, expect, it } from "vitest";
import { computeStoreHealthScore } from "@/lib/store-health/score";
import type { StoreSnapshot } from "@/lib/connectors/types";

const baseSnapshot: StoreSnapshot = {
  storeId: "test",
  syncedAt: new Date().toISOString(),
  products: [],
  campaigns: [],
  connectorStates: {},
  storeMetrics: { revenue30d: 50000, orders30d: 500, conversionRate30d: 0.025 },
  salesTrends: {
    last30Days: { revenue: 55000, orders: 520 },
    previous30Days: { revenue: 50000, orders: 480 },
    last7Days: { revenue: 12000, orders: 110 },
    previous7Days: { revenue: 11000, orders: 100 },
  },
};

describe("computeStoreHealthScore", () => {
  it("returns score between 0 and 100", () => {
    const result = computeStoreHealthScore({
      snapshot: baseSnapshot,
      profitDashboard: null,
      productIntelligence: null,
      attributionDashboard: null,
      activeRecommendations: [],
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("labels healthy stores above 85", () => {
    const result = computeStoreHealthScore({
      snapshot: baseSnapshot,
      profitDashboard: {
        primary: {
          revenue: 100000,
          netProfit: 35000,
          profitMarginPct: 35,
          adSpend: 15000,
          cogs: 40000,
          shipping: 5000,
          refunds: 2000,
        },
        kpis: [],
        byProduct: [],
        byCollection: [],
        byChannel: [],
        confidence: { score: 80, label: "High", factors: [] },
        blendedRoas: { blendedRoas30d: 2.5, dailySeries: [] },
      },
      productIntelligence: { products: [], heroes: [], hiddenWinners: [], losingMoney: [], inventoryRisk: [], productOpportunities: [], topProfitable: [], bestMargin: [], highestRoas: [], fastestGrowing: [], highestRefunds: [] },
      attributionDashboard: null,
      activeRecommendations: [],
    });
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.factors).toHaveLength(8);
  });

  it("generates score changes when previous factors provided", () => {
    const result = computeStoreHealthScore({
      snapshot: baseSnapshot,
      profitDashboard: null,
      productIntelligence: null,
      attributionDashboard: null,
      activeRecommendations: [],
      previousFactorScores: { revenue_trend: 40, blended_roas: 50 },
      previousScore: 60,
    });
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.previousScore).toBe(60);
  });
});
