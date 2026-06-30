import type { EnrichedDecisionItem } from "@/lib/decisions/engine/types";
import { decisionProblemKey } from "@/lib/decisions/engine/merge";
import type {
  DecisionCompletenessCheck,
  DecisionCompletenessStatus,
} from "./types";
import { extractProviderSources, extractValidationScore } from "./types";
import { computeDecisionQualityScore } from "./quality-score";

const MIN_QUALITY_FOR_COMPLETE = 50;

function requiresStrategyComparison(item: EnrichedDecisionItem): boolean {
  if (item.isGroupedAction) return true;
  if (item.entityType === "product") return true;
  const summary = item.summary.toLowerCase();
  return (
    summary.includes("inventory") ||
    summary.includes("slow") ||
    summary.includes("dead") ||
    summary.includes("bundle") ||
    summary.includes("pricing")
  );
}

export function validateDecisionCompleteness(
  item: EnrichedDecisionItem,
): {
  status: DecisionCompletenessStatus;
  checks: DecisionCompletenessCheck[];
} {
  const checks: DecisionCompletenessCheck[] = [];
  const providerSources = extractProviderSources(item);
  const validationScore = extractValidationScore(item);

  checks.push({
    field: "reason",
    label: "Reason",
    passed: Boolean(item.why?.trim()),
    detail: item.why?.trim() ? undefined : "Missing explanation",
  });

  const hasEvidence =
    item.supportingMetrics.length > 0 ||
    (item.validation?.evidence?.length ?? 0) > 0;
  checks.push({
    field: "evidence",
    label: "Evidence",
    passed: hasEvidence,
    detail: hasEvidence ? undefined : "No supporting metrics or validation evidence",
  });

  const needsStrategy = requiresStrategyComparison(item);
  checks.push({
    field: "strategyComparison",
    label: "Strategy Comparison",
    passed: needsStrategy ? Boolean(item.strategyComparison) : Boolean(item.strategyComparison || item.why.length > 40),
    detail: needsStrategy && !item.strategyComparison
      ? "Product/inventory decisions require strategy simulation"
      : undefined,
  });

  checks.push({
    field: "expectedImpact",
    label: "Expected Impact",
    passed: Boolean(item.estimatedImpactLabel?.trim()),
  });

  checks.push({
    field: "validationScore",
    label: "Validation Score",
    passed: validationScore !== null && validationScore > 0,
    detail:
      validationScore === null ? "No validation score" : validationScore <= 0 ? "Zero validation" : undefined,
  });

  checks.push({
    field: "confidence",
    label: "Confidence",
    passed: item.confidencePct > 0 && Number.isFinite(item.confidencePct),
    detail: item.confidencePct <= 0 ? "Missing or zero confidence" : undefined,
  });

  checks.push({
    field: "providerSources",
    label: "Provider Sources",
    passed: providerSources.length > 0,
    detail: providerSources.length === 0 ? "No provider sources" : undefined,
  });

  const allPassed = checks.every((c) => c.passed);
  const status: DecisionCompletenessStatus = allPassed ? "complete" : "incomplete";

  return { status, checks };
}

export function filterMerchantReadyDecisions<T extends EnrichedDecisionItem>(
  decisions: T[],
  options?: { minQualityPct?: number },
): T[] {
  const minQuality = options?.minQualityPct ?? MIN_QUALITY_FOR_COMPLETE;
  return decisions.filter((item) => {
    const { status } = validateDecisionCompleteness(item);
    const quality =
      (item as { qualityScorePct?: number }).qualityScorePct ??
      computeDecisionQualityScore(item);
    return status === "complete" && quality >= minQuality;
  });
}

export function assertNoDuplicateProblemKeys(
  decisions: EnrichedDecisionItem[],
): boolean {
  const keys = decisions.map((d) => d.problemKey ?? decisionProblemKey(d));
  return keys.length === new Set(keys).size;
}
