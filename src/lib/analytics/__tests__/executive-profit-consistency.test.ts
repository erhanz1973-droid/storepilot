import { buildExecutiveAdvisorView } from "@/lib/analytics/executive-advisor";
import { assembleProfitPageView } from "@/lib/profit/profit-page-view";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { computeStoreHealthScore } from "@/lib/store-health/score";
import { describe, expect, it } from "vitest";

describe("executive vs profit page consistency", () => {
  const snapshot = getPeakOutfittersSnapshot();
  const profitDashboard = computeProfitDashboard(snapshot, [])!;

  function storeHealth() {
    return computeStoreHealthScore({
      snapshot,
      profitDashboard,
      productIntelligence: null,
      attributionDashboard: null,
      activeRecommendations: [],
    });
  }

  it("executive estimated profit matches profit page primary net profit", () => {
    const profitView = assembleProfitPageView(profitDashboard, snapshot, null);
    const executiveView = buildExecutiveAdvisorView({
      snapshot,
      profitDashboard,
      trends: null,
      decisions: [],
      activityFeed: [],
      autopilot: null,
      experienceInput: {
        snapshot,
        profitDashboard,
        decisions: [],
        opportunityFeed: [],
        priorityQueue: [],
        storeHealth: storeHealth(),
      },
    });

    expect(executiveView.executiveMode.estimatedProfit).toBe(
      profitView.aiSummary.estimatedNetProfit,
    );
    expect(executiveView.executiveMode.estimatedProfit).toBe(
      profitDashboard.primary.netProfit,
    );
  });
});
