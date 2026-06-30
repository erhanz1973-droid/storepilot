import { describe, expect, it } from "vitest";
import type { OutcomeRecord } from "@/lib/learning/outcome-types";
import type { RecommendationHistoryEntry } from "@/lib/types";
import {
  buildPerformanceDashboard,
  buildPerformanceRow,
  buildPerformanceSummary,
} from "../performance-dashboard";

function entry(
  partial: Partial<RecommendationHistoryEntry> & { id: string; title: string },
): RecommendationHistoryEntry {
  return {
    recommendationId: partial.id,
    status: "measured",
    expectedImpact: "+$2,605/month",
    confidenceScore: 0.87,
    createdAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    recommendation: {
      id: partial.id,
      category: "campaign_review",
      title: partial.title,
      severity: "high",
      reason: "ROAS below break-even",
      expectedImpact: "+$2,605/month",
      confidenceScore: 0.87,
      actionLabel: "Review",
      supportingMetrics: [],
      createdAt: new Date().toISOString(),
      status: "measured",
      predictionAccuracy: 93,
      actualImpact: "+$2,420/month",
      ...partial.recommendation,
    },
    ...partial,
  };
}

function outcome(recId: string): OutcomeRecord {
  return {
    id: "o1",
    storeId: "s1",
    recommendationId: recId,
    actionExecutionId: null,
    opportunityKey: null,
    decisionId: null,
    title: "Reduce Prospecting Budget",
    category: "campaign_review",
    actionType: "pause_campaign",
    entityType: "campaign",
    entityId: "c1",
    entityName: "Prospecting",
    baselineCapturedAt: new Date().toISOString(),
    measureDueAt: new Date().toISOString(),
    measuredAt: new Date().toISOString(),
    measurementWindowDays: 14,
    measureStatus: "completed",
    expectedMonthlyImpact: 2605,
    actualMonthlyImpact: 2420,
    predictionAccuracy: 93,
    outcomeRating: "successful",
    confidenceLabel: "high",
    baselineMetrics: {},
    outcomeMetrics: {},
    kpiDeltas: [
      { label: "ROAS", before: "0.61", after: "1.12", changePct: 84, improved: true },
      { label: "Ad Spend", before: "$4,200", after: "$3,190", changePct: -24, improved: true },
    ],
    outcomeSummary: "Profit improved while reducing wasted spend.",
    aiVerdict: "Pausing Prospecting reduced wasted ad spend without materially hurting revenue.",
    scoreBreakdown: {},
    failureReason: null,
  };
}

describe("buildPerformanceDashboard", () => {
  it("aggregates AI performance summary stats", () => {
    const entries = [
      entry({ id: "r1", title: "Reduce Prospecting Budget by 25%", status: "measured" }),
      entry({
        id: "r2",
        title: "Restock SKU",
        status: "ignored",
        recommendation: {
          id: "r2",
          category: "low_inventory",
          title: "Restock SKU",
          severity: "medium",
          reason: "Low stock",
          expectedImpact: "+$500/month",
          confidenceScore: 0.8,
          actionLabel: "Review",
          supportingMetrics: [],
          createdAt: new Date().toISOString(),
        },
      }),
    ];
    const outcomes = [outcome("r1")];
    const view = buildPerformanceDashboard(entries, outcomes);

    expect(view.summary.generated).toBe(2);
    expect(view.summary.approved).toBeGreaterThanOrEqual(1);
    expect(view.summary.rejected).toBe(1);
    expect(view.summary.aiAccuracyPct).toBe(93);
    expect(view.hasMeasuredOutcomes).toBe(true);
  });

  it("builds performance row with expected vs actual and learning", () => {
    const e = entry({ id: "r1", title: "Reduce Prospecting Budget by 25%" });
    const row = buildPerformanceRow(e, new Map([["r1", outcome("r1")]]));

    expect(row.expectedMonthlyProfit).toBe(2605);
    expect(row.actualMonthlyProfit).toBe(2420);
    expect(row.forecastAccuracyPct).toBe(93);
    expect(row.qualityLabel).toBe("Excellent");
    expect(row.learningFeedback).toContain("increased confidence");
    expect(row.metricDeltas.length).toBeGreaterThan(0);
  });

  it("computes improved profit percentage from outcomes", () => {
    const summary = buildPerformanceSummary(
      [entry({ id: "r1", title: "Test" })],
      [outcome("r1")],
    );
    expect(summary.improvedProfitPct).toBe(100);
  });
});
