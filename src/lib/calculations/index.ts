/**
 * StorePilot Financial Calculation Framework
 *
 * Layer 1: facts/            — immutable imported data
 * Layer 2: kpis/             — calculateBusinessKPIs(facts)
 * Layer 2.5: business-model/ — BusinessModelConfig (weights + which formulas apply)
 * Layer 3: decisions/        — non-financial Decision objects
 * Layer 4: impact/           — calculateDecisionImpact(decision, kpis, businessModel)
 * Layer 5: audit/            — CalculationAudit + explainability + cross-screen locks
 * formulas/                  — pure formula library (unit-tested)
 * version.ts                 — FORMULA_ENGINE_VERSION
 */

export { FORMULA_ENGINE_VERSION, isFormulaVersionCompatible } from "./version";

export * from "./audit";
export {
  GOLDEN_EXPECTED,
  GOLDEN_CAMPAIGN_LABEL,
  goldenRawFacts,
  goldenDecision,
} from "./golden/campaign-recovery-30d";

export * from "./integrity";
export * from "./reality";

export type { RawFacts, RawCommerceFacts, RawAdvertisingFacts, RawCampaignFact } from "./facts/types";
export { emptyRawFacts, emptyCommerceFacts, emptyAdvertisingFacts } from "./facts/types";

export * from "./formulas";

export type { BusinessKPIs } from "./kpis/engine";
export {
  calculateBusinessKPIs,
  rawFactsFromProfitDashboard,
  rawFactsFromSnapshot,
} from "./kpis/engine";

export type {
  BusinessModelConfig,
  ConfidenceWeights,
  KpiId,
  OptimizationPriority,
  RecoveryComposition,
  RecoveryComponents,
  RecoveryStrategy,
} from "./business-model/config";
export {
  BUSINESS_MODEL_CONFIGS,
  resolveBusinessModelConfig,
  composeBusinessRecovery,
  formulaConfidenceForModel,
  selectPrimaryKpis,
  isInventoryRelevant,
  resolveImpactMarginPct,
  useEfficiencyGainForAds,
} from "./business-model/config";

export type {
  Decision,
  DecisionFinancialInputs,
  DecisionPriority,
  DecisionRisk,
  DecisionGoal,
  AffectedEntity,
} from "./decisions/types";

export type {
  DecisionImpact,
  DecisionImpactPresentation,
  DecisionImpactWaterfallStep,
  ImpactEngineOptions,
} from "./impact/engine";
export {
  DECISION_IMPACT_COPY,
  calculateDecisionImpact,
  calculateDecisionImpactFromInputs,
  mergeDecisionImpacts,
  buildDecisionImpactPresentation,
  formatDecisionMonthlyImpact,
  decisionImpactWaterfall,
  extractExplicitProfitAmount,
  detectAdvertisingSavingsRange,
  recommendationCategoryToOpportunity,
} from "./impact/engine";
