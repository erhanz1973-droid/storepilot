import { createDemoPlugin } from "../plugins/demo";
import type { ConnectorHealthResult, ConnectorPlugin } from "../base";
import type { StoreSnapshot } from "../types";
import {
  getCachedShopifySnapshot,
  getInstallationByStoreId,
  getInstallationForStore,
  updateShopifySyncResult,
} from "@/lib/db/shopify";
import { syncShopifyStore } from "@/lib/shopify/sync";
import { DEMO_STORE_ID } from "@/lib/types";
import { isSimulationStoreId } from "@/lib/simulation-lab/store-ids";
import { TokenDecryptionError, logTokenDecryptionFailure } from "@/lib/crypto/decrypt-errors";

function isDedicatedLiveStore(storeId: string): boolean {
  return storeId !== DEMO_STORE_ID && !isSimulationStoreId(storeId);
}

function tokenDecryptionHealth(
  installation: NonNullable<Awaited<ReturnType<typeof getInstallationForStore>>>,
): ConnectorHealthResult {
  return {
    status: "error",
    errorMessage: "Token decryption failed: invalid encryption key",
    lastSyncAt: installation.last_sync_at ?? undefined,
  };
}

export function createShopifyPlugin(storeId: string): ConnectorPlugin {
  const demo = createDemoPlugin("shopify", "Shopify");

  async function getInstallationMetadata() {
    if (storeId === DEMO_STORE_ID) return null;
    return getInstallationForStore(storeId);
  }

  async function getInstallationWithToken() {
    if (storeId === DEMO_STORE_ID) return null;
    try {
      return await getInstallationByStoreId(storeId);
    } catch (error) {
      if (error instanceof TokenDecryptionError) {
        logTokenDecryptionFailure("shopify", error, "getInstallationByStoreId");
        return null;
      }
      throw error;
    }
  }

  async function resolveHealthFromMetadata(
    installation: NonNullable<Awaited<ReturnType<typeof getInstallationForStore>>>,
  ): Promise<ConnectorHealthResult> {
    if (installation.connection_health === "error") {
      return {
        status: "error",
        lastSyncAt: installation.last_sync_at ?? undefined,
        errorMessage: installation.error_message ?? "Connection error",
      };
    }

    try {
      await getInstallationByStoreId(storeId);
      return {
        status: "connected",
        lastSyncAt: installation.last_sync_at ?? undefined,
      };
    } catch (error) {
      if (error instanceof TokenDecryptionError) {
        logTokenDecryptionFailure("shopify", error, "healthCheck");
        return tokenDecryptionHealth(installation);
      }
      throw error;
    }
  }

  return {
    id: "shopify",
    label: "Shopify",
    async connect() {
      const installation = await getInstallationMetadata();
      if (!installation) {
        if (!isDedicatedLiveStore(storeId)) await demo.connect();
      }
    },
    async sync(): Promise<Partial<StoreSnapshot>> {
      const installation = await getInstallationWithToken();
      if (!installation) {
        if (isDedicatedLiveStore(storeId)) return {};
        return demo.sync();
      }

      try {
        const result = await syncShopifyStore(
          installation.shop_domain,
          installation.accessToken,
        );

        await updateShopifySyncResult(installation.store_id, result.stats, result.snapshot, {
          shopName: result.shopName,
          shopifyPlan: result.shopifyPlan,
        });

        return result.snapshot;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sync failed";
        await updateShopifySyncResult(
          installation.store_id,
          installation.sync_stats,
          {},
          { error: message },
        );
        throw err;
      }
    },
    async healthCheck() {
      const installation = await getInstallationMetadata();
      if (!installation) {
        if (isDedicatedLiveStore(storeId)) {
          return { status: "disconnected" as const };
        }
        return demo.healthCheck();
      }
      return resolveHealthFromMetadata(installation);
    },
    async disconnect() {
      await demo.disconnect();
    },
    async getStatus() {
      const installation = await getInstallationMetadata();
      if (!installation) {
        const demoStatus = await demo.getStatus();
        return { ...demoStatus, status: "demo" as const };
      }
      const health = await resolveHealthFromMetadata(installation);
      return { id: "shopify", label: "Shopify", ...health };
    },
    async fetchStoreSnapshot() {
      const installation = await getInstallationWithToken();
      if (!installation) {
        if (isDedicatedLiveStore(storeId)) return {};
        await demo.connect();
        return demo.sync();
      }

      const cached = await getCachedShopifySnapshot(storeId);
      if (cached && (cached.products?.length || cached.storeMetrics)) {
        return cached;
      }

      try {
        return await this.sync();
      } catch (error) {
        if (error instanceof TokenDecryptionError) {
          logTokenDecryptionFailure("shopify", error, "fetchStoreSnapshot");
          if (isDedicatedLiveStore(storeId)) throw error;
          await demo.connect();
          return demo.sync();
        }
        throw error;
      }
    },
  };
}
