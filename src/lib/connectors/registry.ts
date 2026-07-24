import { createMetaAdsPlugin } from "./plugins/meta-ads";
import { createPlaceholderPlugin } from "./plugins/placeholder";
import { createShopifyPlugin } from "./plugins/shopify";
import { createGoogleAdsPlugin } from "./plugins/google-ads";
import { createGa4Plugin } from "./plugins/ga4";
import { createTikTokAdsPlugin, createKlaviyoPlugin } from "./plugins/tiktok-ads";
import type { ConnectorHealthResult, ConnectorPlugin, ConnectorRegistry } from "./base";
import type { AdSpendRollups, AdSpendSnapshot, DailyMetricPoint } from "@/lib/ads/types";
import { buildAdSpendSnapshot } from "@/lib/ads/spend";
import { mergeIntegrationIntoSnapshot } from "@/lib/integrations/engine";
import { mergeDailyMetrics } from "@/lib/profit/roas";
import type { MetaCampaign, StoreSnapshot } from "./types";
import type { CommercePlatformId } from "@/lib/commerce/types";
import { resolveActiveCommerceProvider } from "@/lib/commerce/providers/registry";
import { isConnectorActiveForAnalysis } from "./active";
import { resolveActiveStoreId } from "@/lib/store/context";
import type { ConnectorStatus, DataSourceId } from "@/lib/types";
import { isSimulationStoreId } from "@/lib/simulation-lab/store-ids";
import { loadSimulationSnapshot } from "@/lib/simulation-stores/load";
import { TokenDecryptionError, logTokenDecryptionFailure } from "@/lib/crypto/decrypt-errors";

const DEFAULT_METRICS: StoreSnapshot["storeMetrics"] = {
  revenue30d: 0,
  orders30d: 0,
  aov30d: 0,
  conversionRate30d: 0,
};

function mergeDailyFromSnapshot(
  revenueMetrics?: DailyMetricPoint[],
  existing?: DailyMetricPoint[],
): DailyMetricPoint[] | undefined {
  if (existing?.length) return existing;
  if (!revenueMetrics?.length) return undefined;

  const revenueByDate = new Map(
    revenueMetrics.map((d) => [d.date, { revenue: d.revenue, orders: d.orders }]),
  );
  const spendByDate = new Map(
    revenueMetrics.map((d) => [d.date, d.adSpend]),
  );
  return mergeDailyMetrics(revenueByDate, spendByDate);
}

function connectorFailureHealth(
  connectorId: string,
  error: unknown,
): ConnectorHealthResult {
  if (error instanceof TokenDecryptionError) {
    logTokenDecryptionFailure(connectorId, error, "aggregateStoreSnapshot");
    return {
      status: "error",
      errorMessage: "Token decryption failed: invalid encryption key",
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[connector:${connectorId}] aggregateStoreSnapshot failed:`, message);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  return {
    status: "error",
    errorMessage: message,
  };
}

async function collectConnectorResult(connector: ConnectorPlugin) {
  try {
    return {
      id: connector.id,
      health: await connector.healthCheck(),
      partial: await connector.fetchStoreSnapshot(),
    };
  } catch (error) {
    return {
      id: connector.id,
      health: connectorFailureHealth(connector.id, error),
      partial: {} as Partial<StoreSnapshot>,
    };
  }
}

export async function getConnectorRegistry(storeId?: string): Promise<ConnectorRegistry> {
  const activeStoreId = storeId ?? (await resolveActiveStoreId());
  return {
    shopify: createShopifyPlugin(activeStoreId),
    meta_ads: createMetaAdsPlugin(activeStoreId),
    google_ads: createGoogleAdsPlugin(activeStoreId),
    ga4: createGa4Plugin(activeStoreId),
    klaviyo: createKlaviyoPlugin(),
    tiktok: createTikTokAdsPlugin(),
    erp: createPlaceholderPlugin("erp", "ERP"),
  };
}

export async function getAllConnectors(storeId?: string): Promise<ConnectorPlugin[]> {
  return Object.values(await getConnectorRegistry(storeId));
}

export async function syncAllConnectors(storeId?: string): Promise<Partial<StoreSnapshot>> {
  const registry = await getConnectorRegistry(storeId);
  const partials = await Promise.all(
    Object.values(registry).map((c) => c.sync()),
  );
  return partials.reduce<Partial<StoreSnapshot>>((acc, part) => ({ ...acc, ...part }), {});
}

export async function aggregateStoreSnapshot(storeId?: string): Promise<StoreSnapshot> {
  const activeStoreId = storeId ?? (await resolveActiveStoreId());

  if (isSimulationStoreId(activeStoreId)) {
    const simSnapshot = await loadSimulationSnapshot(activeStoreId);
    if (simSnapshot) return simSnapshot;
  }

  const registry = await getConnectorRegistry(activeStoreId);
  const connectors = Object.values(registry);

  const results = await Promise.all(connectors.map((connector) => collectConnectorResult(connector)));

  const connectorStates = Object.fromEntries(
    results.map((r) => [r.id, r.health.status]),
  ) as Partial<Record<DataSourceId, ConnectorStatus>>;

  const shopifyStatus = connectorStates.shopify;
  const hasLiveCommerce = shopifyStatus === "connected";
  let commerceProvider: CommercePlatformId = "shopify";
  let commerceStoreDomain: string | undefined;

  const activeProvider = await resolveActiveCommerceProvider(activeStoreId);
  if (activeProvider) {
    commerceProvider = activeProvider.platform;
    try {
      const providerStatus = await activeProvider.getStatus(activeStoreId);
      commerceStoreDomain = providerStatus.storeDomain;
    } catch (error) {
      if (error instanceof TokenDecryptionError) {
        logTokenDecryptionFailure(commerceProvider, error, "resolveActiveCommerceProvider.getStatus");
      } else if (error instanceof Error) {
        console.error(`[commerce:${commerceProvider}] getStatus failed:`, error.message);
        if (error.stack) console.error(error.stack);
      }
    }
  }

  let products: StoreSnapshot["products"] = [];
  let collections: StoreSnapshot["collections"] = [];
  let storeMetrics = DEFAULT_METRICS;
  let campaigns: MetaCampaign[] = [];
  let salesTrends: StoreSnapshot["salesTrends"];
  let profitRollups: StoreSnapshot["profitRollups"];
  let dailyMetrics: DailyMetricPoint[] | undefined;
  let metaAccountRollups: AdSpendRollups | undefined;
  let adSpendSnapshot: AdSpendSnapshot | undefined;
  let metaDailySpend: { date: string; spend: number }[] = [];
  let googleDailySpend: { date: string; spend: number }[] = [];
  let googleAdsSnapshot: StoreSnapshot["googleAdsSnapshot"];
  let ga4Snapshot: StoreSnapshot["ga4Snapshot"];
  let productOrderStats: StoreSnapshot["productOrderStats"];
  let attributionEvents: StoreSnapshot["attributionEvents"];
  let customerSnapshot: StoreSnapshot["customerSnapshot"];

  for (const result of results) {
    if (!isConnectorActiveForAnalysis(result.id, result.health.status)) continue;

    if (result.partial.products) products = result.partial.products;
    if (result.partial.collections) collections = result.partial.collections;
    if (result.partial.storeMetrics) storeMetrics = result.partial.storeMetrics;
    if (result.partial.salesTrends) salesTrends = result.partial.salesTrends;
    if (result.partial.profitRollups) profitRollups = result.partial.profitRollups;
    if (result.partial.productOrderStats) productOrderStats = result.partial.productOrderStats;
    if (result.partial.attributionEvents?.length) attributionEvents = result.partial.attributionEvents;
    if (result.partial.customerSnapshot) customerSnapshot = result.partial.customerSnapshot;
    if (result.partial.dailyMetrics?.length) dailyMetrics = result.partial.dailyMetrics;
    if (result.partial.metaAccountRollups) metaAccountRollups = result.partial.metaAccountRollups;
    if (result.partial.adSpendSnapshot) adSpendSnapshot = result.partial.adSpendSnapshot;
    if (result.partial.metaDailySpend?.length) {
      metaDailySpend = metaDailySpend.concat(result.partial.metaDailySpend);
    }
    if (result.partial.googleDailySpend?.length) {
      googleDailySpend = googleDailySpend.concat(result.partial.googleDailySpend);
    }
    if (result.partial.googleAdsSnapshot) {
      googleAdsSnapshot = result.partial.googleAdsSnapshot;
    }
    if (result.partial.ga4Snapshot) {
      ga4Snapshot = result.partial.ga4Snapshot;
    }
    if (result.partial.campaigns?.length) {
      campaigns = campaigns.concat(result.partial.campaigns);
    }
  }

  if (!adSpendSnapshot) {
    adSpendSnapshot = buildAdSpendSnapshot({
      metaCampaigns: campaigns,
      metaAccountRollups,
    });
  }

  if (dailyMetrics?.length || metaDailySpend.length > 0 || googleDailySpend.length > 0) {
    const revenueByDate = new Map<string, { revenue: number; orders: number }>();
    for (const d of dailyMetrics ?? []) {
      revenueByDate.set(d.date, { revenue: d.revenue, orders: d.orders });
    }
    const spendByDate = new Map<string, number>();
    for (const d of [...metaDailySpend, ...googleDailySpend]) {
      spendByDate.set(d.date, (spendByDate.get(d.date) ?? 0) + d.spend);
    }
    for (const d of dailyMetrics ?? []) {
      if (d.adSpend > 0 && !spendByDate.has(d.date)) {
        spendByDate.set(d.date, d.adSpend);
      }
    }
    dailyMetrics = mergeDailyMetrics(revenueByDate, spendByDate);
  }

  let base: StoreSnapshot = {
    source: hasLiveCommerce ? "connected" : "disconnected",
    syncedAt: new Date().toISOString(),
    commerceProvider,
    commerceStoreDomain,
    products,
    collections,
    campaigns,
    storeMetrics,
    salesTrends,
    profitRollups,
    productOrderStats,
    attributionEvents,
    customerSnapshot,
    adSpendSnapshot,
    dailyMetrics,
    metaAccountRollups,
    googleAdsSnapshot,
    ga4Snapshot,
    connectorStates,
  };

  base = mergeIntegrationIntoSnapshot(base);

  if (ga4Snapshot) {
    base.ga4Snapshot = ga4Snapshot;
    if (ga4Snapshot.ecommerceConversionRatePct != null) {
      base.storeMetrics = {
        ...base.storeMetrics,
        conversionRate30d: ga4Snapshot.ecommerceConversionRatePct,
      };
    }
  }

  const liveGoogleRollups = googleAdsSnapshot?.rollups ?? base.googleAdsSnapshot?.rollups;
  if (liveGoogleRollups || base.integrationSnapshot) {
    adSpendSnapshot = buildAdSpendSnapshot({
      metaCampaigns: campaigns,
      metaAccountRollups,
      googleRollups: liveGoogleRollups,
      tiktokRollups: base.tiktokAdsSnapshot?.rollups,
      klaviyoRollups: base.klaviyoSnapshot?.rollups,
    });
    base.adSpendSnapshot = adSpendSnapshot;
    if (googleAdsSnapshot) {
      base.googleAdsSnapshot = googleAdsSnapshot;
    }
  }

  if (base.operationalCosts && profitRollups) {
    const ops = base.operationalCosts;
    if (ops.actualCogs30d != null) {
      base.profitRollups = {
        ...profitRollups,
        last30d: {
          ...profitRollups.last30d,
          cogs: ops.actualCogs30d,
          shipping: ops.shippingCost30d,
        },
      };
    }
  }

  return base;
}

export async function getDataSourceStatuses(storeId?: string) {
  const registry = await getConnectorRegistry(storeId);
  return Promise.all(
    Object.values(registry).map(async (connector) => {
      try {
        return connector.getStatus();
      } catch (error) {
        const health = connectorFailureHealth(connector.id, error);
        return { id: connector.id, label: connector.label, ...health };
      }
    }),
  );
}

export async function runConnectorHealthChecks(storeId?: string) {
  const registry = await getConnectorRegistry(storeId);
  return Promise.all(
    Object.values(registry).map(async (connector) => {
      try {
        return {
          id: connector.id,
          label: connector.label,
          ...(await connector.healthCheck()),
        };
      } catch (error) {
        return {
          id: connector.id,
          label: connector.label,
          ...connectorFailureHealth(connector.id, error),
        };
      }
    }),
  );
}
