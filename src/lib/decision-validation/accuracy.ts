import type {
  DecisionAccuracyRollup,
  DecisionQualityModelGate,
  DecisionValidationReport,
} from "./types";

export const DEFAULT_MIN_DECISION_SAMPLE = 20;
export const DEFAULT_MIN_MODEL_ACCURACY_PCT = 75;

/**
 * Roll up historical DecisionValidationReports into Recommendation Accuracy KPI.
 */
export function buildDecisionAccuracyRollup(
  reports: DecisionValidationReport[],
  opts?: { windowLabel?: string; limit?: number },
): DecisionAccuracyRollup {
  const limited = (opts?.limit ? reports.slice(0, opts.limit) : reports).filter(
    (r) => r.recommendationAccepted && r.recommendationCorrect != null,
  );

  const sampleSize = limited.length;
  if (sampleSize === 0) {
    return {
      sampleSize: 0,
      correctPct: 0,
      neutralPct: 0,
      negativePct: 0,
      avgPredictionAccuracy: null,
      excellentCount: 0,
      decisionModelAccuracyPct: 0,
      windowLabel: opts?.windowLabel ?? "No validated outcomes yet",
    };
  }

  const correct = limited.filter((r) => r.recommendationCorrect === "correct").length;
  const neutral = limited.filter((r) => r.recommendationCorrect === "neutral").length;
  const negative = limited.filter((r) => r.recommendationCorrect === "wrong").length;
  const accuracies = limited
    .map((r) => r.predictionAccuracy)
    .filter((a): a is number => a != null);
  const avgPredictionAccuracy =
    accuracies.length > 0
      ? Math.round(accuracies.reduce((s, a) => s + a, 0) / accuracies.length)
      : null;

  const excellentCount = limited.filter((r) => r.decisionQuality === "excellent").length;

  // Model accuracy = correct share (primary product KPI)
  const decisionModelAccuracyPct = Math.round((correct / sampleSize) * 1000) / 10;

  return {
    sampleSize,
    correctPct: Math.round((correct / sampleSize) * 1000) / 10,
    neutralPct: Math.round((neutral / sampleSize) * 1000) / 10,
    negativePct: Math.round((negative / sampleSize) * 1000) / 10,
    avgPredictionAccuracy,
    excellentCount,
    decisionModelAccuracyPct,
    windowLabel: opts?.windowLabel ?? `Last ${sampleSize} Executive Decisions`,
  };
}

/**
 * Decision Quality model gate — Today's Executive Decision requires enough history + accuracy.
 * Cold start (low sample): passes with warning semantics (caller may still warn).
 */
export function evaluateDecisionQualityGate(
  rollup: DecisionAccuracyRollup,
  opts?: { minSampleSize?: number; minAccuracyPct?: number },
): DecisionQualityModelGate {
  const minSampleSize = opts?.minSampleSize ?? DEFAULT_MIN_DECISION_SAMPLE;
  const minRequiredAccuracyPct = opts?.minAccuracyPct ?? DEFAULT_MIN_MODEL_ACCURACY_PCT;

  if (rollup.sampleSize === 0) {
    return {
      passes: true,
      minRequiredAccuracyPct,
      observedAccuracyPct: null,
      sampleSize: 0,
      minSampleSize,
      reason: "Cold start — no validated outcomes yet; decision quality gate deferred.",
    };
  }

  if (rollup.sampleSize < minSampleSize) {
    return {
      passes: true,
      minRequiredAccuracyPct,
      observedAccuracyPct: rollup.decisionModelAccuracyPct,
      sampleSize: rollup.sampleSize,
      minSampleSize,
      reason: `Warming up — ${rollup.sampleSize}/${minSampleSize} validated outcomes; gate soft-open.`,
    };
  }

  const passes = rollup.decisionModelAccuracyPct >= minRequiredAccuracyPct;
  return {
    passes,
    minRequiredAccuracyPct,
    observedAccuracyPct: rollup.decisionModelAccuracyPct,
    sampleSize: rollup.sampleSize,
    minSampleSize,
    reason: passes
      ? `Decision Model Accuracy ${rollup.decisionModelAccuracyPct}% ≥ ${minRequiredAccuracyPct}% across ${rollup.sampleSize} outcomes.`
      : `Decision Model Accuracy ${rollup.decisionModelAccuracyPct}% is below ${minRequiredAccuracyPct}% — withhold Today's Executive Decision until quality recovers.`,
  };
}
