import { describe, expect, it } from "vitest";
import {
  buildBusinessScaleContext,
  constrainPlatformRecovery,
  constrainRecoveryEstimate,
  maxRecoverableRecovery,
  scaleConfidenceByRecoverySize,
} from "@/lib/analytics/recovery-business-constraints";
import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { computeProfitDashboard } from "@/lib/profit/engine";

function fullCtx(
  overrides: Partial<ReturnType<typeof buildBusinessScaleContext>> = {},
) {
  return {
    monthlyRevenue: 20_000,
    monthlyProfit: 3_000,
    monthlyAdSpend: 850,
    blendedRoas: 1.8,
    conversionRatePct: 2.5,
    grossMarginPct: 42,
    contributionMarginPct: 28,
    cogsPct: 40,
    shippingCostPct: 8,
    catastrophicInefficiency: false,
    performanceTier: "normal" as const,
    businessSegment: "medium" as const,
    businessModel: "own_inventory" as const,
    profitTrendPct: null,
    budgetEfficiencyScore: 72,
    ...overrides,
  };
}

describe("recovery business constraints", () => {
  const snapshot = getPeakOutfittersSnapshot();
  const profitDashboard = computeProfitDashboard(snapshot, [])!;
  const ctx = buildBusinessScaleContext(profitDashboard, snapshot);

  it("caps recovery at 30% of monthly ad spend for normal performance", () => {
    const smallCtx = fullCtx({
      monthlyAdSpend: 850,
      monthlyRevenue: 12_000,
      monthlyProfit: 2_400,
      businessSegment: "small",
      performanceTier: "normal",
    });

    const result = constrainRecoveryEstimate(13_865, 88, smallCtx);
    expect(result.amount).toBeLessThanOrEqual(255);
    expect(result.wasCapped).toBe(true);
    expect(result.forecast.range.mostLikely).toBe(result.amount);
    expect(result.forecast.quality.label).toBeTruthy();
    expect(result.capReasons.length).toBeGreaterThan(0);
  });

  it("never exceeds monthly revenue", () => {
    const tinyCtx = fullCtx({
      monthlyRevenue: 3_000,
      monthlyProfit: 600,
      monthlyAdSpend: 400,
      blendedRoas: 1.1,
      businessSegment: "small",
      performanceTier: "critical",
    });

    const result = constrainRecoveryEstimate(8_000, 90, tinyCtx);
    expect(result.amount).toBeLessThanOrEqual(600);
    expect(result.amount).toBeLessThan(tinyCtx.monthlyRevenue);
  });

  it("limits profit improvement relative to margin-weighted monthly profit", () => {
    const result = constrainRecoveryEstimate(5_000, 85, fullCtx({
      monthlyRevenue: 40_000,
      monthlyProfit: 4_000,
      monthlyAdSpend: 6_000,
      blendedRoas: 2.1,
      grossMarginPct: 50,
      performanceTier: "normal",
    }));
    expect(result.amount).toBeLessThanOrEqual(1_200);
  });

  it("scales confidence down for large recovery estimates", () => {
    expect(scaleConfidenceByRecoverySize(95, 700, false)).toBeLessThanOrEqual(92);
    expect(scaleConfidenceByRecoverySize(95, 2_500, false)).toBeLessThanOrEqual(74);
    expect(scaleConfidenceByRecoverySize(95, 9_000, false)).toBeLessThanOrEqual(41);
  });

  it("platform recovery respects dynamic channel spend cap", () => {
    const result = constrainPlatformRecovery(13_865, 850, 88, ctx);
    expect(result.amount).toBeLessThanOrEqual(255);
    expect(result.explanation.basedOn.some((b) => b.includes("30%"))).toBe(true);
    expect(result.forecast.benchmark.segmentLabel).toContain("stores");
  });

  it("max recoverable uses most restrictive dynamic cap", () => {
    const max = maxRecoverableRecovery(fullCtx({
      monthlyRevenue: 20_000,
      monthlyProfit: 3_000,
      monthlyAdSpend: 850,
      performanceTier: "normal",
      businessSegment: "small",
    }));
    expect(max).toBe(255);
  });

  it("includes forecast explanation factors", () => {
    const result = constrainRecoveryEstimate(486, 88, fullCtx({
      monthlyRevenue: 18_000,
      monthlyProfit: 2_800,
      monthlyAdSpend: 1_200,
      blendedRoas: 2.3,
      grossMarginPct: 48,
      businessSegment: "small",
    }));
    expect(result.explanation.basedOn.length).toBeGreaterThanOrEqual(3);
    expect(result.explanation.range).toBeDefined();
    expect(result.explanation.components).toBeDefined();
    expect(result.explanation.disclaimer).toContain("pricing");
  });
});
