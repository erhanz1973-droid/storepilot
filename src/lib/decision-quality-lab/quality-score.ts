import type { EnrichedDecisionItem } from "@/lib/decisions/engine/types";
import { computeDecisionQualityScore } from "@/lib/decisions/qa/quality-score";
import { extractValidationScore } from "@/lib/decisions/qa/types";
import type { BusinessModel } from "@/lib/business-model/types";
import { mapDecisionToIntents } from "./intent-mapper";
import type { DecisionIntent } from "./intents";

export type DecisionQualityBreakdown = {
  overallPct: number;
  validationQualityPct: number;
  explainabilityPct: number;
  businessLogicPct: number;
  strategyComparisonPct: number;
  evidenceCompletenessPct: number;
  intentMatchPct: number;
  businessModelCompliancePct: number;
  confidencePct: number;
};

function evidenceScore(item: EnrichedDecisionItem): number {
  const evidenceCount =
    item.supportingMetrics.length +
    (item.validation?.evidence?.length ?? 0) +
    (item.validation?.calculationBasis?.length ?? 0);
  if (evidenceCount >= 5) return 100;
  if (evidenceCount >= 3) return 80;
  if (evidenceCount >= 1) return 55;
  return 0;
}

function strategyScore(item: EnrichedDecisionItem): number {
  if (item.strategyComparison) return 100;
  if (item.explainability?.hasStrategyComparison) return 100;
  return 25;
}

function businessLogicScore(item: EnrichedDecisionItem): number {
  let score = 50;
  if (item.why && item.why.length > 40) score += 20;
  if (item.recommendedAction && item.recommendedAction.length > 10) score += 15;
  if (item.supportingMetrics.length >= 2) score += 15;
  return Math.min(100, score);
}

function businessModelComplianceScore(
  item: EnrichedDecisionItem,
  businessModel?: BusinessModel,
): number {
  if (!businessModel) return 100;
  const intents = mapDecisionToIntents(item);
  if (businessModel === "dropshipping") {
    const forbidden: DecisionIntent[] = ["inventory_clearance", "inventory_replenishment"];
    if (intents.some((i) => forbidden.includes(i))) return 0;
  }
  if (businessModel === "digital_products") {
    if (intents.includes("inventory_replenishment")) return 20;
  }
  return 100;
}

export function computeExtendedDecisionQuality(input: {
  item: EnrichedDecisionItem;
  businessModel?: BusinessModel;
  expectedIntents?: DecisionIntent[];
  intentMatchPct?: number;
}): DecisionQualityBreakdown {
  const { item } = input;
  const validationQualityPct = Math.min(100, extractValidationScore(item) ?? 0);
  const explainabilityPct = item.explainability?.scorePct ?? 0;
  const businessLogicPct = businessLogicScore(item);
  const strategyComparisonPct = strategyScore(item);
  const evidenceCompletenessPct = evidenceScore(item);
  const confidencePct = item.confidencePct ?? 0;
  const businessModelCompliancePct = businessModelComplianceScore(item, input.businessModel);

  let intentMatchPct = input.intentMatchPct ?? 100;
  if (input.expectedIntents?.length) {
    const actual = mapDecisionToIntents(item);
    const hits = input.expectedIntents.filter((e) => actual.includes(e));
    intentMatchPct =
      input.expectedIntents.length > 0
        ? Math.round((hits.length / input.expectedIntents.length) * 100)
        : 100;
  }

  const overallPct = Math.round(
    validationQualityPct * 0.15 +
      explainabilityPct * 0.2 +
      businessLogicPct * 0.15 +
      strategyComparisonPct * 0.1 +
      evidenceCompletenessPct * 0.15 +
      intentMatchPct * 0.1 +
      businessModelCompliancePct * 0.1 +
      Math.min(100, confidencePct) * 0.05,
  );

  const base = computeDecisionQualityScore(item);
  const blended = Math.round(overallPct * 0.65 + base * 0.35);

  return {
    overallPct: Math.min(100, Math.max(0, blended)),
    validationQualityPct,
    explainabilityPct,
    businessLogicPct,
    strategyComparisonPct,
    evidenceCompletenessPct,
    intentMatchPct,
    businessModelCompliancePct,
    confidencePct,
  };
}
