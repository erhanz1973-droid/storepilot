import { describe, expect, it } from "vitest";
import {
  buildExecutiveEvidencePipeline,
  buildExecutiveObserveContext,
} from "@/lib/analytics/build-executive-ceo-os";

describe("Executive Evidence Pipeline (Building Evidence state)", () => {
  it("builds a pipeline with correct step counts and labels", () => {
    const pipeline = buildExecutiveEvidencePipeline({
      campaignsScanned: 17,
      potentialOpportunities: 5,
      passedFinancialTrust: 2,
      passedDecisionValidation: 1,
      exceededThreshold: 0,
    });

    expect(pipeline.steps).toHaveLength(5);
    expect(pipeline.steps[0]).toEqual({
      label: "Campaigns Scanned",
      value: 17,
      active: true,
    });
    expect(pipeline.steps[1]).toEqual({
      label: "Opportunities Identified",
      value: 5,
      active: true,
    });
    expect(pipeline.steps[2]).toEqual({
      label: "Passed Financial Trust",
      value: 2,
      active: true,
    });
    expect(pipeline.steps[3]).toEqual({
      label: "Passed Decision Validation",
      value: 1,
      active: true,
    });
    expect(pipeline.steps[4]).toEqual({
      label: "Exceeded Executive Threshold",
      value: 0,
      active: false,
    });
    expect(pipeline.currentStageLabel).toBe("Building Evidence");
  });

  it("detects the current stage based on funnel progress", () => {
    expect(
      buildExecutiveEvidencePipeline({
        campaignsScanned: 10,
        potentialOpportunities: 0,
        passedFinancialTrust: 0,
        passedDecisionValidation: 0,
        exceededThreshold: 0,
      }).currentStageLabel,
    ).toBe("Scanning");

    expect(
      buildExecutiveEvidencePipeline({
        campaignsScanned: 10,
        potentialOpportunities: 3,
        passedFinancialTrust: 0,
        passedDecisionValidation: 0,
        exceededThreshold: 0,
      }).currentStageLabel,
    ).toBe("Financial Trust Check");

    expect(
      buildExecutiveEvidencePipeline({
        campaignsScanned: 10,
        potentialOpportunities: 3,
        passedFinancialTrust: 2,
        passedDecisionValidation: 0,
        exceededThreshold: 0,
      }).currentStageLabel,
    ).toBe("Decision Validation");

    expect(
      buildExecutiveEvidencePipeline({
        campaignsScanned: 10,
        potentialOpportunities: 3,
        passedFinancialTrust: 2,
        passedDecisionValidation: 1,
        exceededThreshold: 0,
      }).currentStageLabel,
    ).toBe("Building Evidence");

    expect(
      buildExecutiveEvidencePipeline({
        campaignsScanned: 10,
        potentialOpportunities: 3,
        passedFinancialTrust: 2,
        passedDecisionValidation: 1,
        exceededThreshold: 1,
      }).currentStageLabel,
    ).toBe("Ready for Executive Action");
  });
});

describe("Executive Observe Context", () => {
  it("generates reasons when net profit is below threshold", () => {
    const ctx = buildExecutiveObserveContext({
      thresholdCurrent: 61,
      thresholdRequired: 75,
      confidencePct: 55,
      minConfidencePct: 70,
      netProfit: 80,
      minNetProfit: 100,
      highestTitle: "Summer Hiking",
    });

    expect(ctx.reasons.length).toBeGreaterThanOrEqual(2);
    expect(ctx.reasons.some((r) => /monthly profit/i.test(r))).toBe(true);
    expect(ctx.reasons.some((r) => /performance data/i.test(r))).toBe(true);
    expect(ctx.reasons.some((r) => /confidence/i.test(r))).toBe(true);
  });

  it("generates triggers explaining what will cause action", () => {
    const ctx = buildExecutiveObserveContext({
      thresholdCurrent: 61,
      thresholdRequired: 75,
      confidencePct: 55,
      minConfidencePct: 70,
      netProfit: 80,
      minNetProfit: 1000,
      highestTitle: "Summer Hiking",
    });

    expect(ctx.triggers.length).toBeGreaterThanOrEqual(2);
    expect(ctx.triggers.some((t) => /\$1,000/i.test(t))).toBe(true);
    expect(ctx.triggers.some((t) => /70%/i.test(t))).toBe(true);
    expect(ctx.triggers.some((t) => /75/i.test(t))).toBe(true);
  });

  it("always includes next review label", () => {
    const ctx = buildExecutiveObserveContext({
      thresholdCurrent: 61,
      thresholdRequired: 75,
      confidencePct: 80,
      minConfidencePct: 70,
      netProfit: 2000,
      minNetProfit: 100,
      highestTitle: null,
    });

    expect(ctx.nextReviewLabel).toBe("24 hours");
    expect(ctx.nextReviewDetail).toMatch(/re-evaluate/i);
  });

  it("provides fallback when all criteria are met", () => {
    const ctx = buildExecutiveObserveContext({
      thresholdCurrent: 80,
      thresholdRequired: 75,
      confidencePct: 90,
      minConfidencePct: 70,
      netProfit: 2000,
      minNetProfit: 100,
      highestTitle: null,
    });

    expect(ctx.reasons.length).toBeGreaterThanOrEqual(1);
    expect(ctx.triggers.length).toBeGreaterThanOrEqual(1);
  });
});
