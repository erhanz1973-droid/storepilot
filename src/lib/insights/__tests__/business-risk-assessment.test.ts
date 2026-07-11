import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { buildCustomerIntelligence } from "@/lib/customers/engine";
import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { buildBusinessRiskAssessment } from "@/lib/insights/business-risk-assessment";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildProductIntelligence } from "@/lib/products/engine";
import type { StoreSnapshot } from "@/lib/connectors/types";
import { describe, expect, it } from "vitest";

describe("business risk assessment", () => {
  const snapshot = getPeakOutfittersSnapshot();
  const profitDashboard = computeProfitDashboard(snapshot, [])!;
  const attributionDashboard = buildAttributionDashboard(snapshot, profitDashboard)!;
  const customerIntelligence = buildCustomerIntelligence({
    snapshot,
    attribution: attributionDashboard,
    profitDashboard,
  });
  const productIntelligence = buildProductIntelligence(snapshot, [], profitDashboard);

  const baseInput = {
    snapshot,
    profitDashboard,
    attributionDashboard,
    customerIntelligence,
    productIntelligence,
    hasActiveAds: true,
  };

  it("scores all seven business risk categories with executive fields", () => {
    const assessment = buildBusinessRiskAssessment(baseInput);

    expect(assessment.categories).toHaveLength(7);
    expect(assessment.executiveBriefing.length).toBeGreaterThan(50);
    for (const cat of assessment.categories) {
      expect(cat.priorityRank).toBeGreaterThan(0);
      expect(cat.probabilityPct).toBeGreaterThan(0);
      expect(cat.trendLabel.length).toBeGreaterThan(0);
      expect(cat.businessImpactLabel.length).toBeGreaterThan(0);
      expect(cat.riskTimeline).toHaveLength(4);
      expect(cat.crossBusinessEffects.length).toBeGreaterThan(0);
    }
  });

  it("prioritizes inventory when stock is critical", () => {
    const oosSnapshot: StoreSnapshot = {
      ...snapshot,
      products: snapshot.products.map((p) => ({ ...p, inventoryQuantity: 0 })),
    };

    const assessment = buildBusinessRiskAssessment({
      ...baseInput,
      snapshot: oosSnapshot,
    });

    expect(assessment.primaryRisk.category).toBe("inventory");
    expect(assessment.primaryRisk.estimatedExposureMonthly).toBeGreaterThan(0);
    expect(assessment.whyNotOtherRisks.length).toBeGreaterThan(0);
  });

  it("explains business consequences instead of raw metric drama", () => {
    const assessment = buildBusinessRiskAssessment(baseInput);
    const marketing = assessment.categories.find((c) => c.category === "marketing");

    if (marketing && marketing.score >= 40) {
      expect(assessment.primaryRisk.businessConsequence).not.toMatch(/\d{3,}%/);
      expect(assessment.primaryRisk.businessConsequence).toMatch(/profitably|acquisition|revenue/i);
    }
  });

  it("enriches recommendation steps with effort and expected benefit", () => {
    const assessment = buildBusinessRiskAssessment(baseInput);

    expect(assessment.recommendationSteps).toHaveLength(3);
    for (const step of assessment.recommendationSteps) {
      expect(step.estimatedTime.length).toBeGreaterThan(0);
      expect(step.riskReductionPct).toBeGreaterThan(0);
      expect(step.expectedBenefit.length).toBeGreaterThan(0);
    }
    const reasons = assessment.recommendationSteps.map((s) => s.reason);
    expect(new Set(reasons).size).toBe(reasons.length);
  });

  it("ranks categories by priority not raw score display", () => {
    const assessment = buildBusinessRiskAssessment(baseInput);
    expect(assessment.categories[0]!.priorityRank).toBe(1);
    expect(assessment.primaryRisk.probabilityPct).toBeGreaterThan(0);
    expect(assessment.primaryRisk.timeHorizon.length).toBeGreaterThan(3);
    expect(assessment.rankingExplanation ?? assessment.primaryRisk.rankingRationale).toMatch(
      /ranked|financial impact/i,
    );
  });

  it("includes inaction impact and cross-business effects on primary risk", () => {
    const assessment = buildBusinessRiskAssessment(baseInput);

    expect(assessment.primaryRisk.inactionImpact.length).toBeGreaterThan(0);
    expect(assessment.primaryRisk.crossBusinessEffects.length).toBeGreaterThan(2);
    expect(assessment.primaryRisk.riskTimeline).toHaveLength(4);
  });
});
