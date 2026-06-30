import type { EnrichedDecisionItem } from "@/lib/decisions/engine/types";
import { extractValidationScore } from "./types";

export function computeDecisionQualityScore(item: EnrichedDecisionItem): number {
  const validationScore = extractValidationScore(item) ?? 0;
  const explainability = item.explainability?.scorePct ?? 0;
  const confidence = item.confidencePct ?? 0;

  const evidenceCount =
    item.supportingMetrics.length +
    (item.validation?.evidence?.length ?? 0) +
    (item.validation?.calculationBasis?.length ?? 0);
  const evidenceScore =
    evidenceCount >= 5 ? 100 : evidenceCount >= 3 ? 80 : evidenceCount >= 1 ? 55 : 0;

  const strategyScore = item.strategyComparison
    ? 100
    : item.explainability?.hasStrategyComparison
      ? 100
      : 25;

  const score =
    evidenceScore * 0.25 +
    explainability * 0.25 +
    Math.min(100, validationScore) * 0.2 +
    Math.min(100, confidence) * 0.15 +
    strategyScore * 0.15;

  const rounded = Math.round(score);
  if (!Number.isFinite(rounded)) return 0;
  return Math.min(100, Math.max(0, rounded));
}
