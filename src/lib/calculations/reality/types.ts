/**
 * Reality Validation — reconcile StorePilot KPIs against live platform sources.
 * Golden/integrity suites prove formulas; this proves business accuracy.
 */

import type { DiscrepancyCategory, ExternalSource } from "../integrity/external-crosscheck";

export type ValidationStatus =
  | "verified"
  | "within_tolerance"
  | "needs_investigation"
  | "missing_source"
  | "cannot_validate";

/** Human-facing labels for UI */
export const VALIDATION_STATUS_LABEL: Record<ValidationStatus, string> = {
  verified: "Verified",
  within_tolerance: "Within Tolerance",
  needs_investigation: "Needs Investigation",
  missing_source: "Missing Source",
  cannot_validate: "Cannot Validate",
};

export type RealitySourceObservation = {
  kpiId: string;
  source: ExternalSource;
  value: number | null;
  /** ISO timestamp when the platform value was observed / exported */
  observedAt: string | null;
  /** Platform-native field path / report name */
  sourceField?: string;
  /** Hint for expected discrepancy classification */
  knownCause?: DiscrepancyCategory;
  explanation?: string;
  /** Relative tolerance override (default from reconcile policy) */
  relTolerance?: number;
};

export type StorePilotKpiSnapshot = {
  kpiId: string;
  label: string;
  value: number | null;
  /** When StorePilot last computed / synced this KPI */
  lastSyncedAt?: string | null;
  /** Critical for executive / profit recommendations */
  critical?: boolean;
  /** Drives profit estimates (COGS, fees, etc.) */
  profitSensitive?: boolean;
};

export type RealityKpiResult = {
  kpiId: string;
  label: string;
  storepilotValue: number | null;
  sourceValue: number | null;
  source: ExternalSource | null;
  differenceAbs: number | null;
  /** 0.0011 = 0.11% */
  differencePct: number | null;
  status: ValidationStatus;
  reason?: string;
  discrepancyCategory?: DiscrepancyCategory;
  lastSyncedAt?: string | null;
  sourceObservedAt?: string | null;
  /** Fresh + (verified | within_tolerance) */
  trusted: boolean;
  critical: boolean;
  profitSensitive: boolean;
};

export type FinancialTrustScore = {
  /** 0–100 */
  scorePct: number;
  verifiedCount: number;
  withinToleranceCount: number;
  totalEligible: number;
  unverified: Array<{ kpiId: string; label: string; status: ValidationStatus; reason: string }>;
  /** True when COGS/fees missing → net profit estimates are provisional */
  provisionalProfitEstimates: boolean;
  summary: string;
};

export type RecommendationGateResult = {
  /** Allow Executive ACTION_REQUIRED with full confidence framing */
  allowHighConfidenceRecommendations: boolean;
  /** Multiplier applied to model confidence (0–1) */
  confidenceMultiplier: number;
  /** Adjusted max confidence ceiling 0–100 */
  confidenceCeilingPct: number;
  blockers: string[];
  warnings: string[];
  provisionalMetrics: string[];
};

export type RealityValidationReport = {
  merchantId?: string;
  generatedAt: string;
  window: string;
  results: RealityKpiResult[];
  trustScore: FinancialTrustScore;
  gate: RecommendationGateResult;
  /** Counts by status for dashboards */
  statusCounts: Record<ValidationStatus, number>;
};
