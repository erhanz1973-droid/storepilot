import type { EnrichedDecisionItem } from "@/lib/decisions/engine/types";
import { decisionProblemKey } from "@/lib/decisions/engine/merge";
import type { DecisionTraceStep } from "./types";
import { extractProviderSources, extractValidationScore } from "./types";

export function buildDecisionTrace(item: EnrichedDecisionItem): DecisionTraceStep[] {
  const steps: DecisionTraceStep[] = [
    {
      stage: "provider_data",
      label: "Provider Data",
      detail: extractProviderSources(item).join(", ") || "demo / disconnected",
    },
    {
      stage: "validation",
      label: "Validation",
      detail:
        extractValidationScore(item) != null
          ? `Score ${extractValidationScore(item)}%`
          : item.validationGate?.canGenerateRecommendations
            ? "Gate passed"
            : "Limited validation",
    },
    {
      stage: "business_rules",
      label: "Business Rules",
      detail: `Priority ${item.priority} · Source ${item.source}${item.groupKey ? ` · Group ${item.groupKey}` : ""}`,
    },
  ];

  if (item.strategyComparison) {
    steps.push({
      stage: "strategy_simulation",
      label: "Strategy Simulation",
      detail: `${item.strategyComparison.strategies.length} strategies evaluated`,
    });
    steps.push({
      stage: "ranking",
      label: "Ranking",
      detail: `Mode ${item.merchantMode ?? "profit"} · composite scores applied`,
    });
    steps.push({
      stage: "winner",
      label: "Winner",
      detail: item.strategyComparison.recommended.label,
    });
  } else {
    steps.push({
      stage: "ranking",
      label: "Ranking",
      detail: `Priority score ${item.priorityScore}`,
    });
  }

  steps.push({
    stage: "evidence",
    label: "Evidence",
    detail: `${item.supportingMetrics.length} metrics · explainability ${item.explainability?.scorePct ?? "—"}%`,
  });

  steps.push({
    stage: "decision",
    label: "Decision",
    detail: `${item.summary} → ${item.recommendedAction}`,
  });

  if (item.mergedFrom?.length) {
    steps.splice(2, 0, {
      stage: "merge",
      label: "Merge",
      detail: `Consolidated ${item.mergedFrom.length + 1} signals · key ${item.problemKey ?? decisionProblemKey(item)}`,
    });
  }

  return steps;
}
