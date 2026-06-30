import type { DecisionItem } from "@/lib/decisions/center";
import type { StrategyComparisonResult } from "@/lib/decisions/strategy-comparison";
import type { DecisionExplainability } from "./types";

export function computeDecisionExplainability(input: {
  item: DecisionItem;
  strategyComparison?: StrategyComparisonResult;
}): DecisionExplainability {
  const { item, strategyComparison } = input;
  const validation = item.validation;

  const validationPct = validation?.validationScore ?? item.validationGate?.overallMatchPercent ?? null;
  const validationComponent =
    validationPct !== null ? Math.min(100, validationPct) : validation ? 70 : 40;

  const evidenceCount =
    (validation?.evidence?.length ?? 0) +
    item.supportingMetrics.length +
    (validation?.calculationBasis?.length ?? 0);

  let evidenceStatus: DecisionExplainability["evidenceStatus"] = "minimal";
  if (evidenceCount >= 5) evidenceStatus = "complete";
  else if (evidenceCount >= 2) evidenceStatus = "partial";

  const evidenceComponent =
    evidenceStatus === "complete" ? 100 : evidenceStatus === "partial" ? 72 : 35;

  const confidencePct = item.confidencePct;
  const confidenceComponent = confidencePct;

  const strategyComponent = strategyComparison ? 95 : item.why.length > 80 ? 60 : 30;

  const scorePct = Math.round(
    validationComponent * 0.35 +
      evidenceComponent * 0.3 +
      confidenceComponent * 0.2 +
      strategyComponent * 0.15,
  );

  return {
    scorePct: Math.min(100, Math.max(0, scorePct)),
    validationPct: validationComponent,
    confidencePct,
    evidenceStatus,
    hasStrategyComparison: Boolean(strategyComparison),
  };
}
