import {
  ensureGoogleAccessToken,
  listGoogleAdsInstallationsWithTokens,
  updateGoogleAdsSyncResult,
} from "@/lib/db/google-ads";
import { setGoogleSyncCache } from "@/lib/db/google-sync-cache";
import { buildAdSpendSnapshot } from "@/lib/ads/spend";
import {
  summarizeGoogleCampaigns,
  type GoogleCampaignSyncStats,
} from "@/lib/google-ads/campaign-stats";
import {
  fetchGoogleAdSnapshot,
  mergeGoogleAccountRollups,
  mergeGoogleDailySpend,
} from "@/lib/google-ads/api";
import type { AdSpendRollups } from "@/lib/ads/types";
import type { GoogleAdsSnapshot } from "@/lib/integrations/types";

export type GoogleSyncResult = {
  googleAdsSnapshot: GoogleAdsSnapshot;
  statsByInstallation: Map<string, GoogleCampaignSyncStats>;
  accountRollups: AdSpendRollups;
  googleDailySpend: { date: string; spend: number }[];
  adSpendSnapshot: ReturnType<typeof buildAdSpendSnapshot>;
};

function mergeGoogleSnapshots(snapshots: GoogleAdsSnapshot[]): GoogleAdsSnapshot {
  if (snapshots.length === 1) return snapshots[0];

  const campaigns = snapshots.flatMap((s) => s.campaigns);
  const rollups = mergeGoogleAccountRollups(snapshots.map((s) => s.rollups));
  const dailySpend = mergeGoogleDailySpend(snapshots.map((s) => s.dailySpend));

  return {
    campaigns,
    adGroups: snapshots.flatMap((s) => s.adGroups),
    keywords: snapshots.flatMap((s) => s.keywords),
    searchTerms: snapshots.flatMap((s) => s.searchTerms),
    rollups,
    dailySpend,
  };
}

export async function syncGoogleAdsForStore(storeId: string): Promise<GoogleSyncResult> {
  const installations = await listGoogleAdsInstallationsWithTokens(storeId);
  const snapshots: GoogleAdsSnapshot[] = [];
  const statsByInstallation = new Map<string, GoogleCampaignSyncStats>();
  const rollupsList: AdSpendRollups[] = [];
  const dailySeries: { date: string; spend: number }[][] = [];

  await Promise.all(
    installations.map(async (installation) => {
      try {
        const accessToken = await ensureGoogleAccessToken(installation);
        const snapshot = await fetchGoogleAdSnapshot(accessToken, installation.customer_id, {
          customerName: installation.customer_name ?? undefined,
        });
        snapshots.push(snapshot);
        rollupsList.push(snapshot.rollups);
        dailySeries.push(snapshot.dailySpend);
        const stats = summarizeGoogleCampaigns(snapshot.campaigns);
        statsByInstallation.set(installation.id, stats);
        await updateGoogleAdsSyncResult(installation.id, stats);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sync failed";
        const empty = summarizeGoogleCampaigns([]);
        statsByInstallation.set(installation.id, empty);
        await updateGoogleAdsSyncResult(installation.id, empty, { error: message });
      }
    }),
  );

  const googleAdsSnapshot = mergeGoogleSnapshots(
    snapshots.length > 0
      ? snapshots
      : [
          {
            campaigns: [],
            adGroups: [],
            keywords: [],
            searchTerms: [],
            rollups: {
              today: { spend: 0, attributedRevenue: 0, orders: 0 },
              yesterday: { spend: 0, attributedRevenue: 0, orders: 0 },
              last7d: { spend: 0, attributedRevenue: 0, orders: 0 },
              last30d: { spend: 0, attributedRevenue: 0, orders: 0 },
            },
            dailySpend: [],
          },
        ],
  );

  const accountRollups = mergeGoogleAccountRollups(rollupsList);
  const googleDailySpend = mergeGoogleDailySpend(dailySeries);
  const adSpendSnapshot = buildAdSpendSnapshot({ googleRollups: accountRollups });

  const snapshotPartial = {
    googleAdsSnapshot,
    googleDailySpend,
    adSpendSnapshot,
  };

  await setGoogleSyncCache(storeId, snapshotPartial);

  return {
    googleAdsSnapshot,
    statsByInstallation,
    accountRollups,
    googleDailySpend,
    adSpendSnapshot,
  };
}
