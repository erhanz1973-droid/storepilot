import type { ConnectorPlugin, ConnectorHealthResult } from "../base";
import { buildDemoSnapshot } from "@/lib/demo/get-demo-snapshot";
import { getActiveDemoScenarioId } from "@/lib/demo/scenario-context";
import { allowDemoData } from "@/lib/env/runtime";

export function createDemoPlugin(
  id: ConnectorPlugin["id"],
  label: string,
): ConnectorPlugin {
  let connected = false;
  let lastSyncAt: string | undefined;

  async function healthCheck(): Promise<ConnectorHealthResult> {
    return { status: "demo", lastSyncAt };
  }

  async function loadDemoSnapshot() {
    if (!allowDemoData()) {
      return {
        source: "disconnected" as const,
        syncedAt: new Date().toISOString(),
        products: [],
        collections: [],
        campaigns: [],
        storeMetrics: {
          revenue30d: 0,
          orders30d: 0,
          aov30d: 0,
          conversionRate30d: 0,
        },
        connectorStates: {},
      };
    }
    const scenarioId = await getActiveDemoScenarioId();
    return buildDemoSnapshot(scenarioId);
  }

  return {
    id,
    label,
    async connect() {
      connected = true;
      lastSyncAt = new Date().toISOString();
    },
    async sync() {
      lastSyncAt = new Date().toISOString();
      const full = await loadDemoSnapshot();
      if (id === "shopify") {
        return {
          products: full.products,
          collections: full.collections,
          storeMetrics: full.storeMetrics,
          salesTrends: full.salesTrends,
          profitRollups: full.profitRollups,
          dailyMetrics: full.dailyMetrics,
          productOrderStats: full.productOrderStats,
          attributionEvents: full.attributionEvents,
          customerSnapshot: full.customerSnapshot,
        };
      }
      if (id === "meta_ads") {
        return {
          campaigns: full.campaigns,
          adSpendSnapshot: full.adSpendSnapshot,
          metaAccountRollups: full.metaAccountRollups,
        };
      }
      return {};
    },
    healthCheck,
    async disconnect() {
      connected = false;
    },
    async getStatus() {
      const health = await healthCheck();
      return { id, label, ...health };
    },
    async fetchStoreSnapshot() {
      if (!connected) await this.connect();
      return this.sync();
    },
  };
}
