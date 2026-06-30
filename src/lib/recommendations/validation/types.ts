import type { DataSourceId } from "@/lib/types";
import type { ValidationProviderId } from "@/lib/validation/framework/types";

/** Connector IDs participating in validation (includes GA4 analytics). */
export type ValidationConnectorId = DataSourceId | "ga4";

/** Maps connector / data source IDs to validation framework providers. */
export const CONNECTOR_TO_VALIDATION_PROVIDER: Partial<
  Record<ValidationConnectorId, ValidationProviderId>
> = {
  meta_ads: "meta",
  google_ads: "google",
  shopify: "shopify",
  ga4: "ga4",
};

export type ProviderTrustLevel = "trusted" | "warn" | "blocked" | "disconnected";

export type ProviderValidationState = {
  providerId: ValidationProviderId;
  connectorId: ValidationConnectorId;
  label: string;
  connected: boolean;
  matchScore: number | null;
  trustLevel: ProviderTrustLevel;
  lastSyncAt: string | null;
  cacheCreatedAt: string | null;
  cacheAgeMinutes: number | null;
  dataAgeMinutes: number | null;
  freshness: "fresh" | "stale" | "unknown";
  readiness: "production_ready" | "development" | "not_validated" | "not_connected";
};

export type ValidationEvidenceItem = {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
};

export type RecommendationCalculationBasis = {
  label: string;
  value: string;
  trend?: "up" | "down" | "flat";
};

export type RecommendationValidationMeta = {
  aiConfidence: number;
  validationConfidence: number;
  finalConfidence: number;
  validationScore: number | null;
  providersUsed: string[];
  providersBlocked: string[];
  providersWarned: string[];
  evidence: ValidationEvidenceItem[];
  calculationBasis: RecommendationCalculationBasis[];
  dateRangeVerified: boolean;
  blocked: boolean;
  blockReason?: string;
};

export type ValidationGateReport = {
  storeId: string;
  evaluatedAt: string;
  providers: ProviderValidationState[];
  overallMatchPercent: number | null;
  canGenerateRecommendations: boolean;
  globalBlockReason?: string;
  trustedProviderIds: ValidationProviderId[];
  blockedProviderIds: ValidationProviderId[];
  warnedProviderIds: ValidationProviderId[];
};

export type RecommendationAuditRecord = {
  id: string;
  storeId: string;
  timestamp: string;
  recommendationDedupeKey: string;
  recommendationId?: string;
  title: string;
  category: string;
  aiConfidence: number;
  validationConfidence: number;
  finalConfidence: number;
  validationScore: number | null;
  providersUsed: string[];
  providersBlocked: string[];
  evidence: ValidationEvidenceItem[];
  calculationBasis: RecommendationCalculationBasis[];
  outcomeStatus: "pending" | "approved" | "rejected" | "measured" | "no_outcome";
  outcomeSummary?: string;
  durationMs: number;
};

export type RecommendationOutcomePreview = {
  status: RecommendationAuditRecord["outcomeStatus"];
  label: string;
  detail?: string;
  revenueDeltaPct?: number;
  roasDeltaPct?: number;
};
