import { createPlaceholderPlugin } from "./placeholder";
import type { ConnectorPlugin } from "../base";
import {
  hasActiveGa4Installation,
  listGa4Installations,
} from "@/lib/db/ga4";
import { isGa4OAuthConfigured } from "@/lib/ga4/oauth";
import {
  isGa4SnapshotStale,
  loadGa4SnapshotFromCache,
  syncGa4ForStore,
  syncGa4IfStale,
} from "@/lib/ga4/store-sync";

export function createGa4Plugin(storeId: string): ConnectorPlugin {
  if (!isGa4OAuthConfigured()) {
    return createPlaceholderPlugin("ga4", "Google Analytics 4");
  }

  return {
    id: "ga4",
    label: "Google Analytics 4",
    async connect() {
      /* OAuth via /api/ga4/auth */
    },
    async sync() {
      const active = await hasActiveGa4Installation(storeId);
      if (!active) return {};
      const result = await syncGa4ForStore(storeId);
      return { ga4Snapshot: result.ga4Snapshot };
    },
    async healthCheck() {
      const installs = await listGa4Installations(storeId);
      if (installs.length === 0) {
        return { status: "disconnected" as const };
      }
      const install = installs[0];
      if (install.connection_health === "error") {
        return {
          status: "error" as const,
          errorMessage: install.error_message ?? undefined,
          lastSyncAt: install.last_sync_at ?? undefined,
        };
      }
      return {
        status: "connected" as const,
        lastSyncAt: install.last_sync_at ?? undefined,
      };
    },
    async disconnect() {
      /* handled via connections UI */
    },
    async getStatus() {
      const health = await this.healthCheck();
      const installs = await listGa4Installations(storeId);
      return {
        id: "ga4",
        label: installs[0]?.property_name ?? "Google Analytics 4",
        ...health,
      };
    },
    async fetchStoreSnapshot() {
      const active = await hasActiveGa4Installation(storeId);
      if (!active) return {};

      const installs = await listGa4Installations(storeId);
      const install = installs[0];
      const cached = await loadGa4SnapshotFromCache(storeId);

      if (cached && !isGa4SnapshotStale(install.last_sync_at)) {
        return { ga4Snapshot: cached };
      }

      try {
        const synced = await syncGa4IfStale(storeId);
        if (synced) return { ga4Snapshot: synced.ga4Snapshot };
      } catch {
        if (cached) return { ga4Snapshot: cached };
      }

      return cached ? { ga4Snapshot: cached } : {};
    },
  };
}
