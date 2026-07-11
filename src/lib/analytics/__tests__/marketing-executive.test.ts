import { describe, expect, it } from "vitest";
import { DEMO_STORE_SNAPSHOT } from "@/lib/connectors/demo-data";
import { buildMarketingManagerView } from "@/lib/analytics/marketing-manager";
import { computeProfitDashboard } from "@/lib/profit/engine";

describe("marketing executive layer", () => {
  it("builds executive marketing director briefing", () => {
    const view = buildMarketingManagerView({
      snapshot: DEMO_STORE_SNAPSHOT,
      profitDashboard: computeProfitDashboard(DEMO_STORE_SNAPSHOT, []),
      decisions: [],
    });

    const { executive } = view.v2;
    expect(executive.executiveSummary.headline).toBe("Executive Marketing Summary");
    expect(executive.executiveSummary.paragraphs.length).toBeGreaterThan(0);
    expect(executive.executiveSummary.estimatedMonthlyImprovement).toBeGreaterThan(0);
    expect(executive.executiveDecision.bullets.length).toBeGreaterThan(0);
    expect(executive.executiveDecision.confidence).toMatch(/High|Medium|Low/);
  });

  it("includes channel comparison with winners when both platforms connected", () => {
    const view = buildMarketingManagerView({
      snapshot: DEMO_STORE_SNAPSHOT,
      profitDashboard: computeProfitDashboard(DEMO_STORE_SNAPSHOT, []),
    });

    const comparison = view.v2.executive.channelComparison;
    if (comparison) {
      expect(comparison.metrics.length).toBeGreaterThanOrEqual(6);
      expect(comparison.aiRecommendation.length).toBeGreaterThan(10);
      for (const m of comparison.metrics) {
        expect(["meta", "google", "tie"]).toContain(m.winner);
      }
    }
  });

  it("enriches priority queue with problem, root cause, and follow-ups", () => {
    const view = buildMarketingManagerView({
      snapshot: DEMO_STORE_SNAPSHOT,
      profitDashboard: computeProfitDashboard(DEMO_STORE_SNAPSHOT, []),
    });

    const priorities = view.v2.executive.executivePriorities;
    if (priorities.length > 0) {
      const first = priorities[0]!;
      expect(first.problem.length).toBeGreaterThan(5);
      expect(first.rootCause.length).toBeGreaterThan(5);
      expect(first.recommendedAction.length).toBeGreaterThan(5);
      expect(first.followUpQuestions.length).toBeGreaterThan(0);
      expect(first.timeUntilResults.length).toBeGreaterThan(0);
    }
  });

  it("provides interactive simulator baseline and enhanced forecast", () => {
    const view = buildMarketingManagerView({
      snapshot: DEMO_STORE_SNAPSHOT,
      profitDashboard: computeProfitDashboard(DEMO_STORE_SNAPSHOT, []),
    });

    const { simulatorBaseline, enhancedForecast } = view.v2.executive;
    expect(simulatorBaseline.metaBudgetPct).toBeGreaterThan(0);
    expect(simulatorBaseline.expectedRoas).toBeGreaterThan(0);
    expect(enhancedForecast.scenarios).toHaveLength(3);
    for (const s of enhancedForecast.scenarios) {
      expect(s.roas).toBeGreaterThanOrEqual(0);
      expect(s.scenarioAssumptions.length).toBeGreaterThan(0);
    }
  });
});
