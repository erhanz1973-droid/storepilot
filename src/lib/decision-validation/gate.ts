import type { RecommendationGateResult } from "@/lib/calculations/reality/types";
import type {
  ContinuousLearningSignal,
  DecisionQualityModelGate,
  DecisionValidationReport,
  ExecutiveTrustGate,
} from "./types";

/**
 * Combined recommendation gate for Today's Executive Decision:
 * Financial Trust + freshness (via reality gate) + confidence + Decision Quality model.
 */
export function buildExecutiveTrustGate(input: {
  realityGate?: RecommendationGateResult | null;
  decisionQualityGate?: DecisionQualityModelGate | null;
  modelConfidencePct: number;
  minConfidencePct?: number;
}): ExecutiveTrustGate {
  const minConf = input.minConfidencePct ?? 70;
  const reality = input.realityGate;
  const dq = input.decisionQualityGate;

  const blockers: string[] = [];
  const warnings: string[] = [];

  const financialPasses = reality ? reality.allowHighConfidenceRecommendations : true;
  if (reality && !financialPasses) {
    blockers.push(...reality.blockers);
  }
  if (reality?.warnings?.length) {
    warnings.push(...reality.warnings);
  }

  // Reality trusted KPIs imply freshness for critical paths; stale critical already blocks allowHighConfidence
  const freshnessImplied = reality
    ? reality.allowHighConfidenceRecommendations || reality.blockers.every((b) => !/stale/i.test(b))
    : true;

  let effectiveConfidence = input.modelConfidencePct;
  if (reality) {
    effectiveConfidence = Math.min(
      Math.round(input.modelConfidencePct * reality.confidenceMultiplier),
      reality.confidenceCeilingPct,
    );
  }
  const confidencePasses = effectiveConfidence >= minConf;
  if (!confidencePasses) {
    blockers.push(
      `Confidence ${effectiveConfidence}% is below ${minConf}% after financial trust adjustments.`,
    );
  }

  const decisionQualityPasses = dq ? dq.passes : true;
  if (dq && !dq.passes) {
    blockers.push(dq.reason);
  } else if (dq && dq.sampleSize > 0 && dq.sampleSize < dq.minSampleSize) {
    warnings.push(dq.reason);
  }

  return {
    financialPasses,
    freshnessImplied,
    confidencePasses,
    decisionQualityPasses,
    allowTodaysExecutiveDecision:
      blockers.length === 0 &&
      financialPasses &&
      confidencePasses &&
      decisionQualityPasses,
    blockers,
    warnings,
    decisionModelAccuracyPct: dq?.observedAccuracyPct ?? null,
  };
}

/**
 * Continuous learning signals from a completed DecisionValidationReport.
 */
export function buildContinuousLearningSignal(
  report: DecisionValidationReport,
  opts?: { merchantOverride?: boolean },
): ContinuousLearningSignal {
  const actual = report.actualOutcome;
  const notes: string[] = [];

  const profitImproved =
    actual?.netProfitDeltaMonthly == null
      ? null
      : actual.netProfitDeltaMonthly > 0;
  const roasImproved =
    actual?.roasDelta == null ? null : actual.roasDelta > 0;
  const cpaImproved =
    actual?.cpaDelta == null ? null : actual.cpaDelta < 0; // lower CPA is better

  if (profitImproved === true) notes.push("Profit improved after recommendation.");
  if (profitImproved === false) notes.push("Profit did not improve after recommendation.");
  if (roasImproved === true) notes.push("ROAS improved.");
  if (cpaImproved === true) notes.push("CPA improved.");
  if (opts?.merchantOverride || report.externalFactors.includes("merchant_override")) {
    notes.push("Merchant manually overrode the recommendation.");
  }
  if (report.externalFactors.length > 0) {
    notes.push(`External factors: ${report.externalFactors.join(", ")}.`);
  }
  if (report.predictionAccurateDecisionWrong) {
    notes.push(
      "Prediction was accurate but decision underperformed — refine strategy filters, not only formulas.",
    );
  }

  const marketConditionChanged = report.externalFactors.some((f) =>
    ["seasonality", "market_shock", "meta_learning_phase", "stockout"].includes(f),
  );

  return {
    decisionId: report.decisionId,
    profitImproved,
    roasImproved,
    cpaImproved,
    merchantOverride: Boolean(
      opts?.merchantOverride || report.externalFactors.includes("merchant_override"),
    ),
    externalFactors: report.externalFactors,
    marketConditionChanged,
    feedIntoModel: report.recommendationAccepted && report.actualOutcome != null,
    notes,
  };
}
