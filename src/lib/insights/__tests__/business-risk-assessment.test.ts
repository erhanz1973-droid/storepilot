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

  it("scores all seven business risk categories with contributors and confidence", () => {
    const assessment = buildBusinessRiskAssessment({
      snapshot,
      profitDashboard,
      attributionDashboard,
      customerIntelligence,
      productIntelligence,
      hasActiveAds: true,
    });

    expect(assessment.categories).toHaveLength(7);
    for (const cat of assessment.categories) {
      expect(cat.contributors.length).toBeGreaterThan(0);
      expect(cat.confidencePct).toBeGreaterThan(0);
      expect(cat.timeHorizon.length).toBeGreaterThan(3);
      expect(cat.contributors.reduce((s, c) => s + c.points, 0)).toBe(cat.score);
    }
  });

  it("does not default to marketing-only when inventory is critical", () => {
    const oosSnapshot: StoreSnapshot = {
      ...snapshot,
      products: snapshot.products.map((p) => ({ ...p, inventoryQuantity: 0 })),
    };

    const assessment = buildBusinessRiskAssessment({
      snapshot: oosSnapshot,
      profitDashboard,
      attributionDashboard,
      customerIntelligence,
      productIntelligence,
      hasActiveAds: true,
    });

    expect(assessment.primaryRisk.category).toBe("inventory");
    expect(assessment.primaryRisk.title).toBe("Inventory Shortage");
    expect(assessment.estimatedExposure.items.length).toBeGreaterThan(0);
    expect(assessment.rankingExplanation).toBeDefined();
  });

  it("gives each recommendation a unique rationale", () => {
    const oosSnapshot: StoreSnapshot = {
      ...snapshot,
      products: snapshot.products.map((p) => ({ ...p, inventoryQuantity: 0 })),
    };

    const assessment = buildBusinessRiskAssessment({
      snapshot: oosSnapshot,
      profitDashboard,
      attributionDashboard,
      customerIntelligence,
      productIntelligence,
      hasActiveAds: true,
    });

    const reasons = assessment.recommendationSteps.map((s) => s.reason);
    const uniqueReasons = new Set(reasons);
    expect(uniqueReasons.size).toBe(reasons.length);
    expect(assessment.recommendationSteps[0]?.action.toLowerCase()).toContain("replenish");
    expect(assessment.recommendationSteps[1]?.reason.toLowerCase()).toContain("acquisition");
  });

  it("explains why primary risk ranked above secondary when scores are close", () => {
    const oosSnapshot: StoreSnapshot = {
      ...snapshot,
      products: snapshot.products.map((p) => ({ ...p, inventoryQuantity: 0 })),
    };

    const assessment = buildBusinessRiskAssessment({
      snapshot: oosSnapshot,
      profitDashboard,
      attributionDashboard,
      customerIntelligence,
      productIntelligence,
      hasActiveAds: true,
    });

    const topTwo = assessment.categories.slice(0, 2);
    if (topTwo[0]!.score - topTwo[1]!.score <= 12) {
      expect(assessment.rankingExplanation?.toLowerCase()).toContain("inventory ranked first");
    }
  });

  it("includes sequenced recommendation steps", () => {
    const assessment = buildBusinessRiskAssessment({
      snapshot,
      profitDashboard,
      attributionDashboard,
      customerIntelligence,
      productIntelligence,
      hasActiveAds: true,
    });

    expect(assessment.recommendationSteps).toHaveLength(3);
    expect(assessment.recommendationSteps.map((s) => s.step)).toEqual([1, 2, 3]);
  });
});
