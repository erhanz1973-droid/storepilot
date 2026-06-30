import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { buildAttributionStrategyPlan } from "@/lib/attribution/decision-engine";
import { enrichStrategyPlanSync } from "@/lib/attribution/recommendation-trust";
import { describe, expect, it } from "vitest";

describe("attribution decision engine", () => {
  const snapshot = getPeakOutfittersSnapshot();
  const profitDashboard = computeProfitDashboard(snapshot, [])!;
  const dashboard = buildAttributionDashboard(snapshot, profitDashboard)!;

  it("selects a single strategy with aligned actions", () => {
    const plan = dashboard.strategyPlan;
    expect(plan.actions.length).toBeGreaterThan(0);
    expect(plan.strategyLabel.length).toBeGreaterThan(5);
    expect(plan.confidencePct).toBeGreaterThan(0);
  });

  it("explains decision preconditions and strategy alternatives", () => {
    const plan = dashboard.strategyPlan;
    expect(plan.preconditions.length).toBeGreaterThan(0);
    expect(plan.strategyAlternatives.length).toBe(5);
    expect(plan.strategyAlternatives.filter((a) => a.selected).length).toBe(1);
    expect(plan.strategyAlternatives.find((a) => a.selected)?.strategy).toBe(plan.strategy);
  });

  it("uses dynamic break-even ROAS from profit data", () => {
    const plan = dashboard.strategyPlan;
    expect(plan.breakEvenModel.breakEvenRoas).toBeGreaterThan(0);
    expect(plan.breakEvenModel.summary).toContain("Break-even ROAS");
    expect(plan.simulation.breakEvenRoas).toBe(plan.breakEvenModel.breakEvenRoas);
    expect(plan.simulation.verificationStatus).toBe("Simulated");
  });

  it("includes trust metadata without placeholder learning feedback", () => {
    const plan = dashboard.strategyPlan;
    expect(plan.confidenceBreakdown.overallPct).toBeGreaterThan(0);
    expect(plan.expiration.validityDays).toBe(7);
    expect(plan.assumptions.length).toBeGreaterThan(0);
    expect(plan.learningFeedback).toEqual([]);
    expect(plan.executiveSummary.bestOpportunity.length).toBeGreaterThan(0);
    expect(plan.objectiveReconciliation.statedObjective.length).toBeGreaterThan(0);
    expect(plan.optimizationWorkflow.length).toBeGreaterThan(0);
    expect(plan.simulation.scenarios.length).toBe(4);
    expect(plan.simulation.scenarios[0]?.probability).toBeDefined();
    expect(plan.simulation.scenarios[0]?.revenueDeltaPctLow).toBeDefined();
    expect(["Stable", "Monitoring", "Volatile"]).toContain(plan.stability.status);
    for (const action of plan.actions) {
      expect(["Low", "Medium", "High"]).toContain(action.riskLevel);
      expect(action.impact.simulationStatus).toBe("Simulated");
      expect(action.dependencies.length).toBeGreaterThan(0);
      expect(action.opportunityCost.items.length).toBeGreaterThan(0);
      expect(action.rankExplanation?.length).toBeGreaterThan(0);
    }
  });

  it("explains why rejected strategies were not selected", () => {
    const rejected = dashboard.strategyPlan.strategyAlternatives.filter((a) => !a.selected);
    expect(rejected.length).toBeGreaterThan(0);
    for (const alt of rejected) {
      expect(alt.whyNot.length).toBeGreaterThan(0);
    }
  });

  it("does not recommend both pause and increase budget in the same plan", () => {
    const titles = dashboard.strategyPlan.actions.map((a) => a.title.toLowerCase());
    const hasIncrease = titles.some((t) => t.includes("increase") && t.includes("budget"));
    const hasPauseCampaign = titles.some(
      (t) => t.startsWith("pause ") && !t.includes("ad set"),
    );
    const hasRefreshRetarget = titles.some((t) => t.includes("keep") && t.includes("refresh"));

    if (hasPauseCampaign && dashboard.strategyPlan.strategy !== "scale") {
      expect(hasIncrease).toBe(false);
    }
    if (hasRefreshRetarget) {
      expect(titles.some((t) => t.includes("pause retarget") || t === "pause retargeting")).toBe(
        false,
      );
    }
  });

  it("ranks last-resort actions after optimization steps", () => {
    const lastResort = dashboard.strategyPlan.actions.filter((a) => a.isLastResort);
    for (const action of lastResort) {
      expect(action.rank).toBeGreaterThan(1);
    }
  });

  it("enriches campaigns with break-even ROAS and gap", () => {
    expect(dashboard.campaigns.length).toBeGreaterThan(0);
    expect(dashboard.campaigns[0]!.breakEvenRoas).not.toBeNull();
    expect(dashboard.campaigns[0]!.roasGapPct).not.toBeNull();
  });

  it("builds mutually exclusive opportunities from strategy plan", () => {
    const opps = dashboard.attributionOpportunities;
    expect(opps.length).toBe(dashboard.strategyPlan.actions.length);
    const increase = opps.filter((o) => o.title.toLowerCase().includes("increase budget"));
    const pause = opps.filter(
      (o) =>
        o.title.toLowerCase().startsWith("pause ") &&
        !o.title.toLowerCase().includes("ad set"),
    );
    if (dashboard.strategyPlan.strategy === "optimize") {
      expect(increase.length).toBe(0);
    }
    if (pause.length > 0) {
      expect(pause.every((p) => p.title.toLowerCase().includes("last resort"))).toBe(true);
    }
  });

  it("produces plan independently via buildAttributionStrategyPlan", () => {
    const core = buildAttributionStrategyPlan({
      channels: dashboard.channels,
      campaigns: dashboard.campaigns,
      creatives: dashboard.creatives,
      acquisition: dashboard.acquisition,
      profitDashboard,
      grossMarginRate: 0.58,
      businessGoal: "increase_profit",
      dailyMetrics: snapshot.dailyMetrics,
    });
    const plan = enrichStrategyPlanSync({
      plan: core,
      confidence: dashboard.confidence,
      syncedAt: snapshot.syncedAt,
      snapshot,
      acquisition: dashboard.acquisition,
      journeyCount: dashboard.sampleJourneys.length,
      paidCampaignCount: dashboard.campaigns.filter((c) => c.adSpend > 50).length,
      conversionStable: true,
    });
    expect(plan.actions.length).toBeGreaterThan(0);
    expect(["scale", "optimize", "reallocate", "reduce_budget", "pause"]).toContain(
      plan.strategy,
    );
    expect(plan.businessObjectiveLabel).toBe("Increase Profit");
  });

  it("adapts strategy scoring when business objective is growth", () => {
    const profitPlan = enrichStrategyPlanSync({
      plan: buildAttributionStrategyPlan({
        channels: dashboard.channels,
        campaigns: dashboard.campaigns,
        creatives: dashboard.creatives,
        acquisition: dashboard.acquisition,
        profitDashboard,
        businessGoal: "increase_profit",
      }),
      confidence: dashboard.confidence,
      syncedAt: snapshot.syncedAt,
      snapshot,
      acquisition: dashboard.acquisition,
      journeyCount: dashboard.sampleJourneys.length,
      paidCampaignCount: dashboard.campaigns.length,
      conversionStable: true,
    });
    const growthPlan = enrichStrategyPlanSync({
      plan: buildAttributionStrategyPlan({
        channels: dashboard.channels,
        campaigns: dashboard.campaigns,
        creatives: dashboard.creatives,
        acquisition: dashboard.acquisition,
        profitDashboard,
        businessGoal: "acquire_new_customers",
      }),
      confidence: dashboard.confidence,
      syncedAt: snapshot.syncedAt,
      snapshot,
      acquisition: dashboard.acquisition,
      journeyCount: dashboard.sampleJourneys.length,
      paidCampaignCount: dashboard.campaigns.length,
      conversionStable: true,
    });
    const profitPause = profitPlan.strategyAlternatives.find((a) => a.strategy === "pause")!;
    const growthPause = growthPlan.strategyAlternatives.find((a) => a.strategy === "pause")!;
    expect(growthPause.score).toBeLessThan(profitPause.score);
  });
});
