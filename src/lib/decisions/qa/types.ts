import type { DecisionItem } from "@/lib/decisions/center";
import type { EnrichedDecisionItem } from "@/lib/decisions/engine/types";
import type { DecisionQualityBreakdown } from "@/lib/decision-quality-lab/quality-score";
import type { DecisionSelfAssessment } from "@/lib/decision-quality-lab/self-assessment";
import type { DecisionIntent } from "@/lib/decision-quality-lab/intents";

export type DecisionCompletenessStatus = "complete" | "incomplete";

export type DecisionCompletenessCheck = {
  field: string;
  label: string;
  passed: boolean;
  detail?: string;
};

export type DecisionQaRecord = EnrichedDecisionItem & {
  problemKey: string;
  completenessStatus: DecisionCompletenessStatus;
  completenessChecks: DecisionCompletenessCheck[];
  qualityScorePct: number;
  validationScorePct: number | null;
  providerSources: string[];
  trace: DecisionTraceStep[];
  alternativeStrategies: string[];
  /** Phase 5 — extended quality dimensions */
  qualityBreakdown?: DecisionQualityBreakdown;
  selfAssessment?: DecisionSelfAssessment;
  detectedIntents?: DecisionIntent[];
};

export type DecisionTraceStep = {
  stage: string;
  label: string;
  detail?: string;
  durationMs?: number;
};

export type ConsistencyCheckResult = {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
};

export type DecisionEnginePerformance = {
  totalMs: number;
  decisionCenterMs: number;
  mergeMs: number;
  enrichmentMs: number;
  qaMs: number;
  validationMs?: number;
  strategySimulationMs?: number;
  targetMs: number;
  withinTarget: boolean;
};

export type ProductionCheckResult = {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
};

export type BetaReadinessLevel = "ready" | "needs_testing" | "incomplete";

export type BetaReadinessItem = {
  component: string;
  status: BetaReadinessLevel;
  notes: string;
};

export type DecisionEngineQaReport = {
  generatedAt: string;
  storeId: string;
  merchantMode: string;
  decisions: DecisionQaRecord[];
  merchantReady: DecisionQaRecord[];
  incomplete: DecisionQaRecord[];
  consistency: ConsistencyCheckResult[];
  consistencyPassed: boolean;
  production: ProductionCheckResult[];
  productionPassed: boolean;
  performance: DecisionEnginePerformance;
  betaReadiness: BetaReadinessItem[];
  scenarioResults?: ScenarioRunResult[];
};

export type ScenarioRunResult = {
  scenarioId: string;
  label: string;
  passed: boolean;
  expected: string;
  actual: string;
  detail?: string;
};

export type ScenarioDefinition = {
  id: string;
  label: string;
  description: string;
  /** Expected winning strategy ID from strategy simulation */
  expectedStrategyId: string;
  merchantMode?: import("@/lib/decisions/merchant-mode").MerchantMode;
  product: import("@/lib/decisions/product-economics").ProductEconomicsInput;
};

export const MERCHANT_QUALITY_THRESHOLD = 65;

export function extractProviderSources(item: DecisionItem): string[] {
  const fromValidation = item.validation?.providersUsed ?? [];
  const fromGate =
    item.validationGate?.trustedProviderIds?.map(String) ?? [];
  const connected =
    item.providerFreshness
      ?.filter((p) => p.connected)
      .map((p) => p.providerId) ?? [];
  const combined = [...new Set([...fromValidation, ...fromGate, ...connected])];
  return combined;
}

export function extractValidationScore(item: DecisionItem): number | null {
  if (item.validation?.validationScore != null) {
    return item.validation.validationScore;
  }
  if (item.validationGate?.overallMatchPercent != null) {
    return item.validationGate.overallMatchPercent;
  }
  if (item.validationGate?.canGenerateRecommendations) {
    return 85;
  }
  return null;
}

export function extractAlternativeStrategies(
  item: EnrichedDecisionItem,
): string[] {
  if (!item.strategyComparison) return [];
  return item.strategyComparison.strategies
    .filter((s) => s.strategyId !== item.strategyComparison!.recommended.strategyId)
    .slice(0, 6)
    .map((s) => s.label);
}
