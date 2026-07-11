import { describe, expect, it } from "vitest";
import { enrichConversationalResponse } from "../conversational-enrichment";
import { formatCopilotMessage } from "../response";
import type { CopilotStructuredResponse } from "../types";

const mockBundle = {
  snapshot: {
    products: [{ id: "1" }],
    campaigns: [{ name: "Prospecting – Core", roas7d: 0.6, spend7d: 2860, revenue7d: 1705 }],
    storeMetrics: { revenue30d: 10000, orders30d: 50, aov30d: 200, conversionRate30d: 2 },
    googleAdsSnapshot: { campaigns: [], rollups: { last7d: { spend: 0, revenue: 0 } } },
  },
  context: {
    profitDashboard: {
      primary: { revenue: 10000, netProfit: -500 },
      blendedRoas: { blendedRoas30d: 0.6, metaRoas30d: 0.6 },
    },
    hasActiveMetaCampaigns: true,
    campaigns: [],
    activeRecommendations: [],
  },
  storeManager: {
    trends: { metrics: [] },
    opportunityFeed: Array.from({ length: 8 }, (_, i) => ({
      id: `opp-${i}`,
      title: `Opportunity ${i}`,
      recommendation: "Fix it",
      expectedImpact: { revenueMonthly: 1000, profitMonthly: 400 },
      confidence: 0.8,
      source: "insights",
    })),
    priorityQueue: [],
  },
} as unknown as import("../data").CopilotDataBundle;

const baseStructured: CopilotStructuredResponse = {
  title: "Advertising efficiency declined",
  summary:
    "Advertising efficiency has fallen below the break-even threshold.",
  evidence: [{ label: "ROAS", value: "0.60" }],
  confidencePct: 88,
  recommendations: [
    {
      action: "Pause lowest-performing ad sets",
      detail:
        "Pause only the lowest-performing ad sets in **Prospecting – Core** instead of pausing the entire campaign.",
      available: false,
    },
    {
      action: "Refresh prospecting creatives",
      detail: "Test new creative angles in **Prospecting – Core**.",
      available: false,
    },
    {
      action: "Reduce prospecting budget 25%",
      detail: "Trim spend in **Prospecting – Core** after creative tests.",
      available: false,
    },
  ],
  businessImpact: {
    monthlyProfit: 21016,
    label: "+$21,016/mo",
    calculable: true,
  },
  relatedInsights: [],
  dataSourcesUsed: ["meta_ads", "profit", "shopify", "google_ads"],
  intent: "roas_decrease",
};

describe("enrichConversationalResponse", () => {
  it("uses executive tone and limits to 3 visible actions", () => {
    const enriched = enrichConversationalResponse(baseStructured, mockBundle);
    const conv = enriched.conversational!;

    expect(conv.shortAnswer).toMatch(/biggest opportunity|Prospecting/i);
    expect(conv.prioritizedRecommendations).toHaveLength(3);
    expect(conv.remainingOpportunityCount).toBe(5);
    expect(conv.followUpQuestion.length).toBeGreaterThan(0);
  });

  it("does not double-count financial impact across priorities", () => {
    const enriched = enrichConversationalResponse(baseStructured, mockBundle);
    const conv = enriched.conversational!;

    expect(conv.financialImpact.combinedNetMonthly).toBeLessThan(21016);
    expect(conv.financialImpact.overlapNote).toMatch(/not additive/i);
    expect(conv.prioritizedRecommendations[1]?.includedInCombined).toBe(true);
    expect(conv.prioritizedRecommendations[1]?.expectedFinancialImpact).toMatch(/Included in combined/i);
  });

  it("formats plain text without duplicate executive recommendation", () => {
    const enriched = enrichConversationalResponse(baseStructured, mockBundle);
    const text = formatCopilotMessage(enriched);
    expect(text).toContain("Direct answer");
    expect(text).not.toContain("Executive Recommendation");
    expect(text).not.toContain("Advertising efficiency declined");
  });

  it("returns wait analysis mode without repeating full recommendation", () => {
    const enriched = enrichConversationalResponse(
      baseStructured,
      mockBundle,
      "What happens if I wait one week?",
    );
    const conv = enriched.conversational!;

    expect(conv.mode).toBe("wait");
    expect(conv.waitAnalysis.unnecessarySpend).toBeTruthy();
    expect(conv.prioritizedRecommendations).toHaveLength(0);
    expect(conv.followUpQuestion).toMatch(/first/i);
  });

  it("returns why-priority mode with ranking explanation", () => {
    const enriched = enrichConversationalResponse(
      baseStructured,
      mockBundle,
      "Why is this the top priority?",
    );
    const conv = enriched.conversational!;

    expect(conv.mode).toBe("why_priority");
    expect(conv.whyFirstPriority.length).toBeGreaterThan(2);
    expect(conv.prioritizedRecommendations).toHaveLength(1);
  });

  it("includes trade-offs, next step, and why-not alternatives", () => {
    const enriched = enrichConversationalResponse(baseStructured, mockBundle);
    const conv = enriched.conversational!;

    expect(conv.tradeOff.upsideValue).toMatch(/\+/);
    expect(conv.tradeOff.downsideValue.length).toBeGreaterThan(10);
    expect(conv.nextStep.length).toBeGreaterThan(20);
    expect(conv.whyNotAlternatives.length).toBeGreaterThan(0);
    expect(conv.confidence.basis).toContain("Complete Shopify order history");
  });
});
