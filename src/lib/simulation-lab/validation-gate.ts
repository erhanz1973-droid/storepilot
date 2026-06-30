import type { ValidationGateReport } from "@/lib/recommendations/validation/types";

/** Trusted validation gate for simulation — all providers connected at 100% match. */
export function buildSimulationValidationGate(storeId: string): ValidationGateReport {
  const now = new Date().toISOString();
  const provider = (
    providerId: "meta" | "google" | "shopify" | "ga4",
    connectorId: "meta_ads" | "google_ads" | "shopify" | "ga4",
    label: string,
  ) => ({
    providerId,
    connectorId,
    label,
    connected: true,
    matchScore: 100,
    trustLevel: "trusted" as const,
    lastSyncAt: now,
    cacheCreatedAt: now,
    cacheAgeMinutes: 0,
    dataAgeMinutes: 0,
    freshness: "fresh" as const,
    readiness: "production_ready" as const,
  });

  const providers = [
    provider("shopify", "shopify", "Shopify"),
    provider("meta", "meta_ads", "Meta Ads"),
    provider("google", "google_ads", "Google Ads"),
    provider("ga4", "ga4", "GA4"),
  ];

  return {
    storeId,
    evaluatedAt: now,
    providers,
    overallMatchPercent: 100,
    canGenerateRecommendations: true,
    trustedProviderIds: ["meta", "google", "shopify", "ga4"],
    blockedProviderIds: [],
    warnedProviderIds: [],
  };
}
