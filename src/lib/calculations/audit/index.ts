export type {
  CalculationAudit,
  CalculationStep,
  CrossScreenSurfaces,
  CrossScreenValidationResult,
  ExplainedValue,
  PipelineStageId,
  PipelineStageSnapshot,
} from "./types";

export { explainedValue, currencyStep } from "./explained";
export {
  explainGrossProfit,
  explainNetProfit,
  explainAdvertisingSavings,
  explainBusinessRecovery,
  explainNetProfitImpact,
} from "./explained-formulas";

export { buildCalculationAudit, decisionImpactFingerprint } from "./builder";

export {
  validateCrossScreenImpact,
  assertExecutiveMatchesImpact,
  assertApprovalMatchesImpact,
} from "./cross-screen";

export {
  isVerificationMode,
  setVerificationMode,
  verificationLog,
  getVerificationLog,
  clearVerificationLog,
} from "./verification";
export type { VerificationLogEntry } from "./verification";

export { explainedFromImpactPresentation } from "./from-presentation";
