import { describe, expect, it } from "vitest";
import { DEMO_STORE_SNAPSHOT } from "@/lib/connectors/demo-data";
import { buildMarketingManagerView } from "@/lib/analytics/marketing-manager";
import { computeProfitDashboard } from "@/lib/profit/engine";

describe("marketing manager view", () => {
  it("enriches campaigns with health and recommendations", () => {
    const profitDashboard = computeProfitDashboard(DEMO_STORE_SNAPSHOT, []);
    const view = buildMarketingManagerView({
      snapshot: DEMO_STORE_SNAPSHOT,
      profitDashboard,
      decisions: [],
    });

    expect(view.campaigns.length).toBeGreaterThan(0);
    const first = view.campaigns[0];
    expect(first.health).toBeDefined();
    expect(first.recommendation).toBeDefined();
    expect(first.profitMeta.status).toMatch(/verified|estimated|unavailable/);
    expect(first.shareOfSpendPct).toBeGreaterThanOrEqual(0);
  });

  it("builds platform summaries with scores for connected channels", () => {
    const view = buildMarketingManagerView({
      snapshot: DEMO_STORE_SNAPSHOT,
      profitDashboard: computeProfitDashboard(DEMO_STORE_SNAPSHOT, []),
    });

    const meta = view.platforms.find((p) => p.channel === "meta");
    expect(meta).toBeDefined();
    expect(meta!.label).toBe("Meta Ads");
    expect(meta!.aiSummary.length).toBeGreaterThan(10);
    expect(view.comparisons.meta.length).toBeGreaterThan(0);
    expect(view.forecast.estimatedSpend).toBeGreaterThan(0);
  });

  it("never uses dash for profit when estimated", () => {
    const view = buildMarketingManagerView({
      snapshot: DEMO_STORE_SNAPSHOT,
      profitDashboard: computeProfitDashboard(DEMO_STORE_SNAPSHOT, []),
    });
    for (const c of view.campaigns) {
      if (c.profitMeta.status !== "unavailable") {
        expect(c.profitMeta.value).not.toBeNull();
      }
    }
  });

  it("builds v2 AI marketing manager sections", () => {
    const view = buildMarketingManagerView({
      snapshot: DEMO_STORE_SNAPSHOT,
      profitDashboard: computeProfitDashboard(DEMO_STORE_SNAPSHOT, []),
      decisions: [],
    });

    expect(view.v2.brief.greeting).toMatch(/Good (morning|afternoon|evening)/);
    expect(view.v2.brief.lines.length).toBeGreaterThan(0);
    expect(view.v2.executive.executiveSummary.headline).toBe("Executive Marketing Summary");
    expect(view.v2.budgetAllocation.current.length).toBeGreaterThan(0);
    expect(view.v2.budgetAllocation.suggested.length).toBeGreaterThan(0);
    expect(view.v2.budgetAllocation.evidence.length).toBeGreaterThan(0);
    expect(view.v2.marketingEfficiency.current).toBeGreaterThan(0);
    expect(view.v2.platformHealthDetails.length).toBe(4);
    expect(view.v2.scenarioForecast.assumptions.length).toBeGreaterThan(0);
    expect(view.v2.scenarioForecast.scenarios).toHaveLength(3);
    expect(view.v2.autopilotReadiness.actionsReady).toBeGreaterThanOrEqual(0);

    for (const p of view.platforms) {
      if (p.score != null) {
        expect(p.scoreExplanation.length).toBeGreaterThan(0);
      }
    }

    const losing = view.campaigns.filter((c) => c.health === "losing_money");
    if (losing.length > 0) {
      const pauseFirst = losing.every((c) => c.recommendation === "pause_campaign");
      expect(pauseFirst).toBe(false);
    }

    if (view.v2.priorityQueue.length > 0) {
      expect(view.v2.priorityQueue[0]!.whyBullets.length).toBeGreaterThan(0);
    }

    const disconnected = view.v2.platformHealthDetails.filter((p) => !p.connected);
    for (const p of disconnected) {
      expect(p.businessStatusLabel).toBe("No data available");
      expect(p.score).toBeNull();
    }
  });
});
