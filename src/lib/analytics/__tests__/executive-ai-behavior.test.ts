import { describe, expect, it } from "vitest";
import { buildRecoveryScenarios } from "@/lib/analytics/executive-advisor-enrichment";
import {
  buildExecutiveAiBehavior,
  buildExecutiveAiLiveStatus,
  buildRecoveryProgress,
  buildAiRecentLearnings,
  normalizeOpportunityHistorySummary,
} from "@/lib/analytics/executive-ai-behavior";
import { buildExecutiveAdvisorView } from "@/lib/analytics/executive-advisor";
import { buildExecutiveExperience } from "@/lib/analytics/executive-experience";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { computeStoreHealthScore } from "@/lib/store-health/score";

describe("executive-ai-behavior", () => {
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

  it("builds live AI status with analysis steps", () => {
    const status = buildExecutiveAiLiveStatus({ snapshot, activityFeed: [], profitDashboard });
    expect(status.statusLabel.length).toBeGreaterThan(0);
    expect(status.analysisSteps.length).toBeGreaterThan(0);
    expect(status.lastAnalysisLabel).toBeTruthy();
    expect(status.domains.length).toBeGreaterThanOrEqual(4);
  });

  it("shows encouraging recovery state before first approval", () => {
    const recoveryBase = {
      items: [] as const,
      grossMonthly: 10000,
      netMonthly: 8000,
      overlapRemoved: 2000,
    };
    const progress = buildRecoveryProgress({
      recoveryBreakdown: {
        ...recoveryBase,
        scenarios: buildRecoveryScenarios(recoveryBase),
      },
      aiPerformance: { predictionAccuracy: 85, measuredCount: 0, revenueInfluenced: 0, bestCategory: "", bestCategoryLabel: "—" },
      decisions: [],
    });
    expect(progress.goalMonthly).toBe(8000);
    expect(progress.hasMeasurements).toBe(false);
    expect(progress.progressPct).toBe(0);
    expect(progress.recoveredLabel).toContain("potential");
  });

  it("builds recovery progress from goal and outcomes", () => {
    const recoveryBase = {
      items: [] as const,
      grossMonthly: 10000,
      netMonthly: 8000,
      overlapRemoved: 2000,
    };
    const progress = buildRecoveryProgress({
      recoveryBreakdown: {
        ...recoveryBase,
        scenarios: buildRecoveryScenarios(recoveryBase),
      },
      aiPerformance: { predictionAccuracy: 85, measuredCount: 3, revenueInfluenced: 2500, bestCategory: "", bestCategoryLabel: "—" },
      decisions: [],
    });
    expect(progress.goalMonthly).toBe(8000);
    expect(progress.progressPct).toBeGreaterThan(0);
    expect(progress.remainingMonthly).toBeLessThan(progress.goalMonthly);
  });

  it("derives recent learnings from snapshot", () => {
    const learnings = buildAiRecentLearnings(snapshot);
    expect(Array.isArray(learnings)).toBe(true);
  });

  it("normalizes opportunity history array or summary", () => {
    const fromArray = normalizeOpportunityHistorySummary([
      {
        id: "1",
        storeId: "demo",
        opportunityKey: "k1",
        title: "Test",
        category: "campaigns",
        status: "resolved",
        estimatedMonthlyRevenue: 1000,
        estimatedMonthlyProfit: 500,
        confidencePct: 80,
        detectedAt: new Date().toISOString(),
        resolvedAt: new Date().toISOString(),
        ignoreCount: 0,
      },
    ]);
    expect(fromArray.resolved).toBe(1);

    const fromSummary = normalizeOpportunityHistorySummary({
      total: 5,
      detected: 2,
      viewed: 1,
      ignored: 1,
      resolved: 1,
      expired: 0,
      actionRate: 20,
    });
    expect(fromSummary.total).toBe(5);
  });

  it("builds full ai behavior bundle on advisor view", () => {
    const view = buildExecutiveAdvisorView({
      snapshot,
      profitDashboard,
      trends: null,
      decisions: [],
      activityFeed: [],
      aiPerformance: {
        predictionAccuracy: 80,
        measuredCount: 2,
        revenueInfluenced: 1200,
        bestCategory: "campaigns",
        bestCategoryLabel: "Campaigns",
      },
      opportunityHistory: {
        total: 0,
        detected: 0,
        viewed: 0,
        ignored: 0,
        resolved: 0,
        expired: 0,
        actionRate: 0,
      },
      experienceInput: {
        snapshot,
        profitDashboard,
        decisions: [],
        opportunityFeed: [],
        priorityQueue: [],
        storeHealth: storeHealth(),
      },
    });

    expect(view.aiBehavior.liveStatus).toBeDefined();
    expect(view.aiBehavior.adoptionScore.scorePct).toBeGreaterThanOrEqual(0);
    expect(view.aiBehavior.confidenceEvolution.currentPct).toBeGreaterThan(0);
    expect(view.aiBehavior.recoveryProgress.goalMonthly).toBe(view.recoveryBreakdown.netMonthly);
    expect(view.ceoBriefFull.conversation.length).toBeGreaterThanOrEqual(view.ceoBrief.conversation.length);
    if (view.aiBehavior.dailyDigest) {
      expect(view.aiBehavior.dailyDigest.storeHealthScore).toBeGreaterThan(0);
      expect(view.aiBehavior.dailyDigest.todayPriority).toBeTruthy();
    }
  });
});
