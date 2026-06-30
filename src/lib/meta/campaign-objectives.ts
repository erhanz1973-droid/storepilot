import type { MetaCampaign } from "@/lib/connectors/types";

/** Normalized campaign objectives used by the recommendation engine. */
export type CampaignObjective =
  | "sales"
  | "catalog_sales"
  | "leads"
  | "traffic"
  | "brand_awareness"
  | "reach"
  | "engagement"
  | "messages"
  | "video_views"
  | "app_installs";

export const CAMPAIGN_OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  sales: "Sales",
  catalog_sales: "Catalog Sales",
  leads: "Lead Generation",
  traffic: "Traffic",
  brand_awareness: "Brand Awareness",
  reach: "Reach",
  engagement: "Engagement",
  messages: "Messages",
  video_views: "Video Views",
  app_installs: "App Installs",
};

const OBJECTIVE_ALIASES: Record<string, CampaignObjective> = {
  OUTCOME_SALES: "sales",
  CONVERSIONS: "sales",
  PRODUCT_CATALOG_SALES: "catalog_sales",
  OUTCOME_LEADS: "leads",
  LEAD_GENERATION: "leads",
  OUTCOME_TRAFFIC: "traffic",
  LINK_CLICKS: "traffic",
  OUTCOME_AWARENESS: "brand_awareness",
  BRAND_AWARENESS: "brand_awareness",
  REACH: "reach",
  OUTCOME_ENGAGEMENT: "engagement",
  POST_ENGAGEMENT: "engagement",
  MESSAGES: "messages",
  OUTCOME_MESSAGING: "messages",
  CONVERSATIONS: "messages",
  VIDEO_VIEWS: "video_views",
  APP_INSTALLS: "app_installs",
  OUTCOME_APP_PROMOTION: "app_installs",
};

/** How much ROAS should influence review decisions (0 = ignore, 1 = primary). */
export const OBJECTIVE_ROAS_WEIGHT: Record<CampaignObjective, number> = {
  sales: 1,
  catalog_sales: 0.95,
  leads: 0.15,
  traffic: 0.1,
  brand_awareness: 0.02,
  reach: 0.02,
  engagement: 0.05,
  messages: 0.03,
  video_views: 0.02,
  app_installs: 0.1,
};

export type ObjectiveMetricFocus = {
  objective: CampaignObjective;
  label: string;
  primaryMetrics: string[];
  roasWeight: number;
};

export const OBJECTIVE_METRIC_PROFILES: Record<CampaignObjective, ObjectiveMetricFocus> = {
  sales: {
    objective: "sales",
    label: CAMPAIGN_OBJECTIVE_LABELS.sales,
    primaryMetrics: ["ROAS", "Revenue", "CPA", "Conversion Rate", "Profit"],
    roasWeight: OBJECTIVE_ROAS_WEIGHT.sales,
  },
  catalog_sales: {
    objective: "catalog_sales",
    label: CAMPAIGN_OBJECTIVE_LABELS.catalog_sales,
    primaryMetrics: ["ROAS", "Revenue", "CPA", "Conversion Rate", "Catalog ROAS"],
    roasWeight: OBJECTIVE_ROAS_WEIGHT.catalog_sales,
  },
  leads: {
    objective: "leads",
    label: CAMPAIGN_OBJECTIVE_LABELS.leads,
    primaryMetrics: ["CPL", "Qualified Leads", "Conversion Rate"],
    roasWeight: OBJECTIVE_ROAS_WEIGHT.leads,
  },
  traffic: {
    objective: "traffic",
    label: CAMPAIGN_OBJECTIVE_LABELS.traffic,
    primaryMetrics: ["CPC", "CTR", "Landing Page Views", "Bounce Rate"],
    roasWeight: OBJECTIVE_ROAS_WEIGHT.traffic,
  },
  brand_awareness: {
    objective: "brand_awareness",
    label: CAMPAIGN_OBJECTIVE_LABELS.brand_awareness,
    primaryMetrics: ["Reach", "Impressions", "CPM", "Frequency"],
    roasWeight: OBJECTIVE_ROAS_WEIGHT.brand_awareness,
  },
  reach: {
    objective: "reach",
    label: CAMPAIGN_OBJECTIVE_LABELS.reach,
    primaryMetrics: ["Reach", "Impressions", "CPM", "Frequency"],
    roasWeight: OBJECTIVE_ROAS_WEIGHT.reach,
  },
  engagement: {
    objective: "engagement",
    label: CAMPAIGN_OBJECTIVE_LABELS.engagement,
    primaryMetrics: ["CTR", "Engagement Rate", "Frequency", "Cost per Engagement"],
    roasWeight: OBJECTIVE_ROAS_WEIGHT.engagement,
  },
  messages: {
    objective: "messages",
    label: CAMPAIGN_OBJECTIVE_LABELS.messages,
    primaryMetrics: ["Conversations", "Cost per Message", "Reply Rate", "CTR"],
    roasWeight: OBJECTIVE_ROAS_WEIGHT.messages,
  },
  video_views: {
    objective: "video_views",
    label: CAMPAIGN_OBJECTIVE_LABELS.video_views,
    primaryMetrics: ["Video Views", "ThruPlay", "Completion Rate", "Cost per View"],
    roasWeight: OBJECTIVE_ROAS_WEIGHT.video_views,
  },
  app_installs: {
    objective: "app_installs",
    label: CAMPAIGN_OBJECTIVE_LABELS.app_installs,
    primaryMetrics: ["App Installs", "CPI", "Install Rate", "Activation Rate"],
    roasWeight: OBJECTIVE_ROAS_WEIGHT.app_installs,
  },
};

function inferObjectiveFromOptimization(campaign: MetaCampaign): CampaignObjective | null {
  const opt = (campaign.optimizationGoal ?? "").toUpperCase();
  const dest = (campaign.destinationType ?? "").toUpperCase();

  if (opt.includes("THRUPLAY") || opt.includes("VIDEO")) return "video_views";
  if (opt.includes("LEAD") || opt.includes("QUALITY_LEAD")) return "leads";
  if (opt.includes("LINK_CLICK") || opt.includes("LANDING_PAGE")) return "traffic";
  if (opt.includes("REACH") || opt.includes("IMPRESSIONS")) return "reach";
  if (opt.includes("APP_INSTALL")) return "app_installs";
  if (
    dest.includes("MESSENGER") ||
    dest.includes("WHATSAPP") ||
    dest.includes("INSTAGRAM_DIRECT") ||
    opt.includes("CONVERSATION") ||
    opt.includes("MESSAGING") ||
    opt.includes("REPLY")
  ) {
    return "messages";
  }
  if (opt.includes("ENGAGEMENT") || opt.includes("POST")) return "engagement";
  if (opt.includes("VALUE") || opt.includes("PURCHASE") || opt.includes("CONVERSION")) {
    return "sales";
  }

  return null;
}

/** Classify a Meta campaign into a normalized objective before performance evaluation. */
export function classifyCampaignObjective(campaign: MetaCampaign): CampaignObjective {
  if (campaign.campaignObjective) return campaign.campaignObjective;

  const raw = (campaign.objective ?? "").toUpperCase();
  const fromObjective = OBJECTIVE_ALIASES[raw];
  if (fromObjective) return fromObjective;

  const fromOptimization = inferObjectiveFromOptimization(campaign);
  if (fromOptimization) return fromOptimization;

  if (campaign.revenue7d > 0 && campaign.spend7d > 0) return "sales";

  return "engagement";
}

export function getObjectiveProfile(objective: CampaignObjective): ObjectiveMetricFocus {
  return OBJECTIVE_METRIC_PROFILES[objective];
}
