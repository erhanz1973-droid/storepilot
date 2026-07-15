import { statusIsTrusted } from "./freshness";
import type {
  FinancialTrustScore,
  RealityKpiResult,
  RecommendationGateResult,
} from "./types";

const CRITICAL_CONFIDENCE_PENALTY: Record<string, number> = {
  revenue: 0.45,
  ad_spend: 0.4,
  orders: 0.25,
};

/**
 * AI Recommendation Gate — high-confidence recommendations require trusted critical data.
 */
export function buildRecommendationGate(
  results: RealityKpiResult[],
  trustScore: FinancialTrustScore,
): RecommendationGateResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const provisionalMetrics: string[] = [];
  let multiplier = 1;

  for (const r of results) {
    if (r.critical && !r.trusted) {
      const penalty = CRITICAL_CONFIDENCE_PENALTY[r.kpiId] ?? 0.35;
      multiplier *= 1 - penalty;
      if (r.status === "needs_investigation" || r.status === "missing_source") {
        blockers.push(
          `${r.label}: ${r.reason ?? r.status} — cannot issue high-confidence recommendations on unverified ${r.kpiId}.`,
        );
      } else if (!statusIsTrusted(r.status)) {
        warnings.push(`${r.label} is ${r.status}.`);
      } else {
        warnings.push(`${r.label} is stale or not fully trusted.`);
      }
    }

    if (r.profitSensitive && !statusIsTrusted(r.status)) {
      provisionalMetrics.push(r.kpiId);
      warnings.push(
        `${r.label} unverified — profit estimates are provisional.`,
      );
      multiplier *= 0.85;
    }

    if (r.status === "within_tolerance" && r.critical) {
      warnings.push(`${r.label} within tolerance (${formatPct(r.differencePct)}) — monitor.`);
      multiplier *= 0.97;
    }
  }

  if (trustScore.provisionalProfitEstimates) {
    provisionalMetrics.push("net_profit", "gross_profit");
  }

  if (trustScore.scorePct < 70) {
    blockers.push(
      `Financial Trust Score ${trustScore.scorePct}% is below 70% — Executive high-confidence actions are blocked.`,
    );
    multiplier = Math.min(multiplier, 0.5);
  } else if (trustScore.scorePct < 85) {
    warnings.push(`Financial Trust Score ${trustScore.scorePct}% — prefer lower confidence framing.`);
    multiplier *= 0.9;
  }

  multiplier = Math.max(0.2, Math.min(1, multiplier));
  const confidenceCeilingPct = Math.round(multiplier * 100);
  const allowHighConfidenceRecommendations =
    blockers.length === 0 && confidenceCeilingPct >= 70;

  return {
    allowHighConfidenceRecommendations,
    confidenceMultiplier: Math.round(multiplier * 1000) / 1000,
    confidenceCeilingPct,
    blockers,
    warnings: unique(warnings),
    provisionalMetrics: unique(provisionalMetrics),
  };
}

/**
 * Apply gate to a model confidence 0–100.
 */
export function applyRecommendationGateToConfidence(
  modelConfidencePct: number,
  gate: RecommendationGateResult,
): {
  adjustedConfidencePct: number;
  provisional: boolean;
  blockedHighConfidence: boolean;
} {
  const scaled = Math.round(modelConfidencePct * gate.confidenceMultiplier);
  const adjustedConfidencePct = Math.min(scaled, gate.confidenceCeilingPct);
  return {
    adjustedConfidencePct,
    provisional: gate.provisionalMetrics.length > 0,
    blockedHighConfidence: !gate.allowHighConfidenceRecommendations,
  };
}

function formatPct(p: number | null | undefined): string {
  if (p == null) return "n/a";
  return `${(p * 100).toFixed(2)}%`;
}

function unique(arr: string[]): string[] {
  return [...new Set(arr)];
}
