import { analyzeSalesTrends } from "@/lib/ai/sales-trends";
import { hasActiveAdsConnector } from "@/lib/connectors/active";
import { CONNECTOR_CAPABILITIES } from "@/lib/connectors/capabilities";
import type { StoreSnapshot } from "@/lib/connectors/types";
import { countActiveCampaigns, summarizeCampaigns } from "@/lib/meta/campaign-stats";
import type { DataSourceStatus } from "@/lib/types";
import type { StoreStatus, StoreUnavailableReason } from "./types";

function estimateUniqueCustomers(orders30d: number): number {
  if (orders30d <= 0) return 0;
  return Math.max(1, Math.round(orders30d * 0.72));
}

function buildUnavailableReasons(
  snapshot: StoreSnapshot,
  adsConnected: boolean,
): StoreUnavailableReason[] {
  const reasons: StoreUnavailableReason[] = [];
  const { storeMetrics, salesTrends, products, campaigns } = snapshot;
  const trendAnalysis = analyzeSalesTrends(salesTrends);
  const shopifyConnected =
    snapshot.connectorStates?.shopify === "connected" ||
    snapshot.connectorStates?.shopify === "demo";

  if (!shopifyConnected) {
    reasons.push({
      id: "shopify_disconnected",
      message: "Shopify is not connected — product and order analysis is limited.",
    });
  }

  if (storeMetrics.orders30d === 0) {
    reasons.push({
      id: "no_recent_orders",
      message: "No recent orders — revenue and demand signals are too thin to recommend changes.",
    });
  }

  if (!trendAnalysis.hasSufficientHistory) {
    reasons.push({
      id: "insufficient_history",
      message: "Insufficient historical data — need more sales history before high-confidence recommendations.",
    });
  }

  if (adsConnected) {
    const active = countActiveCampaigns(campaigns);
    if (active === 0) {
      reasons.push({
        id: "no_active_campaigns",
        message: "No active campaigns — marketing opportunities require campaigns with delivery data.",
      });
    }
  } else {
    reasons.push({
      id: "ads_not_connected",
      message: "No ad platform connected — campaign recommendations are unavailable until Meta Ads is linked.",
    });
  }

  if (products.length === 0) {
    reasons.push({
      id: "no_products",
      message: "No products in catalog — inventory and pricing analysis cannot run.",
    });
  }

  const campaignStats = summarizeCampaigns(campaigns);
  if (adsConnected && campaignStats.totalCount > 0 && campaignStats.activeCount === 0) {
    reasons.push({
      id: "campaigns_paused",
      message: "Campaigns exist but none are active — resume or launch campaigns to unlock marketing insights.",
    });
  }

  if (reasons.length === 0) {
    reasons.push({
      id: "no_high_confidence_signals",
      message:
        "Current metrics look healthy — no high-confidence growth levers crossed our recommendation threshold.",
    });
  }

  return reasons;
}

export function buildStoreStatus(
  snapshot: StoreSnapshot,
  dataSources: DataSourceStatus[],
): StoreStatus {
  const adsConnected = hasActiveAdsConnector(snapshot.connectorStates);
  const campaignStats = summarizeCampaigns(snapshot.campaigns);
  const unavailableReasons = buildUnavailableReasons(snapshot, adsConnected);

  const integrations: StoreStatus["integrations"] = CONNECTOR_CAPABILITIES.map((cap) => {
    const source = dataSources.find((d) => d.id === cap.id);
    const status = source?.status ?? snapshot.connectorStates?.[cap.id] ?? "disconnected";
    return {
      label: cap.label,
      status,
      connected: status === "connected" || status === "demo",
    };
  });

  const connectedLabels = integrations
    .filter((i) => i.connected)
    .map((i) => i.label);

  const headline =
    connectedLabels.length > 0
      ? `Store connected · ${connectedLabels.join(", ")}`
      : "Connect your store to begin analysis";

  return {
    lastSyncedAt: snapshot.syncedAt,
    integrations,
    analyzed: {
      products: snapshot.products.length,
      campaigns: campaignStats.totalCount,
      orders: snapshot.storeMetrics.orders30d,
      customers: estimateUniqueCustomers(snapshot.storeMetrics.orders30d),
      collections: snapshot.collections.length,
    },
    unavailableReasons,
    reassuranceMessage:
      "I currently don't have enough reliable evidence to recommend changes. Your store is being monitored — recommendations will appear when the data supports them.",
    headline,
  };
}
