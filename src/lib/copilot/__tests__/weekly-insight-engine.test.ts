import { describe, expect, it } from "vitest";
import {
  buildWeeklyChangeInsight,
  collectWeeklyChangeMetrics,
  generateWeeklyChangeInsight,
} from "@/lib/copilot/weekly-insight-engine";
import type { TrendAnalysis } from "@/lib/insights/types";
import type { StoreSnapshot } from "@/lib/connectors/types";

function trendsWithMetrics(
  metrics: TrendAnalysis["metrics"],
): TrendAnalysis {
  return {
    metrics,
    interpretation: "",
    generatedAt: new Date().toISOString(),
  };
}

function baseSnapshot(): StoreSnapshot {
  return {
    syncedAt: new Date().toISOString(),
    storeMetrics: { revenue30d: 100_000, orders30d: 350, aov30d: 285, conversionRate30d: 2.1 },
    campaigns: [
      { id: "c1", name: "Prospecting – Core", spend7d: 1500, revenue7d: 700, roas7d: 0.47, ctr7d: 1.1, impressions7d: 40000, frequency7d: 2, effectiveStatus: "ACTIVE" },
      { id: "c2", name: "Retargeting – Warm", spend7d: 900, revenue7d: 650, roas7d: 0.72, ctr7d: 2.2, impressions7d: 18000, frequency7d: 3, effectiveStatus: "ACTIVE" },
    ],
    products: [],
    collections: [],
    connectorStates: { shopify: "connected", meta_ads: "connected" },
  } as unknown as StoreSnapshot;
}

describe("weekly-insight-engine", () => {
  it("prioritizes marketing efficiency when spend outpaces revenue and conversion falls", () => {
    const trends = trendsWithMetrics([
      {
        id: "revenue_7d",
        label: "Revenue",
        window: "7d",
        current: 10870,
        previous: 10000,
        changePct: 8.7,
        direction: "up",
        unit: "currency",
      },
      {
        id: "spend_7d",
        label: "Ad Spend",
        window: "7d",
        current: 11760,
        previous: 10000,
        changePct: 17.6,
        direction: "up",
        unit: "currency",
      },
      {
        id: "conversion_rate_7d",
        label: "Conversion Rate",
        window: "7d",
        current: 2.1,
        previous: 2.23,
        changePct: -5.7,
        direction: "down",
        unit: "percent",
      },
    ]);

    const insight = generateWeeklyChangeInsight({
      snapshot: baseSnapshot(),
      trends,
      profitDashboard: {
        primary: {
          revenue: 100_000,
          grossProfit: 40_000,
          netProfit: -2000,
          adSpend: 10_000,
          profitMarginPct: -2,
          cogs: 60_000,
          shippingCost: 3000,
          transactionFees: 2500,
          refunds: 1500,
        },
        primaryProfit: { status: "estimated" },
        confidence: { scorePct: 80, status: "estimated", missingInputs: [], notice: null, inputs: [] },
        periods: [],
        blendedRoas: {
          blendedRoas30d: 0.85,
          metaRoas30d: 0.85,
          confidence: { level: "Medium" },
          channels: [],
          periods: [],
          isAdvertisingProfitable: false,
        },
      } as never,
    });

    expect(insight.title).toBe("Advertising spend outpaced revenue growth");
    expect(insight.summary).toContain("8.7%");
    expect(insight.summary).toContain("17.6%");
    expect(insight.summary).toContain("5.7%");
    expect(insight.summary).toContain("reduced advertising efficiency");
    expect(insight.whyItHappened).toContain("diminishing returns");
    expect(insight.bottleneck).toBe("roas");
    expect(insight.riskLevel).toBe("High");
    expect(insight.evidence.find((e) => e.label === "Revenue")?.value).toBe("+8.7%");
    expect(insight.evidence.find((e) => e.label === "Ad Spend")?.value).toBe("+17.6%");
    expect(insight.evidence.find((e) => e.label === "Conversion Rate")?.value).toBe("-5.7%");
    expect(insight.evidence.find((e) => e.label === "Risk")?.value).toBe("High");
    expect(insight.recommendation).toContain("Prospecting");
    expect(insight.recommendation).toContain("landing pages");
  });

  it("detects marketing efficiency deterioration when revenue falls and spend rises", () => {
    const insight = generateWeeklyChangeInsight({
      snapshot: baseSnapshot(),
      trends: trendsWithMetrics([
        {
          id: "revenue_7d",
          label: "Revenue",
          window: "7d",
          current: 9000,
          previous: 10000,
          changePct: -10,
          direction: "down",
          unit: "currency",
        },
        {
          id: "spend_7d",
          label: "Ad Spend",
          window: "7d",
          current: 11000,
          previous: 10000,
          changePct: 10,
          direction: "up",
          unit: "currency",
        },
      ]),
    });

    expect(insight.title).toBe("Marketing efficiency deteriorated");
  });

  it("detects healthy growth when revenue outpaces spend and profit is positive", () => {
    const insight = generateWeeklyChangeInsight({
      snapshot: baseSnapshot(),
      trends: trendsWithMetrics([
        {
          id: "revenue_7d",
          label: "Revenue",
          window: "7d",
          current: 12000,
          previous: 10000,
          changePct: 20,
          direction: "up",
          unit: "currency",
        },
        {
          id: "spend_7d",
          label: "Ad Spend",
          window: "7d",
          current: 10500,
          previous: 10000,
          changePct: 5,
          direction: "up",
          unit: "currency",
        },
        {
          id: "profit_7d",
          label: "Profit",
          window: "7d",
          current: 3000,
          previous: 2000,
          changePct: 50,
          direction: "up",
          unit: "currency",
        },
      ]),
      profitDashboard: {
        primary: { revenue: 100_000, netProfit: 5000, grossProfit: 40_000, adSpend: 8000, profitMarginPct: 5, cogs: 60_000, shippingCost: 2000, transactionFees: 2000, refunds: 1000 },
        primaryProfit: { status: "verified" },
        confidence: { scorePct: 90, status: "verified", missingInputs: [], notice: null, inputs: [] },
        periods: [],
        blendedRoas: { blendedRoas30d: 2.1, metaRoas30d: 2.1, confidence: { level: "High" }, channels: [], periods: [], isAdvertisingProfitable: true },
      } as never,
    });

    expect(insight.title).toBe("Healthy growth");
    expect(insight.riskLevel).toBe("Low");
  });

  it("never returns a single-metric-only fallback when multiple metrics exist", () => {
    const metrics = collectWeeklyChangeMetrics({
      snapshot: baseSnapshot(),
      trends: trendsWithMetrics([
        {
          id: "revenue_7d",
          label: "Revenue",
          window: "7d",
          current: 10500,
          previous: 10000,
          changePct: 5,
          direction: "up",
          unit: "currency",
        },
        {
          id: "spend_7d",
          label: "Ad Spend",
          window: "7d",
          current: 10800,
          previous: 10000,
          changePct: 8,
          direction: "up",
          unit: "currency",
        },
      ]),
    });

    const insight = buildWeeklyChangeInsight({
      snapshot: baseSnapshot(),
      trends: trendsWithMetrics([
        {
          id: "revenue_7d",
          label: "Revenue",
          window: "7d",
          current: 10500,
          previous: 10000,
          changePct: 5,
          direction: "up",
          unit: "currency",
        },
        {
          id: "spend_7d",
          label: "Ad Spend",
          window: "7d",
          current: 10800,
          previous: 10000,
          changePct: 8,
          direction: "up",
          unit: "currency",
        },
      ]),
    });

    expect(metrics.revenueChange).toBe(5);
    expect(insight.summary).toMatch(/revenue|ad spend/i);
    expect(insight.summary).not.toBe("Yesterday revenue increased 9%.");
  });
});
