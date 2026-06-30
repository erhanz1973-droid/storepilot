import { createPlaceholderPlugin } from "./placeholder";
import type { ConnectorPlugin } from "../base";
import { isIntegrationConfigured } from "@/lib/integrations/credentials";
import { PHASE6_INTEGRATIONS } from "@/lib/integrations/types";

export function createTikTokAdsPlugin(): ConnectorPlugin {
  const def = PHASE6_INTEGRATIONS.find((d) => d.id === "tiktok")!;
  if (!isIntegrationConfigured(def)) {
    return createPlaceholderPlugin("tiktok", "TikTok Ads");
  }

  let lastSyncAt: string | undefined;

  return {
    id: "tiktok",
    label: "TikTok Ads",
    async connect() {
      lastSyncAt = new Date().toISOString();
    },
    async sync() {
      lastSyncAt = new Date().toISOString();
      return {};
    },
    async healthCheck() {
      return { status: "connected" as const, lastSyncAt };
    },
    async disconnect() {},
    async getStatus() {
      const health = await this.healthCheck();
      return { id: "tiktok", label: "TikTok Ads", ...health };
    },
    async fetchStoreSnapshot() {
      return this.sync();
    },
  };
}

export function createKlaviyoPlugin(): ConnectorPlugin {
  const def = PHASE6_INTEGRATIONS.find((d) => d.id === "klaviyo")!;
  if (!isIntegrationConfigured(def)) {
    return createPlaceholderPlugin("klaviyo", "Klaviyo");
  }

  return {
    id: "klaviyo",
    label: "Klaviyo",
    async connect() {},
    async sync() {
      return {};
    },
    async healthCheck() {
      return { status: "connected" as const };
    },
    async disconnect() {},
    async getStatus() {
      return { id: "klaviyo", label: "Klaviyo", status: "connected" as const };
    },
    async fetchStoreSnapshot() {
      return {};
    },
  };
}
