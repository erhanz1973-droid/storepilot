import { getInstallationForStore } from "@/lib/db/shopify";
import { getSelectedMetaAdsInstallation } from "@/lib/db/meta-ads";
import { getMetaSyncCache, getMetaCacheDebugInfo } from "@/lib/db/meta-sync-cache";
import { getGoogleSyncCache, getGoogleCacheDebugInfo } from "@/lib/db/google-sync-cache";
import { hasActiveMetaAdsInstallations } from "@/lib/db/meta-ads";
import { hasActiveGa4Installation, listGa4Installations, getGa4SyncCache } from "@/lib/db/ga4";
import { isGoogleAdsOAuthConfigured } from "@/lib/google-ads/oauth";
import { ensureValidationProvidersRegistered } from "@/lib/validation/framework/bootstrap";
import { getValidationHistory } from "@/lib/validation/framework/history";
import type { ValidationProviderId } from "@/lib/validation/framework/types";
import type { ConnectorStatus, DataSourceId } from "@/lib/types";
import { isSimulationStoreId } from "@/lib/simulation-lab/store-ids";
import {
  CONNECTOR_TO_VALIDATION_PROVIDER,
  type ProviderValidationState,
  type ValidationConnectorId,
  type ValidationGateReport,
} from "./types";
import {
  cacheFreshness,
  resolveTrustLevel,
} from "./confidence";
import { resolveProviderReadiness } from "./readiness";

const PROVIDER_LABELS: Record<ValidationProviderId, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  shopify: "Shopify",
  ga4: "GA4",
  ai: "AI Engine",
};

function minutesSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
}

async function resolveConnected(
  connectorId: ValidationConnectorId,
  storeId: string,
  connectorStates: Partial<Record<DataSourceId | "ga4", ConnectorStatus>>,
): Promise<boolean> {
  if (isSimulationStoreId(storeId)) {
    if (connectorId === "ga4") return true;
    const status = connectorStates[connectorId as DataSourceId];
    return status === "connected" || status === "demo";
  }
  const status = connectorStates[connectorId];
  if (status === "connected") return true;
  if (connectorId === "meta_ads") return hasActiveMetaAdsInstallations(storeId);
  if (connectorId === "shopify") {
    const install = await getInstallationForStore(storeId);
    return install !== null;
  }
  if (connectorId === "google_ads") return isGoogleAdsOAuthConfigured();
  if (connectorId === "ga4") return hasActiveGa4Installation(storeId);
  return false;
}

async function resolveSyncTimes(
  connectorId: ValidationConnectorId,
  storeId: string,
): Promise<{ lastSyncAt: string | null; cacheCreatedAt: string | null }> {
  if (connectorId === "meta_ads") {
    const install = await getSelectedMetaAdsInstallation(storeId);
    const cache = getMetaCacheDebugInfo(storeId);
    return {
      lastSyncAt: install?.last_sync_at ?? null,
      cacheCreatedAt: cache.createdAt,
    };
  }
  if (connectorId === "google_ads") {
    const cache = getGoogleCacheDebugInfo(storeId);
    return { lastSyncAt: cache.createdAt, cacheCreatedAt: cache.createdAt };
  }
  if (connectorId === "shopify") {
    const install = await getInstallationForStore(storeId);
    return { lastSyncAt: install?.installed_at ?? null, cacheCreatedAt: null };
  }
  if (connectorId === "ga4") {
    const installs = await listGa4Installations(storeId);
    const cache = await getGa4SyncCache(storeId);
    return {
      lastSyncAt: installs[0]?.last_sync_at ?? cache?.syncedAt ?? null,
      cacheCreatedAt: cache?.syncedAt ?? null,
    };
  }
  return { lastSyncAt: null, cacheCreatedAt: null };
}

export async function buildValidationGateReport(
  storeId: string,
  connectorStates: Partial<Record<DataSourceId | "ga4", ConnectorStatus>>,
): Promise<ValidationGateReport> {
  ensureValidationProvidersRegistered();

  const entries = Object.entries(CONNECTOR_TO_VALIDATION_PROVIDER) as [
    ValidationConnectorId,
    ValidationProviderId,
  ][];

  const providers: ProviderValidationState[] = [];

  for (const [connectorId, providerId] of entries) {
    const connected = await resolveConnected(connectorId, storeId, connectorStates);
    const history = getValidationHistory(providerId, storeId);
    const matchScore = history[0]?.matchScore ?? null;
    const trustLevel = resolveTrustLevel(matchScore, connected);
    const { lastSyncAt, cacheCreatedAt } = await resolveSyncTimes(connectorId, storeId);
    const cacheAgeMinutes = minutesSince(cacheCreatedAt);
    const dataAgeMinutes = minutesSince(lastSyncAt ?? cacheCreatedAt);

    providers.push({
      providerId,
      connectorId,
      label: PROVIDER_LABELS[providerId],
      connected,
      matchScore,
      trustLevel,
      lastSyncAt,
      cacheCreatedAt,
      cacheAgeMinutes,
      dataAgeMinutes,
      freshness: cacheFreshness(cacheAgeMinutes ?? dataAgeMinutes),
      readiness: resolveProviderReadiness(providerId, connected, matchScore, trustLevel),
    });
  }

  const trustedProviderIds = providers
    .filter((p) => p.trustLevel === "trusted")
    .map((p) => p.providerId);
  const warnedProviderIds = providers
    .filter((p) => p.trustLevel === "warn")
    .map((p) => p.providerId);
  const blockedProviderIds = providers
    .filter((p) => p.trustLevel === "blocked")
    .map((p) => p.providerId);

  const scored = providers.filter((p) => p.matchScore !== null).map((p) => p.matchScore!);
  const overallMatchPercent =
    scored.length > 0
      ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10
      : null;

  const shopify = providers.find((p) => p.providerId === "shopify");
  const canGenerateRecommendations = !shopify?.connected || shopify.trustLevel !== "blocked";

  let globalBlockReason: string | undefined;
  if (!canGenerateRecommendations) {
    globalBlockReason = `Shopify validation failed (${shopify?.matchScore ?? 0}% match). Run Validation to restore recommendations.`;
  }

  return {
    storeId,
    evaluatedAt: new Date().toISOString(),
    providers,
    overallMatchPercent,
    canGenerateRecommendations,
    globalBlockReason,
    trustedProviderIds,
    blockedProviderIds,
    warnedProviderIds,
  };
}

export function isConnectorTrusted(
  connectorId: DataSourceId,
  gate: ValidationGateReport,
): boolean {
  const providerId = CONNECTOR_TO_VALIDATION_PROVIDER[connectorId];
  if (!providerId) return true;
  const state = gate.providers.find((p) => p.providerId === providerId);
  if (!state?.connected) return false;
  return state.trustLevel === "trusted" || state.trustLevel === "warn";
}

export function isConnectorBlocked(
  connectorId: DataSourceId,
  gate: ValidationGateReport,
): boolean {
  const providerId = CONNECTOR_TO_VALIDATION_PROVIDER[connectorId];
  if (!providerId) return false;
  const state = gate.providers.find((p) => p.providerId === providerId);
  return state?.trustLevel === "blocked";
}
