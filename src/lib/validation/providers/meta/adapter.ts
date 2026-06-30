import { buildAdSpendSnapshot } from "@/lib/ads/spend";
import {
  clearMetaSyncCache,
  getMetaCacheDebugInfo,
  getMetaSyncCache,
} from "@/lib/db/meta-sync-cache";
import {
  getSelectedMetaAdsInstallation,
  getSelectedMetaAdsInstallationWithToken,
} from "@/lib/db/meta-ads";
import { META_GRAPH_VERSION } from "@/lib/meta/oauth";
import { fetchMetaAdSnapshot } from "@/lib/meta/sync";
import { aggregateStoreSnapshot } from "@/lib/connectors/registry";
import { syncMetaAdsForStore } from "@/lib/meta/store-sync";
import { buildValidationGateReport } from "@/lib/recommendations/validation/gate";
import { isDevValidationEnabled } from "@/lib/validation/dev-gate";
import type { ValidationProviderAdapter } from "@/lib/validation/framework/provider";
import {
  compareSnapshots,
  computeMatchScore,
  EMPTY_SNAPSHOT,
  snapshotFromMetrics,
} from "@/lib/validation/framework/compare";
import { buildExportReport } from "@/lib/validation/framework/export";
import {
  getTrendScores,
  getValidationHistory,
  recordValidationHistory,
} from "@/lib/validation/framework/history";
import type {
  ProviderValidationResult,
  RunValidationOptions,
  ValidationApiLogEntry,
  ValidationExportReport,
  ValidationHealthCheck,
  ValidationLogEntry,
  ValidationSnapshot,
} from "@/lib/validation/framework/types";
import { runMetaHealthChecks } from "@/lib/validation/meta/health-checks";
import {
  deriveDashboardMetaMetrics30d,
  fetchMetaAccountInfo,
  fetchMetaAccountInsights30d,
  fetchMetaCampaignCount,
  type MetaAccountInfo,
  type MetaAccountInsights30d,
} from "@/lib/validation/meta/metrics";
import { getMetaApiLogs, getMetaSyncLogs } from "@/lib/validation/meta/registry";

const DATE_RANGE = "Last 30 Days";

function insightsToSnapshot(
  insights: MetaAccountInsights30d,
  campaigns: number,
  currency: string,
): ValidationSnapshot {
  return snapshotFromMetrics({
    spend: insights.spend,
    roas: insights.roas,
    revenue: insights.purchaseValue,
    purchases: insights.purchases,
    campaigns,
    currency,
    dateRange: DATE_RANGE,
  });
}

function dashboardToSnapshot(
  insights: MetaAccountInsights30d,
  campaigns: number,
  currency: string,
): ValidationSnapshot {
  return snapshotFromMetrics({
    spend: insights.spend,
    roas: insights.roas,
    revenue: insights.purchaseValue,
    purchases: insights.purchases,
    campaigns,
    currency,
    dateRange: DATE_RANGE,
  });
}

function mapSyncLogs(): ValidationLogEntry[] {
  return getMetaSyncLogs().map((log) => ({
    id: log.id,
    timestamp: log.timestamp,
    message: log.text,
    level: log.success ? "success" : "error",
  }));
}

function mapApiLogs(): ValidationApiLogEntry[] {
  return getMetaApiLogs().map((log) => ({
    id: log.id,
    timestamp: log.timestamp,
    method: log.method,
    endpoint: log.endpoint,
    context: log.adAccountId,
    dateRange: log.dateRange,
  }));
}

function mapHealthChecks(
  checks: ReturnType<typeof runMetaHealthChecks>,
): ValidationHealthCheck[] {
  return checks.map((c) => ({
    id: c.id,
    label: c.label,
    passed: c.passed,
    detail: c.detail,
  }));
}

async function runMetaValidation(
  storeId: string,
  options?: RunValidationOptions,
): Promise<ProviderValidationResult | { enabled: false }> {
  if (!isDevValidationEnabled()) return { enabled: false };

  const started = Date.now();
  const user = options?.user ?? "system";
  const installation = await getSelectedMetaAdsInstallation(storeId);
  let cached = await getMetaSyncCache(storeId);

  let accountInfo: MetaAccountInfo | null = null;
  let accountInfoError: string | undefined;
  let apiInsights: MetaAccountInsights30d | null = null;
  let insightsError: string | undefined;
  let apiCampaignCount = 0;
  let dashboardCampaignCount = cached?.campaigns?.length ?? 0;
  let tokenValid = false;
  let currency = "USD";

  let dashboardSnapshot: ValidationSnapshot = { ...EMPTY_SNAPSHOT };
  let apiSnapshot: ValidationSnapshot = { ...EMPTY_SNAPSHOT };

  if (options?.runFresh) {
    await clearMetaSyncCache(storeId);
    await syncMetaAdsForStore(storeId);
    cached = await getMetaSyncCache(storeId);
  }

  const withToken = await getSelectedMetaAdsInstallationWithToken(storeId);
  if (withToken) {
    try {
      accountInfo = await fetchMetaAccountInfo(withToken.accessToken, withToken.ad_account_id);
      tokenValid = true;
      currency = accountInfo.currency;
    } catch (err) {
      accountInfoError = err instanceof Error ? err.message : "Token invalid";
      tokenValid = false;
    }

    if (tokenValid) {
      try {
        if (options?.runFresh) {
          const snapshot = await fetchMetaAdSnapshot(
            withToken.accessToken,
            withToken.ad_account_id,
            { adAccountName: withToken.ad_account_name ?? undefined },
          );
          dashboardCampaignCount = snapshot.campaigns.length;
          apiCampaignCount = snapshot.campaigns.length;
          const dashMetrics = deriveDashboardMetaMetrics30d(snapshot);
          apiInsights = await fetchMetaAccountInsights30d(
            withToken.accessToken,
            withToken.ad_account_id,
          );
          dashboardSnapshot = dashboardToSnapshot(dashMetrics, dashboardCampaignCount, currency);
          apiSnapshot = insightsToSnapshot(apiInsights, apiCampaignCount, currency);
          buildAdSpendSnapshot({
            metaCampaigns: snapshot.campaigns,
            metaAccountRollups: snapshot.accountRollups,
          });
        } else {
          apiInsights = await fetchMetaAccountInsights30d(
            withToken.accessToken,
            withToken.ad_account_id,
          );
          apiCampaignCount = await fetchMetaCampaignCount(
            withToken.accessToken,
            withToken.ad_account_id,
          );
          if (cached?.metaAccountRollups) {
            const dashMetrics = deriveDashboardMetaMetrics30d({
              campaigns: cached.campaigns ?? [],
              accountRollups: cached.metaAccountRollups,
              dailySpend: [],
            });
            dashboardSnapshot = dashboardToSnapshot(
              dashMetrics,
              dashboardCampaignCount,
              currency,
            );
          }
          apiSnapshot = insightsToSnapshot(apiInsights, apiCampaignCount, currency);
        }
      } catch (err) {
        insightsError = err instanceof Error ? err.message : "API fetch failed";
      }
    }
  }

  const comparisons = compareSnapshots(dashboardSnapshot, apiSnapshot);
  const matchScore = computeMatchScore(comparisons);

  const healthChecks = mapHealthChecks(
    runMetaHealthChecks({
      installation,
      accountInfo,
      accountInfoError,
      insights: apiInsights,
      insightsError,
      campaignCount: dashboardCampaignCount,
      dashboardGenerated: Boolean(cached?.metaAccountRollups),
      tokenValid,
    }),
  );

  const durationMs = Date.now() - started;
  const failedChecks = healthChecks.filter((c) => !c.passed).length;
  const passedChecks = healthChecks.filter((c) => c.passed).length;

  if (options?.runFresh) {
    recordValidationHistory({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      provider: "meta",
      user,
      storeId,
      businessName: installation?.business_name ?? accountInfo?.businessName ?? null,
      accountId: installation?.ad_account_id ?? null,
      matchScore: matchScore.percent,
      passedChecks,
      failedChecks,
      durationMs,
      comparisons,
    });
  }

  const connectionStatus = !installation
    ? "disconnected"
    : installation.connection_health === "healthy"
      ? "connected"
      : installation.connection_health;

  const cacheDebug = getMetaCacheDebugInfo(storeId);
  const fullSnapshot = await aggregateStoreSnapshot(storeId);
  const integrationGate = await buildValidationGateReport(
    storeId,
    fullSnapshot.connectorStates ?? {},
  );

  return {
    enabled: true,
    provider: "meta",
    providerLabel: "Meta Ads",
    storeId,
    connection: {
      businessName: installation?.business_name ?? accountInfo?.businessName ?? null,
      businessId: installation?.business_id ?? null,
      accountName: installation?.ad_account_name ?? accountInfo?.name ?? null,
      accountId: installation?.ad_account_id ?? null,
      connectionStatus,
      tokenExpiresAt: installation?.token_expires_at ?? null,
      lastSyncAt: installation?.last_sync_at ?? null,
      apiVersion: META_GRAPH_VERSION,
      timezone: accountInfo?.timezone ?? null,
      scopes: installation?.scopes ?? [],
    },
    dashboardSnapshot,
    apiSnapshot,
    comparisons,
    matchScore,
    healthChecks,
    syncLogs: mapSyncLogs(),
    apiLogs: mapApiLogs(),
    cache: {
      cacheKey: cacheDebug.cacheKey,
      createdAt: cacheDebug.createdAt,
      expiresAt: cacheDebug.expiresAt,
      lastHitAt: cacheDebug.lastHitAt,
      lastMissAt: cacheDebug.lastMissAt,
      hitCount: cacheDebug.hitCount,
      missCount: cacheDebug.missCount,
    },
    history: getValidationHistory("meta", storeId),
    trendScores: getTrendScores("meta", storeId),
    durationMs,
    lastValidatedAt: options?.runFresh ? new Date().toISOString() : null,
    integrationGate,
  };
}

export const metaValidationProvider: ValidationProviderAdapter = {
  id: "meta",
  label: "Meta Ads",

  runValidation: runMetaValidation,

  getHistory(storeId: string) {
    return getValidationHistory("meta", storeId);
  },

  async exportReport(storeId, result) {
    const data = result ?? (await runMetaValidation(storeId));
    if (!data.enabled) return null;
    return buildExportReport(data);
  },

  async clearCache(storeId) {
    await clearMetaSyncCache(storeId);
  },
};

/** @deprecated Use metaValidationProvider.runValidation */
export async function buildMetaValidationPanel(
  storeId: string,
  options?: { runFresh?: boolean },
) {
  return metaValidationProvider.runValidation(storeId, options);
}

export async function clearMetaValidationCache(storeId: string): Promise<void> {
  await clearMetaSyncCache(storeId);
}
