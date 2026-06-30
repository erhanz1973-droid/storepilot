import { describe, expect, it } from "vitest";
import { DEMO_STORE_SNAPSHOT } from "@/lib/connectors/demo-data";
import { buildCommerceOpportunities } from "@/lib/insights/engine";
import { buildCommerceDailyBrief } from "@/lib/insights/daily-brief";
import { buildExecutiveSummary } from "@/lib/insights/executive-summary";
import { buildMetaAdsInsights } from "@/lib/insights/meta-ads";
import { buildShopifyInsights } from "@/lib/insights/shopify";
import { hasValidEvidence } from "@/lib/insights/registry";
import { sortCommerceOpportunities } from "@/lib/insights/opportunity-schema";
import { buildPriorityQueue, generateDailyQuestion } from "@/lib/insights/priority";
import { buildTrendAnalysis } from "@/lib/insights/trends";

describe("AI Commerce Advisor engine", () => {
  it("produces prioritized opportunities with confidence and why", () => {
    const snapshot = {
      ...DEMO_STORE_SNAPSHOT,
      googleAdsSnapshot: {
        campaigns: [
          {
            id: "g1",
            name: "Wasted Spend Campaign",
            type: "search" as const,
            status: "ENABLED",
            spend7d: 500,
            revenue7d: 0,
            roas7d: 0,
            impressions7d: 10000,
            clicks7d: 200,
            conversions7d: 0,
          },
        ],
        adGroups: [],
        keywords: [],
        searchTerms: [],
        rollups: {
          today: { spend: 80, attributedRevenue: 0, orders: 0 },
          yesterday: { spend: 70, attributedRevenue: 0, orders: 0 },
          last7d: { spend: 500, attributedRevenue: 0, orders: 0 },
          last30d: { spend: 1800, attributedRevenue: 200, orders: 0 },
        },
        dailySpend: [],
      },
      connectorStates: {
        ...DEMO_STORE_SNAPSHOT.connectorStates,
        google_ads: "connected" as const,
      },
    };

    const opportunities = buildCommerceOpportunities(snapshot);
    expect(opportunities.length).toBeGreaterThan(0);
    const zeroConv = opportunities.find((o) => o.id.includes("zero-conv"));
    expect(zeroConv?.severity).toBe("critical");
    expect(zeroConv?.confidence).toBeGreaterThanOrEqual(90);
    expect(zeroConv?.why.length).toBeGreaterThan(0);
    expect(zeroConv?.futureAction).toBe("pause_campaign");

    const sorted = sortCommerceOpportunities(opportunities);
    expect(["critical", "high"]).toContain(sorted[0]?.severity);
  });

  it("builds priority queue, executive summary, and daily brief", () => {
    const snapshot = DEMO_STORE_SNAPSHOT;
    const opportunities = buildCommerceOpportunities(snapshot);
    const trends = buildTrendAnalysis(snapshot);
    const queue = buildPriorityQueue(opportunities, [], []);
    const question = generateDailyQuestion(queue, opportunities);
    const executive = buildExecutiveSummary({
      snapshot,
      opportunities,
      dataSources: [],
      trends,
    });
    const brief = buildCommerceDailyBrief({ trends, opportunities, snapshot });

    expect(question.length).toBeGreaterThan(10);
    expect(queue[0]?.priority).toBeDefined();
    expect(executive.headline).toBeTruthy();
    expect(brief.bullets.length).toBeGreaterThan(0);
  });

  it("builds trend analysis from daily metrics", () => {
    const trends = buildTrendAnalysis({
      ...DEMO_STORE_SNAPSHOT,
      dailyMetrics: Array.from({ length: 20 }, (_, i) => ({
        date: `2026-06-${String(i + 1).padStart(2, "0")}`,
        revenue: 1000 + i * 20,
        adSpend: 300 + i * 15,
        orders: 10 + i,
      })),
    });
    expect(trends.metrics.length).toBeGreaterThan(0);
    expect(trends.interpretation.length).toBeGreaterThan(10);
  });

  it("detects Meta creative fatigue and best audiences", () => {
    const metaInsights = buildMetaAdsInsights(DEMO_STORE_SNAPSHOT);
    expect(metaInsights.some((o) => o.id.includes("creative-fatigue"))).toBe(true);
    expect(metaInsights.some((o) => o.id.includes("best-audience"))).toBe(true);
  });

  it("detects grouped Shopify dead inventory business action", () => {
    const shopifyInsights = buildShopifyInsights(DEMO_STORE_SNAPSHOT);
    const deadInv = shopifyInsights.find((o) => o.id === "shop-dead-inventory-clearance");
    expect(deadInv).toBeDefined();
    expect(deadInv?.title).toBe("Dead inventory");
    expect(deadInv?.isGroupedAction).toBe(true);
    expect(deadInv?.affectedEntities).toHaveLength(4);
    expect(deadInv?.executionParams?.productIds).toHaveLength(4);
    expect(deadInv?.supportingMetrics.find((m) => m.label === "Products affected")?.value).toBe("4");
    expect(shopifyInsights.some((o) => o.id.startsWith("shop-dead-inv-"))).toBe(false);
  });

  it("detects Shopify cart abandonment", () => {
    const shopifyInsights = buildShopifyInsights(DEMO_STORE_SNAPSHOT);
    expect(shopifyInsights.some((o) => o.id.includes("cart-abandon"))).toBe(true);
  });

  it("rejects opportunities without valid evidence", () => {
    const bad = {
      id: "bad",
      source: "shopify" as const,
      severity: "low" as const,
      confidence: 50,
      title: "Bad",
      description: "Bad",
      recommendation: "Bad",
      expectedImpact: { revenueMonthly: 0, profitMonthly: 0, label: "" },
      supportingMetrics: [{ label: "Data", value: "Insufficient synced metrics for full evidence" }],
      why: [{ label: "Data", value: "Insufficient synced metrics for full evidence" }],
      createdAt: new Date().toISOString(),
      priorityScore: 0,
      category: "pricing" as const,
    };
    expect(hasValidEvidence(bad)).toBe(false);
  });
});
