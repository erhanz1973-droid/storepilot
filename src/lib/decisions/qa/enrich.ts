import { decisionProblemKey } from "@/lib/decisions/engine/merge";
import type { EnrichedDecisionItem } from "@/lib/decisions/engine/types";
import { computeExtendedDecisionQuality } from "@/lib/decision-quality-lab/quality-score";
import { buildDecisionSelfAssessment } from "@/lib/decision-quality-lab/self-assessment";
import { mapDecisionToIntents } from "@/lib/decision-quality-lab/intent-mapper";
import { validateDecisionCompleteness } from "./completeness";
import { computeDecisionQualityScore } from "./quality-score";
import { buildDecisionTrace } from "./trace";
import type { DecisionQaRecord } from "./types";
import {
  extractAlternativeStrategies,
  extractProviderSources,
  extractValidationScore,
} from "./types";

export function enrichDecisionWithQa(
  item: EnrichedDecisionItem,
): DecisionQaRecord {
  const problemKey = item.problemKey ?? decisionProblemKey(item);
  const { status, checks } = validateDecisionCompleteness(item);
  const qualityBreakdown = computeExtendedDecisionQuality({
    item,
    businessModel: item.businessModel,
  });
  const qualityScorePct = qualityBreakdown.overallPct || computeDecisionQualityScore(item);
  const detectedIntents = mapDecisionToIntents(item);
  const selfAssessment = buildDecisionSelfAssessment({
    item,
    businessModel: item.businessModel,
  });

  return {
    ...item,
    problemKey,
    completenessStatus: status,
    completenessChecks: checks,
    qualityScorePct,
    validationScorePct: extractValidationScore(item),
    providerSources: extractProviderSources(item),
    trace: buildDecisionTrace(item),
    alternativeStrategies: extractAlternativeStrategies(item),
    qualityBreakdown,
    selfAssessment,
    detectedIntents,
  };
}

export function enrichDecisionsWithQa(
  decisions: EnrichedDecisionItem[],
): DecisionQaRecord[] {
  return decisions.map(enrichDecisionWithQa);
}
