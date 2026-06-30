import type { EnrichedDecisionItem } from "@/lib/decisions/engine/types";
import type { BusinessModel } from "@/lib/business-model/types";
import { mapDecisionToIntents } from "./intent-mapper";
import { DROPSHIPPING_FORBIDDEN_INTENTS } from "./intents";

export type DecisionSelfAssessment = {
  sufficientEvidence: boolean;
  validationComplete: boolean;
  alternativesEvaluated: boolean;
  confidenceJustified: boolean;
  explainabilityComplete: boolean;
  businessModelRespected: boolean;
  scorePct: number;
  narrative: string;
};

export function buildDecisionSelfAssessment(input: {
  item: EnrichedDecisionItem;
  businessModel?: BusinessModel;
}): DecisionSelfAssessment {
  const { item, businessModel } = input;
  const evidenceCount =
    item.supportingMetrics.length +
    (item.validation?.evidence?.length ?? 0) +
    (item.validation?.calculationBasis?.length ?? 0);

  const sufficientEvidence = evidenceCount >= 3;
  const validationComplete =
    (item.validation?.validationScore ?? 0) >= 70 ||
    item.validationGate?.canGenerateRecommendations === true;
  const alternativesEvaluated =
    Boolean(item.strategyComparison) ||
    (item.explainability?.hasStrategyComparison ?? false);
  const confidenceJustified =
    (item.confidencePct ?? 0) >= 55 &&
    (item.explainability?.confidencePct ?? item.confidencePct ?? 0) >= 50;
  const explainabilityComplete =
    (item.explainability?.scorePct ?? 0) >= 60 &&
    item.explainability?.evidenceStatus !== "minimal";

  const intents = mapDecisionToIntents(item);
  let businessModelRespected = true;
  if (businessModel === "dropshipping") {
    businessModelRespected = !intents.some((i) =>
      DROPSHIPPING_FORBIDDEN_INTENTS.includes(i),
    );
  }

  const checks = [
    sufficientEvidence,
    validationComplete,
    alternativesEvaluated,
    confidenceJustified,
    explainabilityComplete,
    businessModelRespected,
  ];
  const scorePct = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  const gaps: string[] = [];
  if (!sufficientEvidence) gaps.push("more evidence needed");
  if (!validationComplete) gaps.push("validation incomplete");
  if (!alternativesEvaluated) gaps.push("alternatives not compared");
  if (!confidenceJustified) gaps.push("confidence may be overstated");
  if (!explainabilityComplete) gaps.push("explainability incomplete");
  if (!businessModelRespected) gaps.push("business model constraints violated");

  const narrative =
    gaps.length === 0
      ? "Self-assessment: decision meets quality standards across evidence, validation, and business model fit."
      : `Self-assessment gaps: ${gaps.join("; ")}.`;

  return {
    sufficientEvidence,
    validationComplete,
    alternativesEvaluated,
    confidenceJustified,
    explainabilityComplete,
    businessModelRespected,
    scorePct,
    narrative,
  };
}
