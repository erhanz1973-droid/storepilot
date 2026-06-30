import { cache } from "react";
import { buildAdSpendSnapshot } from "@/lib/ads/spend";
import type { StoreSnapshot } from "@/lib/connectors/types";
import { getCachedSnapshot } from "@/lib/services/store-bundle";
import { buildValidationGateReport, isConnectorBlocked } from "./gate";
import type { ValidationGateReport } from "./types";

export type VerifiedStoreData = {
  snapshot: StoreSnapshot;
  gate: ValidationGateReport;
};

function stripBlockedProviderData(
  snapshot: StoreSnapshot,
  gate: ValidationGateReport,
): StoreSnapshot {
  let campaigns = snapshot.campaigns;
  let metaAccountRollups = snapshot.metaAccountRollups;
  let metaDailySpend = snapshot.metaDailySpend;
  let googleAdsSnapshot = snapshot.googleAdsSnapshot;
  let googleDailySpend = snapshot.googleDailySpend;
  let products = snapshot.products;
  let collections = snapshot.collections;
  let storeMetrics = snapshot.storeMetrics;

  if (isConnectorBlocked("meta_ads", gate)) {
    campaigns = [];
    metaAccountRollups = undefined;
    metaDailySpend = [];
  }

  if (isConnectorBlocked("google_ads", gate)) {
    googleAdsSnapshot = undefined;
    googleDailySpend = [];
  }

  if (isConnectorBlocked("shopify", gate)) {
    products = [];
    collections = [];
    storeMetrics = {
      revenue30d: 0,
      orders30d: 0,
      aov30d: 0,
      conversionRate30d: 0,
    };
  }

  const adSpendSnapshot = buildAdSpendSnapshot({
    metaCampaigns: campaigns,
    metaAccountRollups,
    googleRollups: googleAdsSnapshot?.rollups,
  });

  return {
    ...snapshot,
    campaigns,
    metaAccountRollups,
    metaDailySpend,
    googleAdsSnapshot,
    googleDailySpend,
    products,
    collections,
    storeMetrics,
    adSpendSnapshot,
  };
}

/**
 * Verified snapshot pipeline — Recommendation Engine must use this instead of raw aggregateStoreSnapshot.
 * Blocked providers are stripped; only validated (trusted/warn) data flows to analyzers.
 */
export async function getVerifiedStoreData(storeId: string): Promise<VerifiedStoreData> {
  const snapshot = await getCachedSnapshot(storeId);
  const gate = await buildValidationGateReport(storeId, snapshot.connectorStates ?? {});
  const verifiedSnapshot = stripBlockedProviderData(snapshot, gate);
  return { snapshot: verifiedSnapshot, gate };
}

/** Request-scoped verified snapshot — reuses cached connector aggregation. */
export const getCachedVerifiedStoreData = cache(getVerifiedStoreData);
