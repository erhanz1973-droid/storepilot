import type {
  AnalyzerOutput,
  Recommendation,
  RecommendationCategory,
  RecommendationSeverity,
  SupportingMetric,
} from "@/lib/types";
import type { RecommendationValidationMeta } from "@/lib/recommendations/validation/types";

/** Phase 2.1 domain status values */
export type RecommendationDomainStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "dismissed"
  | "expired";

export type RecommendationEventType =
  | "RecommendationCreated"
  | "RecommendationViewed"
  | "RecommendationApproved"
  | "RecommendationRejected"
  | "RecommendationDismissed";

export type RecommendationEvidence = {
  supportingMetrics: SupportingMetric[];
  validation?: RecommendationValidationMeta;
  providerSources: string[];
};

export type RecommendationRecord = {
  id: string;
  storeId: string;
  recommendationType: RecommendationCategory | string;
  priority: RecommendationSeverity;
  status: RecommendationDomainStatus;
  confidence: number;
  validationScore: number | null;
  title: string;
  description: string;
  reason: string;
  expectedImpact: string;
  estimatedRevenueGain: number | null;
  estimatedCostSaving: number | null;
  evidence: RecommendationEvidence;
  dedupeKey: string;
  entityType?: string;
  entityId?: string;
  createdAt: string;
  updatedAt: string;
};

export type RecommendationEvent = {
  id: string;
  recommendationId: string;
  eventType: RecommendationEventType;
  payloadJson: Record<string, unknown>;
  createdAt: string;
  userId?: string;
};

export type CreateRecommendationInput = {
  storeId: string;
  dedupeKey: string;
  recommendationType: RecommendationCategory | string;
  priority: RecommendationSeverity;
  title: string;
  description: string;
  reason: string;
  expectedImpact: string;
  confidence: number;
  validationScore?: number | null;
  estimatedRevenueGain?: number | null;
  estimatedCostSaving?: number | null;
  evidence: RecommendationEvidence;
  entityType?: string;
  entityId?: string;
  status?: RecommendationDomainStatus;
};

export type SyncAnalyzerContext = {
  outputs: AnalyzerOutput[];
  storeId: string;
};

/** Maps persisted DB status strings to domain status */
export function dbStatusToDomain(status: string): RecommendationDomainStatus {
  switch (status) {
    case "approved":
    case "implemented":
      return "approved";
    case "ignored":
    case "rejected":
      return "rejected";
    case "snoozed":
    case "dismissed":
      return "dismissed";
    case "completed":
    case "measured":
    case "expired":
      return "expired";
    case "pending":
    default:
      return "pending";
  }
}

/** Maps domain status to DB enum value */
export function domainStatusToDb(status: RecommendationDomainStatus): string {
  return status;
}

/** Maps domain status to values accepted by `20260616120000_initial_schema.sql`. */
export function domainStatusToLegacyDb(status: RecommendationDomainStatus | string): string {
  switch (status) {
    case "rejected":
      return "ignored";
    case "dismissed":
      return "snoozed";
    case "expired":
    case "measured":
    case "implemented":
      return "completed";
    case "approved":
    case "pending":
    case "ignored":
    case "snoozed":
    case "completed":
      return status;
    default:
      return "pending";
  }
}

export function recordToLegacyRecommendation(
  record: RecommendationRecord,
): Recommendation {
  return {
    id: record.id,
    category: record.recommendationType as RecommendationCategory,
    title: record.title,
    severity: record.priority,
    reason: record.reason,
    expectedImpact: record.expectedImpact,
    confidenceScore: record.confidence,
    actionLabel: "Review",
    supportingMetrics: record.evidence.supportingMetrics,
    entityType: record.entityType,
    entityId: record.entityId,
    createdAt: record.createdAt,
    status: domainStatusToLegacyApprovalStatus(record.status),
  };
}

/** Legacy dashboard / approvals compatibility */
export function domainStatusToLegacyApprovalStatus(
  status: RecommendationDomainStatus,
): Recommendation["status"] {
  switch (status) {
    case "approved":
      return "approved";
    case "rejected":
      return "ignored";
    case "dismissed":
      return "snoozed";
    case "expired":
      return "completed";
    case "pending":
    default:
      return "pending";
  }
}

export function buildEvidenceFromOutput(output: AnalyzerOutput): RecommendationEvidence {
  return {
    supportingMetrics: output.evidence ?? [],
    validation: output.validation,
    providerSources: output.validation?.providersUsed ?? [],
  };
}

export function outputToCreateInput(
  output: AnalyzerOutput,
  storeId: string,
): CreateRecommendationInput {
  const validation = output.validation;
  return {
    storeId,
    dedupeKey: output.id,
    recommendationType: output.category,
    priority: output.priority,
    title: output.title,
    description: output.description,
    reason: output.description,
    expectedImpact: output.expectedImpact,
    confidence: validation?.finalConfidence ?? output.confidence,
    validationScore: validation?.validationScore ?? null,
    estimatedRevenueGain:
      output.financialImpact?.estimatedMonthlyRevenueIncrease ??
      parseMoneyFromImpact(output.expectedImpact),
    estimatedCostSaving: output.financialImpact?.estimatedMonthlyCostSavings ?? null,
    evidence: buildEvidenceFromOutput(output),
    entityType: output.entityType,
    entityId: output.entityId,
    status: "pending",
  };
}

function parseMoneyFromImpact(impact: string): number | null {
  const match = impact.match(/\$[\d,]+(?:\.\d{2})?/);
  if (!match) return null;
  const numeric = Number(match[0].replace(/[$,]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}
