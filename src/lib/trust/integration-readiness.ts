import type { StoreSnapshot } from "@/lib/connectors/types";
import type { EnrichedMarketingCampaign } from "@/lib/analytics/marketing-manager";
import { hasActiveAdsConnector } from "@/lib/connectors/active";
import type { ConnectorStatus, DataSourceId } from "@/lib/types";
import { dataUnavailableMessage } from "./data-mode";

export type IntegrationReadinessPhase =
  | "fresh_store"
  | "shopify_only"
  | "meta_only"
  | "google_only"
  | "full_stack";

export type DataConfidenceLevel = "high" | "medium" | "low";

export type IntegrationIssue = {
  platform: string;
  message: string;
};

export type IntegrationReadiness = {
  phase: IntegrationReadinessPhase;
  shopifyConnected: boolean;
  metaConnected: boolean;
  googleConnected: boolean;
  adsConnectedCount: number;
  canGenerateAdvertisingRecommendations: boolean;
  canShowChannelComparison: boolean;
  canShowBudgetAllocation: boolean;
  executiveMessage: string | null;
  advertisingMessage: string | null;
  dataConfidence: DataConfidenceLevel;
  dataConfidenceMessage: string | null;
  disconnectedPlatforms: string[];
  integrationIssues: IntegrationIssue[];
};

function connectorConnected(
  states: Partial<Record<DataSourceId, ConnectorStatus>> | undefined,
  id: DataSourceId,
): boolean {
  const status = states?.[id];
  return status === "connected";
}

function connectorFailed(
  states: Partial<Record<DataSourceId, ConnectorStatus>> | undefined,
  id: DataSourceId,
): boolean {
  const status = states?.[id];
  return status === "error";
}

export function assessDataConfidence(input: {
  snapshot: StoreSnapshot;
  campaigns?: EnrichedMarketingCampaign[];
}): { level: DataConfidenceLevel; message: string | null } {
  const orders = input.snapshot.storeMetrics.orders30d ?? 0;
  const campaigns = input.campaigns ?? [];
  const campaignSpend = campaigns.reduce((sum, campaign) => sum + campaign.spend, 0);
  const adSpend =
    campaignSpend > 0
      ? campaignSpend
      : input.snapshot.adSpendSnapshot?.totalRollups.last7d.spend ?? 0;

  if (orders < 5 && campaigns.length === 0) {
    return {
      level: "low",
      message:
        "Very little store and advertising history is available. Recommendations will stay conservative until more orders and campaign data sync.",
    };
  }
  if (orders < 15 || (campaigns.length > 0 && adSpend < 50)) {
    return {
      level: "low",
      message:
        "Limited recent data — avoid strong conclusions. Wait for additional orders and ad spend before major budget changes.",
    };
  }
  if (orders < 50 || campaigns.length < 2) {
    return {
      level: "medium",
      message: "Early-stage data — recommendations are directional. Confidence improves as sync history grows.",
    };
  }
  return { level: "high", message: null };
}

export function buildIntegrationReadiness(input: {
  snapshot: StoreSnapshot;
  campaigns?: EnrichedMarketingCampaign[];
}): IntegrationReadiness {
  const { snapshot } = input;
  const states = snapshot.connectorStates;
  const shopifyConnected =
    snapshot.source === "connected" && connectorConnected(states, "shopify");
  const metaConnected = connectorConnected(states, "meta_ads");
  const googleConnected =
    connectorConnected(states, "google_ads") || Boolean(snapshot.googleAdsSnapshot?.campaigns?.length);
  const adsConnectedCount = [metaConnected, googleConnected].filter(Boolean).length;
  const hasAds = hasActiveAdsConnector(states ?? {}) || adsConnectedCount > 0;

  let phase: IntegrationReadinessPhase = "fresh_store";
  if (shopifyConnected && adsConnectedCount === 0) phase = "shopify_only";
  else if (shopifyConnected && metaConnected && !googleConnected) phase = "meta_only";
  else if (shopifyConnected && googleConnected && !metaConnected) phase = "google_only";
  else if (shopifyConnected && metaConnected && googleConnected) phase = "full_stack";

  const disconnectedPlatforms: string[] = [];
  if (!metaConnected) disconnectedPlatforms.push("Meta Ads");
  if (!googleConnected) disconnectedPlatforms.push("Google Ads");

  const integrationIssues: IntegrationIssue[] = [];
  if (connectorFailed(states, "meta_ads")) {
    integrationIssues.push({
      platform: "Meta Ads",
      message: dataUnavailableMessage(
        "Meta Ads",
        "connection failed or authentication expired — reconnect in Connections",
      ),
    });
  }
  if (connectorFailed(states, "google_ads")) {
    integrationIssues.push({
      platform: "Google Ads",
      message: dataUnavailableMessage(
        "Google Ads",
        "connection failed or token expired — reconnect in Connections",
      ),
    });
  }

  const confidence = assessDataConfidence(input);

  const executiveMessage = !shopifyConnected
    ? "Connect Shopify to analyze your store. We explain what's missing instead of showing demo data."
    : phase === "shopify_only"
      ? "I can analyze your store performance. Connect advertising platforms to unlock marketing intelligence."
      : integrationIssues.length > 0
        ? "Some integrations need attention. Recommendations use only connected platforms with live data."
        : confidence.level === "low"
          ? confidence.message
          : null;

  const advertisingMessage = !hasAds
    ? dataUnavailableMessage(
        "Advertising recommendations",
        "no ad platforms connected — connect Meta or Google Ads in Connections",
      )
    : adsConnectedCount === 1
      ? `Recommendations use ${metaConnected ? "Meta Ads" : "Google Ads"} only. Connect the other platform for cross-channel comparison.`
      : integrationIssues.length > 0
        ? "Some ad integrations are unavailable. Recommendations exclude disconnected platforms."
        : confidence.level === "low"
          ? confidence.message
          : null;

  return {
    phase,
    shopifyConnected,
    metaConnected,
    googleConnected,
    adsConnectedCount,
    canGenerateAdvertisingRecommendations: hasAds && integrationIssues.length === 0,
    canShowChannelComparison: metaConnected && googleConnected,
    canShowBudgetAllocation: hasAds,
    executiveMessage,
    advertisingMessage,
    dataConfidence: confidence.level,
    dataConfidenceMessage: confidence.message,
    disconnectedPlatforms,
    integrationIssues,
  };
}
