import type { ConnectorStatus, DataSourceId } from "@/lib/types";
import { isConnectorActiveForAnalysis } from "./active";

export type ConnectorCapability = {
  id: DataSourceId;
  label: string;
  description: string;
  /** Value-focused copy for Approval Center integration cards */
  intelligenceUnlocks?: string[];
  analyzers: string[];
  recommendationCategories: string[];
  envKeys: string[];
  connectHref?: string;
};

export const CONNECTOR_CAPABILITIES: ConnectorCapability[] = [
  {
    id: "shopify",
    label: "Shopify",
    description: "Commerce platform — products, inventory, orders, and collections (first supported provider)",
    analyzers: ["inventory", "pricing", "bundles", "homepage", "promotions"],
    recommendationCategories: [
      "low_inventory",
      "slow_selling",
      "bundle_opportunity",
      "homepage_merchandising",
      "promotion_opportunity",
    ],
    envKeys: ["SHOPIFY_API_KEY", "SHOPIFY_API_SECRET"],
    connectHref: "/connected-store",
  },
  {
    id: "meta_ads",
    label: "Meta Ads",
    description: "Campaign performance, ROAS, spend, and frequency",
    intelligenceUnlocks: [
      "Campaign ROAS and spend analysis",
      "Creative fatigue detection",
      "Budget optimization recommendations",
      "Pause and scale decision support",
    ],
    analyzers: ["campaigns"],
    recommendationCategories: ["campaign_review"],
    envKeys: ["META_APP_ID", "META_APP_SECRET"],
    connectHref: "/api/meta/auth",
  },
  {
    id: "google_ads",
    label: "Google Ads",
    description: "Search and display campaign insights",
    intelligenceUnlocks: [
      "Search and display performance analysis",
      "CPA and ROAS monitoring",
      "Campaign efficiency recommendations",
      "Cross-channel attribution context",
    ],
    analyzers: ["campaigns"],
    recommendationCategories: ["campaign_review"],
    envKeys: [
      "GOOGLE_ADS_CLIENT_ID",
      "GOOGLE_ADS_CLIENT_SECRET",
      "GOOGLE_ADS_DEVELOPER_TOKEN",
    ],
    connectHref: "/api/google/auth",
  },
  {
    id: "tiktok",
    label: "TikTok Ads",
    description: "TikTok campaign performance and audience data",
    intelligenceUnlocks: [
      "Campaign performance analysis",
      "Creative fatigue detection",
      "Attribution insights",
      "AI optimization recommendations",
    ],
    analyzers: ["campaigns"],
    recommendationCategories: ["campaign_review"],
    envKeys: ["TIKTOK_ADS_ACCESS_TOKEN"],
    connectHref: "/connected-store",
  },
  {
    id: "klaviyo",
    label: "Klaviyo",
    description: "Email flows, segments, and campaign performance",
    intelligenceUnlocks: [
      "Email revenue attribution",
      "Flow performance analysis",
      "Customer segmentation",
      "Retention opportunities",
    ],
    analyzers: [],
    recommendationCategories: [],
    envKeys: ["KLAVIYO_API_KEY"],
    connectHref: "/connected-store",
  },
];

export function getCapability(id: DataSourceId): ConnectorCapability | undefined {
  return CONNECTOR_CAPABILITIES.find((c) => c.id === id);
}

/** Marketing / ads connectors that show connect cards when disconnected */
export const MARKETING_CONNECTOR_IDS: DataSourceId[] = [
  "meta_ads",
  "google_ads",
  "tiktok",
  "klaviyo",
];

export function getDisconnectedMarketingConnectors(
  states: Partial<Record<DataSourceId, ConnectorStatus>>,
) {
  return MARKETING_CONNECTOR_IDS.filter(
    (id) => !isConnectorActiveForAnalysis(id, states[id] ?? "disconnected"),
  )
    .map((id) => getCapability(id))
    .filter((c): c is ConnectorCapability => Boolean(c));
}

export function getStaleRecommendationCategories(
  states: Partial<Record<DataSourceId, ConnectorStatus>>,
): string[] {
  const categoryProducers = new Map<string, DataSourceId[]>();

  for (const cap of CONNECTOR_CAPABILITIES) {
    for (const cat of cap.recommendationCategories) {
      const producers = categoryProducers.get(cat) ?? [];
      producers.push(cap.id);
      categoryProducers.set(cat, producers);
    }
  }

  const stale: string[] = [];
  for (const [category, producerIds] of categoryProducers) {
    const anyActive = producerIds.some((id) =>
      isConnectorActiveForAnalysis(id, states[id] ?? "disconnected"),
    );
    if (!anyActive) stale.push(category);
  }
  return stale;
}
