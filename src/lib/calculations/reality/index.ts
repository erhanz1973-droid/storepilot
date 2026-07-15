export type {
  ValidationStatus,
  RealitySourceObservation,
  StorePilotKpiSnapshot,
  RealityKpiResult,
  FinancialTrustScore,
  RecommendationGateResult,
  RealityValidationReport,
} from "./types";
export { VALIDATION_STATUS_LABEL } from "./types";

export {
  DEFAULT_MAX_FRESHNESS_HOURS,
  DEFAULT_REALITY_TOLERANCE,
  isFresh,
  statusIsTrusted,
} from "./freshness";

export {
  buildRealityValidationReport,
  type ReconcileRealityOpts,
} from "./reconcile";

export { buildFinancialTrustScore } from "./trust-score";

export {
  buildRecommendationGate,
  applyRecommendationGateToConfidence,
} from "./recommendation-gate";

export {
  storePilotKpisFromBusinessKpis,
  realityObservationsFromIntegrityFixture,
} from "./from-kpis";
