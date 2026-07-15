import { describe, expect, it } from "vitest";
import { buildWeeklyBriefingReport } from "@/lib/reports/build-weekly-briefing";
import { DEMO_STORE_SNAPSHOT } from "@/lib/connectors/demo-data";
import type { DashboardSnapshot } from "@/lib/types";
import type { OutcomeRecord } from "@/lib/learning/outcome-types";

function baseDashboard(): DashboardSnapshot {
  return {
    syncedAt: new Date().toISOString(),
    storeMetrics: DEMO_STORE_SNAPSHOT.storeMetrics,
    topOpportunities: [
      {
        id: "1",
        title: "Fix ads",
        estimatedMonthlyNetProfitImpact: 1000,
        category: "campaign_review",
      } as DashboardSnapshot["topOpportunities"][number],
    ],
    aiPerformance: {
      predictionAccuracy: 80,
      measuredCount: 2,
      revenueInfluenced: 0,
      bestCategory: "campaign_review",
      bestCategoryLabel: "Campaigns",
    },
    weeklyReport: {
      generatedAt: new Date().toISOString(),
      revenue30d: 10000,
      profit30d: 2000,
      recommendationsMeasured: 2,
      recommendationsCompleted: 2,
      predictionAccuracy: 80,
      accuracyTrend: [{ week: "w1", accuracy: 70 }, { week: "w2", accuracy: 80 }],
      worstCampaigns: [],
      biggestOpportunities: [],
    },
  } as DashboardSnapshot;
}

describe("Financial Impact measured-first", () => {
  it("uses measured outcome totals instead of estimate ratios when outcomes exist", () => {
    const outcomes: OutcomeRecord[] = [
      {
        id: "o1",
        storeId: "demo-store",
        title: "Pause wasteful ads",
        category: "campaign_review",
        measureStatus: "completed",
        expectedMonthlyImpact: 400,
        actualMonthlyImpact: 320,
        outcomeRating: "successful",
        predictionAccuracy: 80,
        measurementWindowDays: 7,
        baselineCapturedAt: new Date().toISOString(),
        measureDueAt: new Date().toISOString(),
        measuredAt: new Date().toISOString(),
        baselineMetrics: {},
        outcomeMetrics: {},
      },
      {
        id: "o2",
        storeId: "demo-store",
        title: "Clear slow inventory",
        category: "slow_selling",
        measureStatus: "completed",
        expectedMonthlyImpact: 200,
        actualMonthlyImpact: 180,
        outcomeRating: "successful",
        predictionAccuracy: 90,
        measurementWindowDays: 7,
        baselineCapturedAt: new Date().toISOString(),
        measureDueAt: new Date().toISOString(),
        measuredAt: new Date().toISOString(),
        baselineMetrics: {},
        outcomeMetrics: {},
      },
    ];

    const report = buildWeeklyBriefingReport({
      dashboard: baseDashboard(),
      snapshot: DEMO_STORE_SNAPSHOT,
      outcomeRecords: outcomes,
    });

    const profitLine = report.financialImpact.lines.find((l) => l.label === "Profit recovered");
    expect(profitLine?.measuredMonthly).toBe(500);
    expect(profitLine?.estimatedMonthly).toBeGreaterThan(0);
  });

  it("leaves measured null when no outcome records exist", () => {
    const report = buildWeeklyBriefingReport({
      dashboard: {
        ...baseDashboard(),
        aiPerformance: {
          predictionAccuracy: 0,
          measuredCount: 0,
          revenueInfluenced: 0,
          bestCategory: "",
          bestCategoryLabel: "—",
        },
      },
      snapshot: DEMO_STORE_SNAPSHOT,
      outcomeRecords: [],
    });

    const profitLine = report.financialImpact.lines.find((l) => l.label === "Profit recovered");
    expect(profitLine?.measuredMonthly).toBeNull();
  });
});
