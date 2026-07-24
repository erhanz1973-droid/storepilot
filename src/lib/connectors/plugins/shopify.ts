import { createDemoPlugin } from "../plugins/demo";
import type { ConnectorHealthResult, ConnectorPlugin } from "../base";
import type { StoreSnapshot } from "../types";
import {
  getCachedShopifySnapshot,
  getInstallationByStoreId,
  getInstallationForStore,
  markShopifyReinstallRequired,
  updateShopifySyncResult,
} from "@/lib/db/shopify";
import { syncShopifyStore } from "@/lib/shopify/sync";
import { DEMO_STORE_ID } from "@/lib/types";
import { allowDemoData } from "@/lib/env/runtime";
import { TokenDecryptionError, logTokenDecryptionFailure } from "@/lib/crypto/decrypt-errors";
import {
  installationRequiresReinstall,
  isShopifyReinstallRequiredError,
} from "@/lib/shopify/auth-errors";
import { detectAppMismatch } from "@/lib/shopify/token-diagnostics";

function tokenDecryptionHealth(
  installation: NonNullable<Awaited<ReturnType<typeof getInstallationForStore>>>,
): ConnectorHealthResult {
  return {
    status: "error",
    errorMessage: "Token decryption failed: invalid encryption key",
    lastSyncAt: installation.last_sync_at ?? undefined,
  };
}

function reinstallRequiredHealth(
  installation: NonNullable<Awaited<ReturnType<typeof getInstallationForStore>>>,
  message: string,
): ConnectorHealthResult {
  return {
    status: "error",
    lastSyncAt: installation.last_sync_at ?? undefined,
    errorMessage: message,
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
      if (isShopifyReinstallRequiredError(error)) {
        await markShopifyReinstallRequired(error.shopDomain, error.reason);
        return null;
      }
      throw error;
    }
  }

  async function resolveHealthFromMetadata(
    installation: NonNullable<Awaited<ReturnType<typeof getInstallationForStore>>>,
  ): Promise<ConnectorHealthResult> {
    if (installationRequiresReinstall(installation.error_message)) {
      return reinstallRequiredHealth(
        installation,
        installation.error_message ?? "Shopify reinstall required.",
      );
    }

    const mismatch = detectAppMismatch(installation.clientId);
    if (mismatch.mismatch) {
      return reinstallRequiredHealth(
        installation,
        `Access token belongs to Shopify app ${mismatch.storedClientIdPrefix}… but this deployment uses ${mismatch.currentClientIdPrefix}…. Reinstall the app from Shopify Admin.`,
      );
    }

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
      if (isShopifyReinstallRequiredError(error)) {
        return reinstallRequiredHealth(installation, error.reason);
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
        if (allowDemoData() && storeId === DEMO_STORE_ID) await demo.connect();
      }
    },
    async sync(): Promise<Partial<StoreSnapshot>> {
      const installation = await getInstallationWithToken();
      if (!installation) {
        if (allowDemoData() && storeId === DEMO_STORE_ID) return demo.sync();
        return {};
      }

      try {
        const result = await syncShopifyStore(
          installation.shop_domain,
          installation.accessToken,
          {
            storedClientId: installation.clientId,
            installationId: installation.id,
            refreshToken: installation.refreshToken,
          },
        );

        await updateShopifySyncResult(installation.store_id, result.stats, result.snapshot, {
          shopName: result.shopName,
          shopifyPlan: result.shopifyPlan,
        });

        return result.snapshot;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sync failed";
        if (isShopifyReinstallRequiredError(err)) {
          await markShopifyReinstallRequired(installation.shop_domain, err.reason);
        }
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
        if (allowDemoData() && storeId === DEMO_STORE_ID) return demo.healthCheck();
        return { status: "disconnected" as const };
      }
      return resolveHealthFromMetadata(installation);
    },
    async disconnect() {
      await demo.disconnect();
    },
    async getStatus() {
      const installation = await getInstallationMetadata();
      if (!installation) {
        if (allowDemoData() && storeId === DEMO_STORE_ID) {
          const demoStatus = await demo.getStatus();
          return { ...demoStatus, status: "demo" as const };
        }
        return { id: "shopify", label: "Shopify", status: "disconnected" as const };
      }
      const health = await resolveHealthFromMetadata(installation);
      return { id: "shopify", label: "Shopify", ...health };
    },
    async fetchStoreSnapshot() {
      const installation = await getInstallationWithToken();
      if (!installation) {
        if (allowDemoData() && storeId === DEMO_STORE_ID) {
          await demo.connect();
          return demo.sync();
        }
        return {};
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
          // Never fall back to fictional catalog for a live merchant token failure.
          throw error;
        }
        throw error;
      }
    },
  };
}
