import { createDemoPlugin } from "../plugins/demo";
import type { ConnectorPlugin } from "../base";
import type { StoreSnapshot } from "../types";
import {
  getInstallationByStoreId,
  getCachedShopifySnapshot,
  updateShopifySyncResult,
} from "@/lib/db/shopify";
import { syncShopifyStore } from "@/lib/shopify/sync";
import { DEMO_STORE_ID } from "@/lib/types";

export function createShopifyPlugin(storeId: string): ConnectorPlugin {
  const demo = createDemoPlugin("shopify", "Shopify");

  async function getInstallation() {
    if (storeId === DEMO_STORE_ID) return null;
    return getInstallationByStoreId(storeId);
  }

  return {
    id: "shopify",
    label: "Shopify",
    async connect() {
      const installation = await getInstallation();
      if (!installation) await demo.connect();
    },
    async sync(): Promise<Partial<StoreSnapshot>> {
      const installation = await getInstallation();
      if (!installation) return demo.sync();

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
      const installation = await getInstallation();
      if (!installation) return demo.healthCheck();

      if (installation.connection_health === "error") {
        return {
          status: "error" as const,
          lastSyncAt: installation.last_sync_at ?? undefined,
          errorMessage: installation.error_message ?? "Connection error",
        };
      }

      return {
        status: "connected" as const,
        lastSyncAt: installation.last_sync_at ?? undefined,
      };
    },
    async disconnect() {
      await demo.disconnect();
    },
    async getStatus() {
      const installation = await getInstallation();
      if (!installation) {
        const demoStatus = await demo.getStatus();
        return { ...demoStatus, status: "demo" as const };
      }
      const health = await this.healthCheck();
      return { id: "shopify", label: "Shopify", ...health };
    },
    async fetchStoreSnapshot() {
      const installation = await getInstallation();
      if (!installation) {
        await demo.connect();
        return demo.sync();
      }

      const cached = await getCachedShopifySnapshot(storeId);
      if (cached && (cached.products?.length || cached.storeMetrics)) {
        return cached;
      }

      return this.sync();
    },
  };
}
