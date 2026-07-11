/**
 * Shared recovery estimation — used by Executive, Marketing, and Traffic.
 * Recovery is capped relative to documented loss and never exceeds realistic bounds.
 */

export type RecoveryCategory =
  | "traffic_channel"
  | "traffic_landing"
  | "traffic_mobile"
  | "traffic_organic"
  | "marketing_campaign"
  | "marketing_budget";

export type RecoveryEstimateInput = {
  /** Documented monthly loss or spend at risk (0 for pure growth plays). */
  maxRecoverableMonthly: number;
  /** Severity of the performance gap, 0–1. */
  gapSeverity: number;
  /** Model confidence, 0–100. */
  confidencePct: number;
  /** Optional growth ceiling when maxRecoverableMonthly is 0. */
  growthBaseMonthly?: number;
};

const MAX_RECOVERY_RATE = 0.5;

export function estimateMonthlyRecovery(input: RecoveryEstimateInput): {
  amountMonthly: number;
  probabilityPct: number;
} {
  const gap = Math.min(1, Math.max(0, input.gapSeverity));
  const confidence = Math.min(100, Math.max(0, input.confidencePct));
  const probabilityPct = Math.round(confidence * (0.4 + gap * 0.6));

  if (input.maxRecoverableMonthly > 0) {
    const cap = Math.round(input.maxRecoverableMonthly * MAX_RECOVERY_RATE);
    const raw = cap * gap * (confidence / 100);
    return {
      amountMonthly: Math.max(0, Math.min(Math.round(raw), cap)),
      probabilityPct,
    };
  }

  const growthBase = input.growthBaseMonthly ?? 0;
  if (growthBase <= 0) {
    return { amountMonthly: 0, probabilityPct };
  }

  const cap = Math.round(growthBase * 0.2);
  const raw = growthBase * gap * (confidence / 100) * 0.2;
  return {
    amountMonthly: Math.max(0, Math.min(Math.round(raw), cap)),
    probabilityPct,
  };
}

/** Marketing campaign recovery — replaces ad-hoc multipliers. */
export function estimateCampaignRecovery(input: {
  weeklyProfit: number | null;
  weeklySpend: number;
  recoveryProbabilityPct: number;
  recommendation: string;
}): number {
  if (input.recommendation === "pause_campaign" && input.weeklyProfit != null && input.weeklyProfit < 0) {
    return estimateMonthlyRecovery({
      maxRecoverableMonthly: Math.abs(input.weeklyProfit) * 4.33,
      gapSeverity: 0.85,
      confidencePct: input.recoveryProbabilityPct,
    }).amountMonthly;
  }

  if (
    input.recommendation === "optimize_campaign" ||
    input.recommendation === "reduce_budget" ||
    input.recommendation === "improve_creative" ||
    input.recommendation === "review_audience" ||
    input.recommendation === "landing_page_issue"
  ) {
    return estimateMonthlyRecovery({
      maxRecoverableMonthly: input.weeklySpend * 4.33 * 0.25,
      gapSeverity: 0.55,
      confidencePct: input.recoveryProbabilityPct,
    }).amountMonthly;
  }

  if (input.recommendation === "increase_budget" || input.recommendation === "scale") {
    return estimateMonthlyRecovery({
      maxRecoverableMonthly: 0,
      gapSeverity: 0.45,
      confidencePct: input.recoveryProbabilityPct,
      growthBaseMonthly: input.weeklySpend * 4.33 * 0.15,
    }).amountMonthly;
  }

  return estimateMonthlyRecovery({
    maxRecoverableMonthly: input.weeklySpend * 4.33 * 0.1,
    gapSeverity: 0.35,
    confidencePct: input.recoveryProbabilityPct,
  }).amountMonthly;
}

/** Platform-level marketing recoverable profit. */
export function estimatePlatformRecoverable(input: {
  losingWeeklyProfit: number;
  atRiskWeeklySpend: number;
  avgRecoveryProbabilityPct: number;
}): number {
  const lossRecovery =
    input.losingWeeklyProfit < 0
      ? estimateMonthlyRecovery({
          maxRecoverableMonthly: Math.abs(input.losingWeeklyProfit) * 4.33,
          gapSeverity: 0.7,
          confidencePct: input.avgRecoveryProbabilityPct,
        }).amountMonthly
      : 0;

  const spendRecovery =
    input.atRiskWeeklySpend > 0
      ? estimateMonthlyRecovery({
          maxRecoverableMonthly: input.atRiskWeeklySpend * 4.33,
          gapSeverity: 0.4,
          confidencePct: input.avgRecoveryProbabilityPct,
        }).amountMonthly
      : 0;

  const monthlySpend = input.atRiskWeeklySpend * 4.33;
  const spendCap = monthlySpend > 0 ? Math.round(monthlySpend * MAX_RECOVERY_RATE) : Infinity;

  return Math.min(Math.round(lossRecovery + spendRecovery * 0.5), spendCap);
}
