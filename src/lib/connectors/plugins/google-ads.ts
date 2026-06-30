import { createPlaceholderPlugin } from "./placeholder";
import type { ConnectorPlugin } from "../base";
import {
  hasActiveGoogleAdsInstallations,
  listGoogleAdsInstallationsForStore,
} from "@/lib/db/google-ads";
import { getGoogleSyncCache } from "@/lib/db/google-sync-cache";
import { buildAdSpendSnapshot } from "@/lib/ads/spend";
import { syncGoogleAdsForStore } from "@/lib/google-ads/store-sync";
import { fetchGoogleAdSnapshot } from "@/lib/google-ads/api";
import { getGoogleAdsDevOverride, isGoogleAdsOAuthConfigured } from "@/lib/google-ads/oauth";

export function createGoogleAdsPlugin(storeId: string): ConnectorPlugin {
  const devOverride = getGoogleAdsDevOverride();

  if (devOverride) {
    let lastSyncAt: string | undefined;
    let lastError: string | undefined;

    return {
      id: "google_ads",
      label: "Google Ads",
      async connect() {
        await fetchGoogleAdSnapshot(devOverride.accessToken, devOverride.customerId);
        lastError = undefined;
        lastSyncAt = new Date().toISOString();
      },
      async sync() {
        lastSyncAt = new Date().toISOString();
        const snapshot = await fetchGoogleAdSnapshot(
          devOverride.accessToken,
          devOverride.customerId,
        );
        return {
          googleAdsSnapshot: snapshot,
          googleDailySpend: snapshot.dailySpend,
          adSpendSnapshot: buildAdSpendSnapshot({ googleRollups: snapshot.rollups }),
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
        return { id: "google_ads", label: "Google Ads (dev override)", ...health };
      },
      async fetchStoreSnapshot() {
        try {
          return await this.sync();
        } catch (err) {
          lastError = err instanceof Error ? err.message : "Sync failed";
          return {};
        }
      },
    };
  }

  if (!isGoogleAdsOAuthConfigured()) {
    return createPlaceholderPlugin("google_ads", "Google Ads");
  }

  return {
    id: "google_ads",
    label: "Google Ads",
    async connect() {
      /* OAuth via /api/google/auth */
    },
    async sync() {
      const active = await hasActiveGoogleAdsInstallations(storeId);
      if (!active) return {};
      const result = await syncGoogleAdsForStore(storeId);
      return {
        googleAdsSnapshot: result.googleAdsSnapshot,
        googleDailySpend: result.googleDailySpend,
        adSpendSnapshot: result.adSpendSnapshot,
      };
    },
    async healthCheck() {
      const installations = await listGoogleAdsInstallationsForStore(storeId);
      if (installations.length === 0) {
        return { status: "disconnected" as const };
      }

      const errored = installations.find(
        (i) => i.connection_health === "error" && i.error_message?.trim(),
      );
      if (errored) {
        return {
          status: "error" as const,
          errorMessage: errored.error_message ?? "Sync error",
          lastSyncAt: errored.last_sync_at ?? undefined,
        };
      }

      const degraded = installations.find((i) => i.connection_health === "degraded");
      if (degraded) {
        return {
          status: "connected" as const,
          errorMessage: degraded.error_message ?? undefined,
          lastSyncAt: degraded.last_sync_at ?? undefined,
        };
      }

      const latestSync = installations
        .map((i) => i.last_sync_at)
        .filter(Boolean)
        .sort()
        .pop();

      return { status: "connected" as const, lastSyncAt: latestSync ?? undefined };
    },
    async disconnect() {
      /* Per-account disconnect via API */
    },
    async getStatus() {
      const health = await this.healthCheck();
      const count = (await listGoogleAdsInstallationsForStore(storeId)).length;
      const label =
        count > 0 ? `Google Ads (${count} account${count === 1 ? "" : "s"})` : "Google Ads";
      return { id: "google_ads", label, ...health };
    },
    async fetchStoreSnapshot() {
      try {
        const active = await hasActiveGoogleAdsInstallations(storeId);
        if (!active) return {};

        const cached = await getGoogleSyncCache(storeId);
        if (cached) return cached;

        return {};
      } catch {
        return {};
      }
    },
  };
}
