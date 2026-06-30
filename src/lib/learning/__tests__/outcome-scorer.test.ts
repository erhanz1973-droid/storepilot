import { describe, expect, it } from "vitest";
import { scoreOutcome } from "@/lib/learning/outcome-scorer";
import type { KpiDelta } from "@/lib/learning/metrics";

const improvedDelta = (label: string): KpiDelta => ({
  label,
  before: "10",
  after: "15",
  changePct: 50,
  improved: true,
});

const worsenedDelta = (label: string): KpiDelta => ({
  label,
  before: "15",
  after: "10",
  changePct: -33,
  improved: false,
});

describe("Outcome scoring", () => {
  it("marks strong results as successful", () => {
    const result = scoreOutcome({
      predictionAccuracy: 82,
      deltas: [improvedDelta("Revenue"), improvedDelta("Units sold")],
      actualMonthly: 900,
      expectedMonthly: 1000,
    });
    expect(result.rating).toBe("successful");
    expect(result.confidenceLabel).toBe("high");
  });

  it("marks weak results as needs improvement", () => {
    const result = scoreOutcome({
      predictionAccuracy: 25,
      deltas: [worsenedDelta("Revenue"), worsenedDelta("Units sold")],
      actualMonthly: 0,
      expectedMonthly: 800,
    });
    expect(result.rating).toBe("needs_improvement");
    expect(result.confidenceLabel).toBe("low");
  });

  it("marks mixed results as neutral", () => {
    const result = scoreOutcome({
      predictionAccuracy: 52,
      deltas: [improvedDelta("Revenue"), worsenedDelta("CTR")],
      actualMonthly: 250,
      expectedMonthly: 600,
    });
    expect(result.rating).toBe("neutral");
  });
});
