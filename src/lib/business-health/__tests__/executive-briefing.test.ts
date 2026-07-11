import { describe, expect, it } from "vitest";
import { buildHealthExecutiveSummary } from "../executive-summary";
import { interpretBenchmarkPercentile } from "../domain-guidance";
import { buildScoreBreakdown } from "../score-breakdown";

describe("buildHealthExecutiveSummary", () => {
  it("writes executive briefing instead of risk-count headline", () => {
    const summary = buildHealthExecutiveSummary({
      overallScore: 41,
      risk: {
        categories: [],
        primaryRisk: {
          category: "inventory",
          title: "Stockout Risk",
          reason: "Inventory has reached zero while advertising continues to spend budget.",
          businessImpact: "Critical",
          confidencePct: 90,
          supportingFactors: [],
        },
        recommendationSteps: [],
        estimatedExposure: { items: [], totalMonthly: 3000 },
      },
      domains: [
        {
          id: "inventory",
          label: "Inventory",
          score: 20,
          status: "critical",
          currentSituation: "All tracked inventory is out of stock.",
          whyItMatters: "Ads cannot convert.",
          recommendedAction: "Replenish top-selling SKUs.",
          expectedOutcome: "Recover revenue.",
          financialImpactType: "revenue_increase",
          estimatedImpact: "+$3,000/month",
          estimatedImpactMonthly: 3000,
          inactionConsequence: null,
          trend: { windowLabel: "30-Day Trend", direction: "stable", label: "Stable", deltaPoints: null },
        },
      ],
      biggestOpportunity: "Restock",
      criticalCount: 2,
    });

    expect(summary.headline).toBe("Executive Summary");
    expect(summary.briefingParagraphs[0]).toContain("41/100");
    expect(summary.briefingParagraphs[1]).toMatch(/inventory/i);
    expect(summary.highestPriority).toMatch(/inventory/i);
  });
});

describe("interpretBenchmarkPercentile", () => {
  it("labels top performers as strengths", () => {
    const result = interpretBenchmarkPercentile("Average Order Value", 95);
    expect(result.kind).toBe("strength");
    expect(result.text).toMatch(/top 5%/i);
  });

  it("labels low percentiles as weaknesses", () => {
    const result = interpretBenchmarkPercentile("Profit", 5);
    expect(result.kind).toBe("weakness");
    expect(result.text).toMatch(/95%/);
  });
});

describe("buildScoreBreakdown", () => {
  it("includes weight percentages that sum to 100", () => {
    const breakdown = buildScoreBreakdown([
      { id: "profit", label: "Profit", score: 25 },
      { id: "inventory", label: "Inventory", score: 30 },
      { id: "marketing", label: "Marketing", score: 20 },
      { id: "customers", label: "Customers", score: 15 },
      { id: "cash-flow", label: "Cash Flow", score: 10 },
    ]);
    const total = breakdown.reduce((s, r) => s + r.weightPct, 0);
    expect(total).toBe(100);
    expect(breakdown.find((r) => r.id === "inventory")?.weightPct).toBe(30);
  });
});
