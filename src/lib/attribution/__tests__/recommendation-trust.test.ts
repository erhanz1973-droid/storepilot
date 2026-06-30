import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildAttributionDashboard } from "@/lib/attribution/engine";
import {
  buildConfidenceBreakdown,
  buildRecommendationExpiration,
  enrichStrategyPlanAsync,
} from "@/lib/attribution/recommendation-trust";
import { insertOutcomeRecord } from "@/lib/db/outcome-records";
import { describe, expect, it } from "vitest";

describe("attribution recommendation trust", () => {
  const snapshot = getPeakOutfittersSnapshot();
  const profitDashboard = computeProfitDashboard(snapshot, [])!;
  const dashboard = buildAttributionDashboard(snapshot, profitDashboard)!;
  const plan = dashboard.strategyPlan;

  it("never includes placeholder learning feedback in sync enrichment", () => {
    expect(plan.learningFeedback).toEqual([]);
    for (const entry of plan.learningFeedback) {
      expect(entry.appliedAt).not.toMatch(/days ago/i);
    }
  });

  it("includes confidence breakdown and expiration metadata", () => {
    expect(plan.confidenceBreakdown.overallPct).toBeGreaterThan(0);
    expect(plan.confidenceBreakdown.dataCompletenessPct).toBeGreaterThan(0);
    expect(plan.expiration.validityDays).toBe(7);
    expect(plan.expiration.generatedAt).toBeTruthy();
  });

  it("labels simulated vs verified impact on actions", () => {
    for (const action of plan.actions) {
      expect(action.impact.simulationStatus).toBe("Simulated");
      expect(action.dependencies.length).toBeGreaterThan(0);
      expect(action.crossModuleImpacts.length).toBe(4);
    }
  });

  it("builds explainable confidence components", () => {
    const breakdown = buildConfidenceBreakdown({
      confidence: dashboard.confidence,
      stability: plan.stability,
      paidCampaignCount: dashboard.campaigns.length,
      journeyCount: dashboard.sampleJourneys.length,
      overallPct: plan.confidencePct,
    });
    expect(breakdown.attributionQualityPct).toBeGreaterThan(0);
    expect(breakdown.sampleSizePct).toBeGreaterThan(0);
  });

  it("marks expired recommendations after validity window", () => {
    const oldSync = new Date(Date.now() - 10 * 86400000).toISOString();
    const expiration = buildRecommendationExpiration(oldSync);
    expect(expiration.isExpired).toBe(true);
  });

  it("loads verified learning feedback from outcome records", async () => {
    const storeId = snapshot.storeId ?? "00000000-0000-4000-8000-000000000001";
    const action = plan.actions[0]!;

    await insertOutcomeRecord({
      storeId,
      opportunityKey: action.id,
      title: action.title,
      category: "marketing_attribution",
      baselineCapturedAt: "2026-06-14T00:00:00.000Z",
      measureDueAt: "2026-06-28T00:00:00.000Z",
      measurementWindowDays: 14,
      expectedMonthlyImpact: 2860,
      baselineMetrics: { spend7d: 12300 / (30 / 7), roas7d: 0.63, revenue7d: 7750 },
    });

    const enriched = await enrichStrategyPlanAsync(storeId, plan);
    const matched = enriched.actions.find((a) => a.id === action.id);
    expect(matched?.impact.observedStatus).toBe("Estimated");
    expect(enriched.learningFeedback.length).toBeGreaterThan(0);
    expect(enriched.learningFeedback[0]?.verificationStatus).not.toBe("Simulated");
    expect(enriched.learningFeedback[0]?.appliedAt).toBe("2026-06-14");
  });
});
