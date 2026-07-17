import { buildAdSpendSnapshot, emptyAdSpendRollups } from "@/lib/ads/spend";
import {
  getSelectedMetaAdsInstallationWithToken,
  markMetaAdsReconnectRequired,
  rotateMetaAccessToken,
  updateMetaAdsSyncResult,
} from "@/lib/db/meta-ads";
import { setMetaSyncCache } from "@/lib/db/meta-sync-cache";
import {
  classifyOAuthFailure,
  formatClassifiedErrorMessage,
} from "@/lib/integrations/oauth-failure";
import { summarizeCampaigns } from "@/lib/meta/campaign-stats";
import type { MetaCampaignSyncStats } from "@/lib/meta/campaign-stats";
import {
  ensureMetaAccessToken,
  metaReconnectErrorMessage,
} from "@/lib/meta/token-lifecycle";
import {
  fetchMetaAdSnapshot,
  mergeMetaAccountRollups,
  mergeMetaDailySpend,
} from "@/lib/meta/sync";
import type { AdSpendRollups } from "@/lib/ads/types";
import type { MetaCampaign } from "@/lib/connectors/types";
import { isDevValidationEnabled } from "@/lib/validation/dev-gate";
import { recordMetaSyncLog } from "@/lib/validation/meta/sync-log";

export type MetaSyncResult = {
  campaigns: MetaCampaign[];
  statsByInstallation: Map<string, MetaCampaignSyncStats>;
  accountRollups: AdSpendRollups;
  metaDailySpend: { date: string; spend: number }[];
  adSpendSnapshot: ReturnType<typeof buildAdSpendSnapshot>;
  errors: MetaSyncInstallationError[];
};

export type MetaSyncInstallationError = {
  installationId: string;
  adAccountId: string;
  adAccountName?: string | null;
  message: string;
};

export async function syncMetaAdsForStore(
  storeId: string,
  meta?: { storeLabel?: string },
): Promise<MetaSyncResult> {
  const started = Date.now();
  const installation = await getSelectedMetaAdsInstallationWithToken(storeId);
  const campaigns: MetaCampaign[] = [];
  const statsByInstallation = new Map<string, MetaCampaignSyncStats>();
  const accountRollupsList: AdSpendRollups[] = [];
  const dailySpendSeries: { date: string; spend: number; attributedRevenue: number }[][] = [];
  const errors: MetaSyncInstallationError[] = [];

  if (!installation) {
    const emptyRollups = emptyAdSpendRollups();
    const adSpendSnapshot = buildAdSpendSnapshot({
      metaCampaigns: [],
      metaAccountRollups: emptyRollups,
    });
    await setMetaSyncCache(storeId, {
      campaigns: [],
      metaAccountRollups: emptyRollups,
      metaDailySpend: [],
      adSpendSnapshot,
    });
    return {
      campaigns,
      statsByInstallation,
      accountRollups: emptyRollups,
      metaDailySpend: [],
      adSpendSnapshot,
      errors,
    };
  }

  try {
    const lifecycle = await ensureMetaAccessToken({
      accessToken: installation.accessToken,
      tokenExpiresAt: installation.token_expires_at,
    });

    if (lifecycle.status === "reconnect_required") {
      const message = metaReconnectErrorMessage(lifecycle.failure);
      const empty = summarizeCampaigns([]);
      statsByInstallation.set(installation.id, empty);
      errors.push({
        installationId: installation.id,
        adAccountId: installation.ad_account_id,
        adAccountName: installation.ad_account_name,
        message,
      });
      await markMetaAdsReconnectRequired(installation.id, message);
      await updateMetaAdsSyncResult(installation.id, empty, {
        error: message,
        connectionHealth: "error",
      });
    } else {
      let accessToken = lifecycle.accessToken;
      if (lifecycle.status === "refreshed") {
        await rotateMetaAccessToken(
          installation.id,
          lifecycle.accessToken,
          lifecycle.tokenExpiresAt,
        );
        accessToken = lifecycle.accessToken;
      }

      const snapshot = await fetchMetaAdSnapshot(
        accessToken,
        installation.ad_account_id,
        { adAccountName: installation.ad_account_name ?? undefined },
      );
      const stats = summarizeCampaigns(snapshot.campaigns);
      campaigns.push(...snapshot.campaigns);
      accountRollupsList.push(snapshot.accountRollups);
      dailySpendSeries.push(snapshot.dailySpend);
      statsByInstallation.set(installation.id, stats);
      await updateMetaAdsSyncResult(installation.id, stats);
    }
  } catch (err) {
    const failure = classifyOAuthFailure("meta", err);
    const message = formatClassifiedErrorMessage(failure);
    const empty = summarizeCampaigns([]);
    statsByInstallation.set(installation.id, empty);
    errors.push({
      installationId: installation.id,
      adAccountId: installation.ad_account_id,
      adAccountName: installation.ad_account_name,
      message,
    });
    if (failure.requiresReauthorization) {
      await markMetaAdsReconnectRequired(installation.id, message);
    }
    await updateMetaAdsSyncResult(installation.id, empty, {
      error: message,
      connectionHealth: failure.health,
    });
  }

  const accountRollups = mergeMetaAccountRollups(accountRollupsList);
  const mergedDaily = mergeMetaDailySpend(dailySpendSeries);
  const metaDailySpend = mergedDaily.map((d) => ({ date: d.date, spend: d.spend }));
  const adSpendSnapshot = buildAdSpendSnapshot({
    metaCampaigns: campaigns,
    metaAccountRollups: accountRollups,
  });

  const snapshotPartial = {
    campaigns,
    metaAccountRollups: accountRollups,
    metaDailySpend,
    adSpendSnapshot,
  };

  await setMetaSyncCache(storeId, snapshotPartial);

  if (isDevValidationEnabled() && installation) {
    recordMetaSyncLog({
      storeId,
      storeLabel: meta?.storeLabel,
      businessId: installation.business_id,
      businessName: installation.business_name ?? undefined,
      adAccountId: installation.ad_account_id,
      adAccountName: installation.ad_account_name ?? undefined,
      campaignCount: campaigns.length,
      spend30d: accountRollups.last30d.spend,
      durationMs: Date.now() - started,
      success: errors.length === 0,
      error: errors[0]?.message,
    });
  }

  return {
    campaigns,
    statsByInstallation,
    accountRollups,
    metaDailySpend,
    adSpendSnapshot,
    errors,
  };
}
