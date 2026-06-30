import type { KpiDelta } from "./metrics";
import type { OutcomeRating } from "./outcome-types";

export type OutcomeScoreInput = {
  predictionAccuracy: number;
  deltas: KpiDelta[];
  actualMonthly: number;
  expectedMonthly: number;
};

export type OutcomeScoreResult = {
  rating: OutcomeRating;
  confidenceLabel: "high" | "medium" | "low";
  breakdown: Record<string, unknown>;
};

export function scoreOutcome(input: OutcomeScoreInput): OutcomeScoreResult {
  const improved = input.deltas.filter((d) => d.improved);
  const worsened = input.deltas.filter((d) => !d.improved && d.changePct !== null && d.changePct !== 0);
  const improvedRatio =
    input.deltas.length > 0 ? improved.length / input.deltas.length : 0;

  let rating: OutcomeRating = "neutral";

  const metExpectation =
    input.expectedMonthly <= 0
      ? input.actualMonthly > 0
      : input.actualMonthly >= input.expectedMonthly * 0.5;

  if (
    input.predictionAccuracy >= 70 ||
    (improvedRatio >= 0.5 && metExpectation) ||
    (improved.length >= 2 && input.actualMonthly > 0)
  ) {
    rating = "successful";
  } else if (
    input.predictionAccuracy < 40 ||
    worsened.length > improved.length ||
    (input.expectedMonthly > 0 && input.actualMonthly <= 0)
  ) {
    rating = "needs_improvement";
  }

  const confidenceLabel: OutcomeScoreResult["confidenceLabel"] =
    rating === "successful" && input.predictionAccuracy >= 75
      ? "high"
      : rating === "needs_improvement"
        ? "low"
        : "medium";

  return {
    rating,
    confidenceLabel,
    breakdown: {
      predictionAccuracy: input.predictionAccuracy,
      improvedCount: improved.length,
      worsenedCount: worsened.length,
      improvedRatio: Math.round(improvedRatio * 100),
      actualMonthly: input.actualMonthly,
      expectedMonthly: input.expectedMonthly,
    },
  };
}

export function outcomeRatingLabel(rating: OutcomeRating): string {
  switch (rating) {
    case "successful":
      return "Successful";
    case "neutral":
      return "Neutral";
    case "needs_improvement":
      return "Needs Improvement";
  }
}
