import type { StoreSnapshot } from "@/lib/connectors/types";
import type { IntegrationSnapshot } from "./types";
import { buildDemoIntegrationSnapshot } from "./demo-data";
import { shouldUseDemoIntegrations } from "./confidence";
import { isIntegrationConfigured } from "./credentials";
import { PHASE6_INTEGRATIONS } from "./types";
import { isGoogleAdsAvailable } from "@/lib/google-ads/oauth";

/** Assemble integration snapshot from env credentials or demo store */
export function buildIntegrationSnapshot(
  snapshot: StoreSnapshot,
): IntegrationSnapshot | undefined {
  if (shouldUseDemoIntegrations(snapshot)) {
    const demo = buildDemoIntegrationSnapshot(snapshot.storeMetrics, {
      includeGoogleAds: !snapshot.googleAdsSnapshot,
    });
    return demo;
  }

  let connectedCount = 0;
  const partial: IntegrationSnapshot = {
    connectedCount: 0,
    estimatedCount: PHASE6_INTEGRATIONS.length,
    liveDataPct: 0,
  };

  for (const def of PHASE6_INTEGRATIONS) {
    if (isIntegrationConfigured(def)) {
      connectedCount += 1;
    }
  }

  if (connectedCount === 0) return undefined;

  partial.connectedCount = connectedCount;
  partial.estimatedCount = PHASE6_INTEGRATIONS.length - connectedCount;
  partial.liveDataPct = Math.round((connectedCount / PHASE6_INTEGRATIONS.length) * 100);

  return partial;
}

export function mergeIntegrationIntoSnapshot(
  snapshot: StoreSnapshot,
): StoreSnapshot {
  const integration = buildIntegrationSnapshot(snapshot);
  if (!integration) return snapshot;

  const googleDaily = integration.googleAds?.dailySpend ?? [];
  const tiktokDaily = integration.tiktokAds?.dailySpend ?? [];
  const liveGoogleConfigured = isGoogleAdsAvailable();

  return {
    ...snapshot,
    integrationSnapshot: integration,
    googleAdsSnapshot:
      snapshot.googleAdsSnapshot ?? (liveGoogleConfigured ? undefined : integration.googleAds),
    tiktokAdsSnapshot: integration.tiktokAds,
    klaviyoSnapshot: integration.klaviyo,
    ga4Snapshot: snapshot.ga4Snapshot ?? integration.ga4,
    metaCapiStatus: integration.metaCapi,
    operationalCosts: integration.operationalCosts,
    connectorStates: {
      ...snapshot.connectorStates,
      google_ads: snapshot.googleAdsSnapshot
        ? "connected"
        : liveGoogleConfigured
          ? snapshot.connectorStates?.google_ads ?? "disconnected"
          : integration.googleAds
            ? "connected"
            : snapshot.connectorStates?.google_ads,
      tiktok: integration.tiktokAds ? "connected" : snapshot.connectorStates?.tiktok,
      klaviyo: integration.klaviyo ? "connected" : snapshot.connectorStates?.klaviyo,
      ga4: snapshot.ga4Snapshot ? "connected" : snapshot.connectorStates?.ga4,
    },
    metaDailySpend: [
      ...(snapshot.metaDailySpend ?? []),
      ...googleDaily,
      ...tiktokDaily,
    ],
  };
}
