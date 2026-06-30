import type { EnrichedDecisionItem } from "@/lib/decisions/engine/types";
import { decisionProblemKey } from "@/lib/decisions/engine/merge";
import type { ConsistencyCheckResult } from "./types";
import {
  extractProviderSources,
  extractValidationScore,
} from "./types";

function checkAll(
  decisions: EnrichedDecisionItem[],
  id: string,
  label: string,
  predicate: (item: EnrichedDecisionItem) => boolean,
  failDetail: (item: EnrichedDecisionItem) => string,
): ConsistencyCheckResult {
  const failures = decisions.filter((d) => !predicate(d));
  return {
    id,
    label,
    passed: failures.length === 0,
    detail:
      failures.length === 0
        ? undefined
        : `${failures.length} failed: ${failures.slice(0, 3).map((f) => f.id).join(", ")}${failures.length > 3 ? "…" : ""} — e.g. ${failDetail(failures[0]!)}`,
  };
}

export function runConsistencyChecks(
  decisions: EnrichedDecisionItem[],
): ConsistencyCheckResult[] {
  const problemKeys = decisions.map((d) => d.problemKey ?? decisionProblemKey(d));
  const uniqueKeys = new Set(problemKeys);

  const checks: ConsistencyCheckResult[] = [
    {
      id: "no_duplicates",
      label: "No duplicate decisions",
      passed: uniqueKeys.size === problemKeys.length,
      detail:
        uniqueKeys.size < problemKeys.length
          ? `Duplicate problem keys detected (${problemKeys.length - uniqueKeys.size})`
          : undefined,
    },
    checkAll(
      decisions,
      "has_evidence",
      "Every decision has evidence",
      (d) =>
        d.supportingMetrics.length > 0 ||
        (d.validation?.evidence?.length ?? 0) > 0,
      (d) => d.summary,
    ),
    checkAll(
      decisions,
      "has_confidence",
      "Every decision has confidence",
      (d) => d.confidencePct > 0 && Number.isFinite(d.confidencePct),
      (d) => `confidence=${d.confidencePct}`,
    ),
    checkAll(
      decisions,
      "has_validation_score",
      "Every decision has validation score",
      (d) => {
        const score = extractValidationScore(d);
        return score !== null && score > 0;
      },
      (d) => "no validation score",
    ),
    checkAll(
      decisions,
      "has_explainability",
      "Every decision has explainability score",
      (d) =>
        d.explainability != null &&
        d.explainability.scorePct > 0 &&
        Number.isFinite(d.explainability.scorePct),
      (d) => "missing explainability",
    ),
    checkAll(
      decisions,
      "has_strategy_comparison",
      "Every decision has strategy comparison",
      (d) => {
        const summary = d.summary.toLowerCase();
        const needsProductStrategy =
          d.entityType === "product" ||
          d.isGroupedAction ||
          summary.includes("inventory");
        if (!needsProductStrategy) return true;
        return Boolean(d.strategyComparison);
      },
      (d) => d.summary,
    ),
    checkAll(
      decisions,
      "has_provider_sources",
      "Every decision has provider sources",
      (d) => extractProviderSources(d).length > 0,
      () => "no providers",
    ),
  ];

  return checks;
}

export function consistencyAllPassed(checks: ConsistencyCheckResult[]): boolean {
  return checks.every((c) => c.passed);
}
