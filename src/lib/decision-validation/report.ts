import type {
  ActualOutcome,
  BusinessOutcomeSentiment,
  DecisionQualityLabel,
  DecisionValidationInput,
  DecisionValidationReport,
  PredictedOutcome,
  RecommendationCorrectness,
} from "./types";

/** Absolute $ floor for calling an outcome "material" */
export const MATERIAL_PROFIT_DELTA = 50;

/** Prediction accuracy ≥ this and business still negative → "accurate but wrong decision" pathway */
export const HIGH_PREDICTION_ACCURACY_PCT = 85;

export function predictionAccuracyPct(
  predicted: number | null | undefined,
  actual: number | null | undefined,
): number | null {
  if (predicted == null || actual == null) return null;
  if (!Number.isFinite(predicted) || !Number.isFinite(actual)) return null;
  if (predicted === 0 && actual === 0) return 100;
  if (predicted === 0) return 0;

  // Same direction check baked into magnitude distance
  const sameSign =
    (predicted >= 0 && actual >= 0) || (predicted < 0 && actual < 0);
  const magnitudeError = Math.abs(Math.abs(actual) - Math.abs(predicted)) / Math.abs(predicted);
  let score = Math.max(0, 1 - magnitudeError) * 100;
  if (!sameSign) score *= 0.35;
  return Math.round(score);
}

export function businessSentiment(
  actualNet: number | null | undefined,
): BusinessOutcomeSentiment | null {
  if (actualNet == null || !Number.isFinite(actualNet)) return null;
  if (actualNet >= MATERIAL_PROFIT_DELTA) return "positive";
  if (actualNet <= -MATERIAL_PROFIT_DELTA) return "negative";
  return "neutral";
}

export function recommendationCorrectness(input: {
  accepted: boolean;
  sentiment: BusinessOutcomeSentiment | null;
  predictionAccuracy: number | null;
  externalFactors: string[];
}): RecommendationCorrectness | null {
  if (!input.accepted) return null;
  if (input.sentiment == null) return null;
  if (input.sentiment === "positive") return "correct";
  if (input.sentiment === "neutral") return "neutral";

  // Negative — still may be "correct" avoidance of worse loss if predicted negative? rare.
  // Default: wrong unless purely measurement failure.
  if (input.externalFactors.includes("tracking_gap")) return "neutral";
  return "wrong";
}

export function decisionQualityLabel(input: {
  predictionAccuracy: number | null;
  correctness: RecommendationCorrectness | null;
  accepted: boolean;
  hasActual: boolean;
}): DecisionQualityLabel {
  if (!input.accepted) return "inconclusive";
  if (!input.hasActual || input.predictionAccuracy == null) return "inconclusive";

  const acc = input.predictionAccuracy;
  if (input.correctness === "correct" && acc >= 90) return "excellent";
  if (input.correctness === "correct" && acc >= 75) return "good";
  if (input.correctness === "neutral" && acc >= 70) return "fair";
  if (input.correctness === "wrong" && acc >= HIGH_PREDICTION_ACCURACY_PCT) return "fair"; // prediction ok, decision context wrong
  if (input.correctness === "wrong") return "poor";
  if (acc >= 60) return "fair";
  return "poor";
}

function primaryPredictedNet(predicted: PredictedOutcome): number | null {
  if (predicted.netProfitMonthly != null) return predicted.netProfitMonthly;
  if (predicted.businessRecoveryMonthly != null) {
    return Math.round(predicted.businessRecoveryMonthly * 0.55);
  }
  return null;
}

function buildExplanation(report: Omit<DecisionValidationReport, "explanation">): string {
  const pred = primaryPredictedNet(report.predictedOutcome);
  const actual = report.actualOutcome?.netProfitDeltaMonthly ?? null;

  if (!report.recommendationAccepted) {
    return "Recommendation was not accepted — no decision outcome to validate.";
  }
  if (actual == null || report.predictionAccuracy == null) {
    return "Awaiting measured outcome window before decision validation can complete.";
  }

  const predLabel = pred != null ? `$${Math.round(pred).toLocaleString()}/month` : "n/a";
  const actLabel = `$${Math.round(actual).toLocaleString()}/month`;

  if (report.predictionAccurateDecisionWrong) {
    const factor =
      report.externalFactors[0]?.replace(/_/g, " ") ?? "external conditions";
    return `Prediction accurate (${report.predictionAccuracy}%) — predicted ${predLabel}, actual ${actLabel}. Decision still underperformed due to ${factor}.`;
  }

  if (report.recommendationCorrect === "correct") {
    return `Business improved. Predicted ${predLabel}, actual ${actLabel} (${report.predictionAccuracy}% prediction accuracy). Decision quality: ${report.decisionQuality}.`;
  }
  if (report.recommendationCorrect === "neutral") {
    return `Outcome neutral. Predicted ${predLabel}, actual ${actLabel} (${report.predictionAccuracy}% accuracy).`;
  }
  return `Business did not improve as intended. Predicted ${predLabel}, actual ${actLabel} (${report.predictionAccuracy}% accuracy). Decision quality: ${report.decisionQuality}.`;
}

/**
 * Build an immutable DecisionValidationReport for one completed (or pending) recommendation.
 */
export function buildDecisionValidationReport(
  input: DecisionValidationInput,
  opts?: { validatedAt?: string },
): DecisionValidationReport {
  const predictedNet = primaryPredictedNet(input.predicted);
  const actualNet = input.actual?.netProfitDeltaMonthly ?? null;
  const accuracy = input.actual
    ? predictionAccuracyPct(predictedNet, actualNet)
    : null;
  const sentiment = businessSentiment(actualNet);
  const factors = [
    ...(input.externalFactors ?? []),
    ...(input.merchantOverride ? (["merchant_override"] as const) : []),
  ];

  const correctness = recommendationCorrectness({
    accepted: input.recommendationAccepted,
    sentiment,
    predictionAccuracy: accuracy,
    externalFactors: factors,
  });

  const quality = decisionQualityLabel({
    predictionAccuracy: accuracy,
    correctness,
    accepted: input.recommendationAccepted,
    hasActual: input.actual != null,
  });

  const predictionAccurateDecisionWrong =
    Boolean(input.recommendationAccepted) &&
    accuracy != null &&
    accuracy >= HIGH_PREDICTION_ACCURACY_PCT &&
    (correctness === "wrong" || sentiment === "negative") &&
    factors.length > 0;

  const partial: Omit<DecisionValidationReport, "explanation"> = {
    decisionId: input.decisionId,
    title: input.title,
    predictedOutcome: input.predicted,
    actualOutcome: input.actual,
    recommendationAccepted: input.recommendationAccepted,
    businessImproved: sentiment == null ? null : sentiment === "positive",
    predictionAccuracy: accuracy,
    decisionQuality: quality,
    recommendationCorrect: correctness,
    predictionAccurateDecisionWrong,
    externalFactors: factors,
    validatedAt: opts?.validatedAt ?? new Date().toISOString(),
  };

  return {
    ...partial,
    explanation: input.externalFactorNotes
      ? `${buildExplanation(partial)} ${input.externalFactorNotes}`
      : buildExplanation(partial),
  };
}

/** Convenience: score a simple predicted vs actual pair for tests / briefs */
export function scoreDecisionOutcome(args: {
  decisionId: string;
  predictedMonthly: number;
  actualMonthly: number;
  accepted?: boolean;
  confidencePct?: number;
  externalFactors?: DecisionValidationInput["externalFactors"];
  notes?: string;
}): DecisionValidationReport {
  return buildDecisionValidationReport({
    decisionId: args.decisionId,
    recommendationAccepted: args.accepted ?? true,
    predicted: {
      netProfitMonthly: args.predictedMonthly,
      businessRecoveryMonthly: null,
      confidencePct: args.confidencePct ?? 90,
    },
    actual: {
      netProfitDeltaMonthly: args.actualMonthly,
      measuredAt: new Date().toISOString(),
      measurementWindowDays: 14,
    },
    externalFactors: args.externalFactors,
    externalFactorNotes: args.notes,
  });
}
