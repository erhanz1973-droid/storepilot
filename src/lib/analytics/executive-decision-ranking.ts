import type { DecisionImpact } from "@/lib/calculations/impact/engine";
import {
  buildDecisionImpactPresentation,
  calculateDecisionImpactFromInputs,
} from "@/lib/calculations/impact/engine";
import type { BusinessKPIs } from "@/lib/calculations/kpis/engine";
import type { DecisionItem } from "@/lib/decisions/center";
import type { StorePlanId } from "@/lib/billing/types";
import type { RecommendationGateResult } from "@/lib/calculations/reality/types";
import { applyRecommendationGateToConfidence } from "@/lib/calculations/reality/recommendation-gate";
import type { ExecutiveTrustGate } from "@/lib/decision-validation/types";
import { buildExecutiveTrustGate } from "@/lib/decision-validation/gate";
import type { DecisionQualityModelGate } from "@/lib/decision-validation/types";

/**
 * Executive Mode ranking — never pick a "$0" or below-threshold action as Today's #1.
 */

export type ExecutiveTier = "starter" | "growth" | "enterprise";

export const EXECUTIVE_NET_PROFIT_THRESHOLDS: Record<ExecutiveTier, number> = {
  starter: 100,
  growth: 500,
  enterprise: 2000,
};

export const EXECUTIVE_MIN_CONFIDENCE_PCT = 70;

/** 0–100 composite readiness bar for “why no executive action yet” */
export const EXECUTIVE_ACTION_THRESHOLD_PCT = 75;

export type ExecutiveCandidate = {
  id: string;
  title: string;
  description: string;
  impactLabel: string;
  confidencePct: number;
  priority: DecisionItem["priority"] | "high" | "medium" | "low" | "critical";
  risk: "low" | "medium" | "high";
  decisionId?: string;
  recommendationId?: string;
  opportunityKey?: string;
  entityName?: string;
  futureAction?: string;
  entityType?: DecisionItem["entityType"];
  suggestedAction?: string;
  /** Precomputed monthly figures when label lacks dollars */
  knownBusinessRecovery?: number;
  knownNetProfit?: number;
};

export type RankedExecutiveDecision = {
  candidate: ExecutiveCandidate;
  impact: DecisionImpact;
  executiveScore: number;
  eligible: true;
};

export type ExecutiveDecisionSelection =
  | { kind: "decision"; ranked: RankedExecutiveDecision }
  | {
      kind: "none";
      reason: "no_candidates" | "none_eligible";
      message: string;
      detail: string;
    };

function planToTier(planId?: StorePlanId | null): ExecutiveTier {
  if (planId === "starter") return "growth";
  return "starter";
}

const URGENCY: Record<string, number> = {
  critical: 1.35,
  high: 1.15,
  medium: 1,
  low: 0.85,
};

const RISK_DIVISOR: Record<string, number> = {
  low: 1,
  medium: 1.25,
  high: 1.6,
};

const STRATEGIC: Record<string, number> = {
  campaign: 1.2,
  product: 1.1,
  collection: 1,
  channel: 1.1,
  audience: 1,
};

export function resolveExecutiveNetProfitThreshold(
  planId?: StorePlanId | null,
  overrideTier?: ExecutiveTier,
): number {
  const tier = overrideTier ?? planToTier(planId);
  return EXECUTIVE_NET_PROFIT_THRESHOLDS[tier];
}

export function computeDecisionImpactForCandidate(
  candidate: ExecutiveCandidate,
  kpis?: BusinessKPIs | null,
): DecisionImpact {
  const category =
    candidate.entityType === "campaign" ? "campaign_review" : undefined;

  let impact = calculateDecisionImpactFromInputs(
    {
      expectedImpactLabel: candidate.impactLabel || "",
      category,
      confidenceScore: candidate.confidencePct <= 1
        ? candidate.confidencePct
        : candidate.confidencePct / 100,
    },
    kpis ?? undefined,
  );

  const knownRecovery = candidate.knownBusinessRecovery ?? 0;
  const knownNet = candidate.knownNetProfit ?? 0;

  // If label parse yields $0 but we already have ranked amounts, use structured inputs.
  if (impact.businessRecovery <= 0 && impact.netProfitImpact <= 0 && (knownRecovery > 0 || knownNet > 0)) {
    const syntheticLabel =
      knownNet > 0
        ? `+$${Math.round(knownNet).toLocaleString()}/mo net profit`
        : `+$${Math.round(knownRecovery).toLocaleString()}/mo`;
    impact = calculateDecisionImpactFromInputs(
      {
        expectedImpactLabel: syntheticLabel,
        category,
        confidenceScore: candidate.confidencePct <= 1
          ? candidate.confidencePct
          : candidate.confidencePct / 100,
      },
      kpis ?? undefined,
    );

    // Still zero? Force from known structured amounts via label with both metrics.
    if (impact.businessRecovery <= 0 && impact.netProfitImpact <= 0) {
      const hero = Math.max(knownRecovery, knownNet);
      const net = knownNet > 0 ? knownNet : knownRecovery;
      impact = calculateDecisionImpactFromInputs(
        {
          expectedImpactLabel: `Recoverable ~$${Math.round(hero).toLocaleString()}/mo (~$${Math.round(net).toLocaleString()}/mo profit preserved)`,
          category: category ?? "campaign_review",
          confidenceScore: candidate.confidencePct <= 1
            ? candidate.confidencePct
            : candidate.confidencePct / 100,
        },
        kpis ?? undefined,
      );
    }
  }

  // Trust rule: hero never below net profit, never leave a positive net as $0 hero
  const businessRecovery = Math.max(impact.businessRecovery, impact.netProfitImpact);
  const netProfitImpact = impact.netProfitImpact > 0 ? impact.netProfitImpact : businessRecovery;

  return {
    ...impact,
    businessRecovery,
    netProfitImpact,
    monthlyProfitRecovery: netProfitImpact,
    expectedProfit: netProfitImpact,
    cashFlowImpact: impact.cashFlowImpact > 0 ? impact.cashFlowImpact : netProfitImpact,
  };
}

export function executiveScore(
  impact: DecisionImpact,
  candidate: ExecutiveCandidate,
): number {
  const recovery = Math.max(impact.businessRecovery, impact.netProfitImpact);
  const confidence =
    impact.confidence > 0
      ? impact.confidence / 100
      : candidate.confidencePct <= 1
        ? candidate.confidencePct
        : candidate.confidencePct / 100;
  const urgency = URGENCY[candidate.priority] ?? 1;
  const strategic = STRATEGIC[candidate.entityType ?? ""] ?? 1;
  const risk = RISK_DIVISOR[candidate.risk] ?? 1.25;

  return (recovery * confidence * urgency * strategic) / risk;
}

/**
 * 0–100 evidence readiness for Executive Action Threshold UI.
 * Eligible decisions score ≥ EXECUTIVE_ACTION_THRESHOLD_PCT.
 */
export function executiveReadinessPct(
  impact: DecisionImpact,
  candidate: ExecutiveCandidate,
  opts?: { planId?: StorePlanId | null; minNetProfit?: number; minConfidencePct?: number },
): number {
  const minNet =
    opts?.minNetProfit ?? resolveExecutiveNetProfitThreshold(opts?.planId ?? null);
  const minConf = opts?.minConfidencePct ?? EXECUTIVE_MIN_CONFIDENCE_PCT;
  const recovery = Math.max(impact.businessRecovery, impact.netProfitImpact);
  const net = impact.netProfitImpact;
  const confidence =
    impact.confidence > 0
      ? impact.confidence
      : candidate.confidencePct <= 1
        ? Math.round(candidate.confidencePct * 100)
        : Math.round(candidate.confidencePct);

  // Confidence component (0–40): full at minConf+
  const confPts = Math.min(40, Math.round((confidence / Math.max(minConf, 1)) * 40));

  // Impact component (0–40): full when net/recovery clears minNet
  const impactBasis = Math.max(net, recovery);
  const impactPts =
    impactBasis <= 0
      ? 0
      : Math.min(40, Math.round((impactBasis / Math.max(minNet, 1)) * 40));

  // Risk/priority component (0–20)
  const riskPts = candidate.risk === "low" ? 20 : candidate.risk === "medium" ? 12 : 6;
  const urgentPts = candidate.priority === "critical" || candidate.priority === "high" ? 0 : 0;
  void urgentPts;

  let total = confPts + impactPts + Math.min(20, riskPts);
  if (isEligibleExecutiveDecision(impact, candidate, opts)) {
    total = Math.max(total, EXECUTIVE_ACTION_THRESHOLD_PCT);
  }
  return Math.max(0, Math.min(100, total));
}

export type ExecutiveThresholdPeek = {
  title: string;
  readinessPct: number;
  requiredPct: number;
  eligible: boolean;
  clearsThreshold: boolean;
};

/** Inspect best opportunity for threshold UI — even when none are Executive-eligible. */
export function peekExecutiveActionThreshold(
  candidates: ExecutiveCandidate[],
  opts?: {
    planId?: StorePlanId | null;
    kpis?: BusinessKPIs | null;
    minNetProfit?: number;
    minConfidencePct?: number;
  },
): ExecutiveThresholdPeek | null {
  if (candidates.length === 0) return null;

  let best: ExecutiveThresholdPeek | null = null;

  for (const candidate of candidates) {
    const impact = computeDecisionImpactForCandidate(candidate, opts?.kpis);
    const readinessPct = executiveReadinessPct(impact, candidate, opts);
    const eligible = isEligibleExecutiveDecision(impact, candidate, opts);
    const row: ExecutiveThresholdPeek = {
      title: candidate.title,
      readinessPct,
      requiredPct: EXECUTIVE_ACTION_THRESHOLD_PCT,
      eligible,
      clearsThreshold: readinessPct >= EXECUTIVE_ACTION_THRESHOLD_PCT && eligible,
    };
    if (!best || row.readinessPct > best.readinessPct) best = row;
  }

  return best;
}

export function isEligibleExecutiveDecision(
  impact: DecisionImpact,
  candidate: ExecutiveCandidate,
  opts?: {
    planId?: StorePlanId | null;
    minNetProfit?: number;
    minConfidencePct?: number;
    /** Reality Validation gate — blocks high-confidence when critical data unverified */
    realityGate?: RecommendationGateResult | null;
    /** Historical Decision Quality model gate */
    decisionQualityGate?: DecisionQualityModelGate | null;
    /** Precomputed combined gate (Financial + Decision Quality) */
    executiveTrustGate?: ExecutiveTrustGate | null;
  },
): boolean {
  const recovery = Math.max(impact.businessRecovery, impact.netProfitImpact);
  const net = impact.netProfitImpact;
  let confidence =
    impact.confidence > 0
      ? impact.confidence
      : candidate.confidencePct <= 1
        ? Math.round(candidate.confidencePct * 100)
        : Math.round(candidate.confidencePct);

  const minConf = opts?.minConfidencePct ?? EXECUTIVE_MIN_CONFIDENCE_PCT;

  const trustGate =
    opts?.executiveTrustGate ??
    (opts?.realityGate || opts?.decisionQualityGate
      ? buildExecutiveTrustGate({
          realityGate: opts.realityGate,
          decisionQualityGate: opts.decisionQualityGate,
          modelConfidencePct: confidence,
          minConfidencePct: minConf,
        })
      : null);

  if (trustGate && !trustGate.allowTodaysExecutiveDecision) {
    return false;
  }

  if (opts?.realityGate) {
    const adjusted = applyRecommendationGateToConfidence(confidence, opts.realityGate);
    confidence = adjusted.adjustedConfidencePct;
  }

  const minNet =
    opts?.minNetProfit ?? resolveExecutiveNetProfitThreshold(opts?.planId ?? null);

  if (recovery <= 0) return false;
  if (net < minNet && recovery < minNet) return false;
  if (confidence < minConf) return false;
  return true;
}

export function selectTodaysExecutiveDecision(
  candidates: ExecutiveCandidate[],
  opts?: {
    planId?: StorePlanId | null;
    kpis?: BusinessKPIs | null;
    minNetProfit?: number;
    minConfidencePct?: number;
    realityGate?: RecommendationGateResult | null;
    decisionQualityGate?: DecisionQualityModelGate | null;
    executiveTrustGate?: ExecutiveTrustGate | null;
  },
): ExecutiveDecisionSelection {
  if (candidates.length === 0) {
    return {
      kind: "none",
      reason: "no_candidates",
      message: "No executive decision required today.",
      detail:
        "Your business is operating within acceptable thresholds. We'll notify you when a meaningful opportunity appears.",
    };
  }

  const ranked: RankedExecutiveDecision[] = [];

  for (const candidate of candidates) {
    const impact = computeDecisionImpactForCandidate(candidate, opts?.kpis);
    if (!isEligibleExecutiveDecision(impact, candidate, opts)) continue;

    let scoreImpact = impact;
    if (opts?.realityGate) {
      const adjusted = applyRecommendationGateToConfidence(
        impact.confidence,
        opts.realityGate,
      );
      scoreImpact = { ...impact, confidence: adjusted.adjustedConfidencePct };
    }

    ranked.push({
      candidate,
      impact: scoreImpact,
      executiveScore: executiveScore(scoreImpact, candidate),
      eligible: true,
    });
  }

  ranked.sort((a, b) => b.executiveScore - a.executiveScore);

  if (ranked.length === 0) {
    return {
      kind: "none",
      reason: "none_eligible",
      message: "No executive decision required today.",
      detail:
        "Your business is operating within acceptable thresholds. We'll notify you when a meaningful opportunity appears.",
    };
  }

  return { kind: "decision", ranked: ranked[0] };
}

export function candidatesFromOpenDecisions(
  decisions: DecisionItem[],
): ExecutiveCandidate[] {
  return decisions
    .filter((d) => d.status === "open" || d.status === "viewed")
    .map((d) => ({
      id: d.id,
      title: d.summary,
      description: d.why,
      impactLabel: d.estimatedImpactLabel,
      confidencePct: d.confidencePct,
      priority: d.priority,
      risk:
        d.priority === "critical"
          ? "high"
          : d.priority === "high"
            ? "medium"
            : "low",
      decisionId: d.id,
      recommendationId: d.recommendationId,
      opportunityKey: d.opportunityKey,
      entityName: d.entityName,
      futureAction: d.futureAction,
      entityType: d.entityType,
      suggestedAction: d.recommendedAction,
    }));
}

export { buildDecisionImpactPresentation };
