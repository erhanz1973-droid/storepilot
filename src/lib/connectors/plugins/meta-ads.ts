import { createDemoPlugin } from "../plugins/demo";
import { createPlaceholderPlugin } from "../plugins/placeholder";
import type { ConnectorPlugin } from "../base";
import { allowDemoData } from "@/lib/env/runtime";
import {
  getSelectedMetaAdsInstallation,
  hasActiveMetaAdsInstallations,
} from "@/lib/db/meta-ads";
import { getMetaSyncCache } from "@/lib/db/meta-sync-cache";
import { buildAdSpendSnapshot } from "@/lib/ads/spend";
import { syncMetaAdsForStore } from "@/lib/meta/store-sync";
import { fetchMetaAdSnapshot } from "@/lib/meta/sync";
import { getMetaDevOverride, isMetaOAuthConfigured } from "@/lib/meta/oauth";

export function createMetaAdsPlugin(storeId: string): ConnectorPlugin {
  const devOverride = getMetaDevOverride();

  if (devOverride) {
    let lastSyncAt: string | undefined;
    let lastError: string | undefined;

    return {
      id: "meta_ads",
      label: "Meta Ads",
      async connect() {
        await fetchMetaAdSnapshot(devOverride.accessToken, devOverride.accountId);
        lastError = undefined;
        lastSyncAt = new Date().toISOString();
      },
      async sync() {
        lastSyncAt = new Date().toISOString();
        const snapshot = await fetchMetaAdSnapshot(
          devOverride.accessToken,
          devOverride.accountId,
        );
        return {
          campaigns: snapshot.campaigns,
          metaAccountRollups: snapshot.accountRollups,
          metaDailySpend: snapshot.dailySpend.map((d) => ({
            date: d.date,
            spend: d.spend,
          })),
          adSpendSnapshot: buildAdSpendSnapshot({
            metaCampaigns: snapshot.campaigns,
            metaAccountRollups: snapshot.accountRollups,
          }),
        };
      },
      async healthCheck() {
        if (lastError) {
          return { status: "error" as const, errorMessage: lastError, lastSyncAt };
        }
        return { status: "connected" as const, lastSyncAt };
      },
      async disconnect() {
        lastError = undefined;
      },
      async getStatus() {
        const health = await this.healthCheck();
        return { id: "meta_ads", label: "Meta Ads (dev override)", ...health };
      },
      async fetchStoreSnapshot() {
        try {
          return await this.sync();
        } catch (err) {
          lastError = err instanceof Error ? err.message : "Sync failed";
          return { campaigns: [] };
        }
      },
    };
  }

  if (!isMetaOAuthConfigured()) {
    if (allowDemoData()) {
      return createDemoPlugin("meta_ads", "Meta Ads");
    }
    return createPlaceholderPlugin("meta_ads", "Meta Ads");
  }

  return {
    id: "meta_ads",
    label: "Meta Ads",
    async connect() {
      /* OAuth handled via /api/meta/auth */
    },
    async sync() {
      const active = await hasActiveMetaAdsInstallations(storeId);
      if (!active) return { campaigns: [] };
      const result = await syncMetaAdsForStore(storeId);
      return {
        campaigns: result.campaigns,
        metaAccountRollups: result.accountRollups,
        metaDailySpend: result.metaDailySpend,
        adSpendSnapshot: result.adSpendSnapshot,
      };
    },
    async healthCheck() {
      const installation = await getSelectedMetaAdsInstallation(storeId);
      if (!installation) {
        return { status: "disconnected" as const };
      }

      if (installation.connection_health === "error") {
        return {
          status: "error" as const,
          errorMessage: installation.error_message ?? "Sync error",
          lastSyncAt: installation.last_sync_at ?? undefined,
        };
      }

      return {
        status: "connected" as const,
        lastSyncAt: installation.last_sync_at ?? undefined,
      };
    },
    async disconnect() {
      /* Per-account disconnect via API */
    },
    async getStatus() {
      const health = await this.healthCheck();
      const selected = await getSelectedMetaAdsInstallation(storeId);
      const label = selected
        ? `Meta Ads (${selected.ad_account_name ?? selected.ad_account_id})`
        : "Meta Ads";
      return { id: "meta_ads", label, ...health };
    },
    async fetchStoreSnapshot() {
      try {
        const active = await hasActiveMetaAdsInstallations(storeId);
        if (!active) return { campaigns: [] };

        const cached = await getMetaSyncCache(storeId);
        if (cached) return cached;

        return { campaigns: [] };
      } catch {
        return { campaigns: [] };
      }
    },
  };
}
