import { describe, expect, it } from "vitest";
import {
  buildValidatedStoreInsight,
  collectInsightMetrics,
  generatePrimaryStoreInsight,
  validateInsightTitle,
} from "@/lib/copilot/insight-engine";
import type { StoreSnapshot } from "@/lib/connectors/types";

function snapshotWithCampaigns(): StoreSnapshot {
  return {
    syncedAt: new Date().toISOString(),
    storeMetrics: { revenue30d: 120_000, orders30d: 400, aov30d: 300, conversionRate30d: 2.1 },
    salesTrends: {
      thisWeek: { revenue: 28_000, orders: 95 },
      lastWeek: { revenue: 26_667, orders: 90 },
      last30Days: { revenue: 120_000, orders: 400 },
      previous30Days: { revenue: 105_600, orders: 360 },
    },
    campaigns: [
      {
        id: "c1",
        name: "Prospecting – Core",
        spend7d: 1800,
        revenue7d: 900,
        roas7d: 0.5,
        ctr7d: 1.2,
        impressions7d: 50000,
        frequency7d: 2.1,
        effectiveStatus: "ACTIVE",
      },
      {
        id: "c2",
        name: "Retargeting – Warm",
        spend7d: 1060,
        revenue7d: 805,
        roas7d: 0.76,
        ctr7d: 2.4,
        impressions7d: 22000,
        frequency7d: 3.2,
        effectiveStatus: "ACTIVE",
      },
    ],
    products: [],
    collections: [],
    connectorStates: { shopify: "connected", meta_ads: "connected" },
    adSpendSnapshot: {
      totalRollups: {
        last7d: { spend: 2860, attributedRevenue: 1705 },
        last30d: { spend: 12000, attributedRevenue: 9000 },
        today: { spend: 400, attributedRevenue: 200 },
        yesterday: { spend: 380, attributedRevenue: 210 },
      },
    },
  } as unknown as StoreSnapshot;
}

describe("insight-engine", () => {
  it("never keeps a revenue-drop title when revenue trends are positive", () => {
    const metrics = {
      revenueWoW: 5,
      revenue30dChange: 13.6,
      revenue30d: 120_000,
      profit: -4000,
      spend7d: 2860,
      revenue7d: 1705,
      breakEvenRoas: 1.29,
      currentRoas: 0.6,
      inventoryHighRisk: false,
      hasSufficientHistory: true,
    };

    const validated = validateInsightTitle("Why did revenue drop?", metrics);
    expect(validated.metricsConflict).toBe(true);
    expect(validated.title).not.toMatch(/revenue drop/i);
  });

  it("selects advertising efficiency when revenue grows but ROAS is below break-even", () => {
    const metrics = {
      revenueWoW: 5,
      revenue30dChange: 13.6,
      revenue30d: 120_000,
      profit: -4000,
      spend7d: 2860,
      revenue7d: 1705,
      breakEvenRoas: 1.29,
      currentRoas: 0.6,
      inventoryHighRisk: false,
      hasSufficientHistory: true,
    };

    const insight = generatePrimaryStoreInsight({
      metrics,
      snapshot: snapshotWithCampaigns(),
      opportunities: [],
    });

    expect(insight.title).toBe("Advertising efficiency declined");
    expect(insight.summary).toContain("Revenue continues to grow");
    expect(insight.evidence.find((e) => e.label === "Revenue WoW")?.value).toBe("+5.0%");
    expect(insight.evidence.find((e) => e.label === "Revenue (30d)")?.value).toBe("+13.6%");
    expect(insight.evidence.find((e) => e.label === "Break-even ROAS")?.value).toBe("1.29");
    expect(insight.evidence.find((e) => e.label === "Current ROAS")?.value).toBe("0.60");
    expect(insight.recommendation).toContain("Prospecting – Core");
    expect(insight.recommendation).toContain("Retargeting – Warm");
    expect(insight.bottleneck).toBe("roas");
  });

  it("uses revenue drop title only when WoW decline exceeds threshold", () => {
    const insight = generatePrimaryStoreInsight({
      metrics: {
        revenueWoW: -8,
        revenue30dChange: -3,
        revenue30d: 80_000,
        profit: 2000,
        spend7d: 1000,
        revenue7d: 800,
        breakEvenRoas: 1.5,
        currentRoas: 0.8,
        inventoryHighRisk: false,
        hasSufficientHistory: true,
      },
      opportunities: [],
    });

    expect(insight.title).toBe("Why did revenue drop?");
  });

  it("collects metrics from snapshot and trends", () => {
    const snapshot = snapshotWithCampaigns();
    const metrics = collectInsightMetrics({
      snapshot,
      profitDashboard: {
        primary: {
          revenue: 120_000,
          netProfit: -4000,
          grossProfit: 48_000,
          adSpend: 12_000,
          profitMarginPct: -3.3,
          cogs: 72_000,
          shippingCost: 4000,
          transactionFees: 3000,
          refunds: 2000,
        },
        primaryProfit: { status: "estimated" },
        confidence: { scorePct: 82, status: "estimated", missingInputs: [], notice: null, inputs: [] },
        periods: [],
        blendedRoas: { blendedRoas30d: 0.6, metaRoas30d: 0.6, confidence: { level: "Medium" }, channels: [], periods: [], isAdvertisingProfitable: false },
      } as never,
      trends: null,
    });

    expect(metrics.revenueWoW).toBeCloseTo(5, 0);
    expect(metrics.revenue30dChange).toBeCloseTo(13.6, 0);
    expect(metrics.spend7d).toBe(2860);
    expect(metrics.revenue7d).toBe(1705);
  });

  it("builds end-to-end validated insight for growing revenue with inefficient ads", () => {
    const insight = buildValidatedStoreInsight({
      snapshot: snapshotWithCampaigns(),
      profitDashboard: {
        primary: {
          revenue: 120_000,
          netProfit: -4000,
          grossProfit: 48_000,
          adSpend: 12_000,
          profitMarginPct: -3.3,
          cogs: 72_000,
          shippingCost: 4000,
          transactionFees: 3000,
          refunds: 2000,
        },
        primaryProfit: { status: "estimated" },
        confidence: { scorePct: 82, status: "estimated", missingInputs: [], notice: null, inputs: [] },
        periods: [],
        blendedRoas: {
          blendedRoas30d: 0.6,
          metaRoas30d: 0.6,
          confidence: { level: "Medium" },
          channels: [],
          periods: [],
          isAdvertisingProfitable: false,
        },
      } as never,
    });

    expect(insight.title).toBe("Advertising efficiency declined");
    expect(insight.confidencePct).toBeGreaterThan(50);
  });
});
