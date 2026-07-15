/**
 * Decision Validation — separate from Financial Trust.
 * Financial Trust: are the numbers correct?
 * Decision Validation: was this the right business action?
 */

export type BusinessOutcomeSentiment = "positive" | "neutral" | "negative";

export type DecisionQualityLabel =
  | "excellent"
  | "good"
  | "fair"
  | "poor"
  | "inconclusive";

export type RecommendationCorrectness = "correct" | "neutral" | "wrong";

export type ExternalDecisionFactor =
  | "meta_learning_phase"
  | "seasonality"
  | "stockout"
  | "pricing_change"
  | "creative_fatigue"
  | "merchant_override"
  | "market_shock"
  | "tracking_gap"
  | "other";

export type PredictedOutcome = {
  netProfitMonthly: number | null;
  businessRecoveryMonthly: number | null;
  expectedRoas?: number | null;
  expectedCpa?: number | null;
  confidencePct: number;
};

export type ActualOutcome = {
  netProfitDeltaMonthly: number | null;
  roasDelta?: number | null;
  cpaDelta?: number | null;
  measuredAt: string;
  measurementWindowDays: number;
};

export type DecisionValidationInput = {
  decisionId: string;
  title?: string;
  predicted: PredictedOutcome;
  actual: ActualOutcome | null;
  recommendationAccepted: boolean;
  /** Merchant overrode / rejected / changed the action */
  merchantOverride?: boolean;
  externalFactors?: ExternalDecisionFactor[];
  externalFactorNotes?: string;
};

export type DecisionValidationReport = {
  decisionId: string;
  title?: string;
  predictedOutcome: PredictedOutcome;
  actualOutcome: ActualOutcome | null;
  recommendationAccepted: boolean;
  businessImproved: boolean | null;
  /** 0–100: how close actual matched predicted magnitude/direction */
  predictionAccuracy: number | null;
  decisionQuality: DecisionQualityLabel;
  recommendationCorrect: RecommendationCorrectness | null;
  /** True when prediction was accurate but outcome still poor (external cause) */
  predictionAccurateDecisionWrong: boolean;
  explanation: string;
  externalFactors: ExternalDecisionFactor[];
  validatedAt: string;
};

export type DecisionAccuracyRollup = {
  sampleSize: number;
  correctPct: number;
  neutralPct: number;
  negativePct: number;
  avgPredictionAccuracy: number | null;
  excellentCount: number;
  /** Model accuracy for internal Decision Model Accuracy KPI */
  decisionModelAccuracyPct: number;
  windowLabel: string;
};

export type DecisionQualityModelGate = {
  /** Passes historical quality bar for Today's Executive Decision */
  passes: boolean;
  minRequiredAccuracyPct: number;
  observedAccuracyPct: number | null;
  sampleSize: number;
  minSampleSize: number;
  reason: string;
};

export type ContinuousLearningSignal = {
  decisionId: string;
  profitImproved: boolean | null;
  roasImproved: boolean | null;
  cpaImproved: boolean | null;
  merchantOverride: boolean;
  externalFactors: ExternalDecisionFactor[];
  marketConditionChanged: boolean;
  feedIntoModel: boolean;
  notes: string[];
};

/** Combined gate: Financial Trust Reality gate + Decision Quality */
export type ExecutiveTrustGate = {
  financialPasses: boolean;
  freshnessImplied: boolean;
  confidencePasses: boolean;
  decisionQualityPasses: boolean;
  allowTodaysExecutiveDecision: boolean;
  blockers: string[];
  warnings: string[];
  decisionModelAccuracyPct: number | null;
};
