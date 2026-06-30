import type { BusinessChannelId } from "@/lib/ads/types";
import type { Opportunity } from "@/lib/types";
import type { AttributionStrategyPlan } from "./decision-engine";

export type AttributionModel =
  | "last_click"
  | "first_click"
  | "linear"
  | "position_based"
  | "time_decay";

export type AttributionChannelId =
  | BusinessChannelId
  | "pinterest"
  | "organic_search"
  | "influencer";

export type TouchpointDevice = "mobile" | "desktop" | "tablet" | "unknown";

export type Touchpoint = {
  id: string;
  timestamp: string;
  channelId: AttributionChannelId;
  channelLabel: string;
  source: string;
  campaign?: string;
  campaignId?: string;
  adSet?: string;
  ad?: string;
  creativeId?: string;
  device: TouchpointDevice;
  landingPage: string;
  sessionDurationSec: number;
};

/** Raw event used to reconstruct journeys (from sync or demo) */
export type AttributionEvent = {
  sessionId: string;
  orderId?: string;
  timestamp: string;
  channelId: AttributionChannelId;
  channelLabel: string;
  source: string;
  campaign?: string;
  campaignId?: string;
  adSet?: string;
  ad?: string;
  creativeId?: string;
  device?: TouchpointDevice;
  landingPage?: string;
  sessionDurationSec?: number;
  orderValue?: number;
  isNewCustomer?: boolean;
};

export type CustomerJourney = {
  orderId: string;
  orderValue: number;
  orderTimestamp: string;
  isNewCustomer: boolean;
  touchpoints: Touchpoint[];
  journeyLengthDays: number;
};

export type AttributionConfidence = {
  scorePct: number;
  level: "High" | "Medium" | "Low";
  reason: string;
  trackingCompletenessPct: number;
  identityResolutionPct: number;
  avgTouchpoints: number;
  missingData: string[];
};

export type ChannelAttributionRow = {
  channelId: AttributionChannelId;
  channelLabel: string;
  connected: boolean;
  attributedRevenue: number;
  attributedProfit: number;
  attributedOrders: number;
  adSpend: number;
  roas: number | null;
  profitRoas: number | null;
  shareOfRevenuePct: number;
  shareOfProfitPct: number;
  assistedRevenue: number;
  assistedOrders: number;
  assistRatePct: number;
  multiTouchContributionPct: number;
  newCustomerRevenue: number;
  returningCustomerRevenue: number;
  cac: number | null;
  avgOrderValue: number;
};

export type CampaignAttributionRow = {
  campaignId: string;
  campaignName: string;
  channelId: AttributionChannelId;
  revenue: number;
  attributedRevenue: number;
  orders: number;
  adSpend: number;
  grossProfit: number;
  netProfit: number;
  roas: number | null;
  profitRoas: number | null;
  breakEvenRoas: number | null;
  roasGapPct: number | null;
  cpa: number | null;
  cac: number | null;
  conversionRate: number | null;
  aov: number;
  impressions: number;
  clicks: number;
};

export type CreativeAttributionRow = {
  creativeId: string;
  creativeName: string;
  campaignId: string;
  campaignName: string;
  channelId: AttributionChannelId;
  spend: number;
  revenue: number;
  profit: number;
  roas: number | null;
  ctr: number;
  cpc: number;
  cpm: number;
  conversionRate: number;
  impressions: number;
  clicks: number;
  status: "winning" | "fatigued" | "underperforming" | "neutral";
  recommendation?: "scale" | "pause" | "duplicate" | "refresh";
  insight?: string;
};

export type AcquisitionMetrics = {
  cac: number | null;
  newCustomerRoas: number | null;
  returningCustomerRoas: number | null;
  paybackPeriodDays: number | null;
  ltvCacRatio: number | null;
  newCustomers: number;
  returningCustomers: number;
  newCustomerRevenue: number;
  returningCustomerRevenue: number;
  bestAcquisitionChannel: string | null;
};

export type JourneySample = {
  orderId: string;
  orderValue: number;
  touchpointLabels: string[];
  channelPath: string;
};

export type AttributionDashboard = {
  syncedAt: string;
  model: AttributionModel;
  confidence: AttributionConfidence;
  channels: ChannelAttributionRow[];
  campaigns: CampaignAttributionRow[];
  creatives: CreativeAttributionRow[];
  acquisition: AcquisitionMetrics;
  journeySamples: JourneySample[];
  sampleJourneys: CustomerJourney[];
  winningCreatives: CreativeAttributionRow[];
  fatiguedCreatives: CreativeAttributionRow[];
  assistedLeaders: ChannelAttributionRow[];
  bestCampaigns: CampaignAttributionRow[];
  worstCampaigns: CampaignAttributionRow[];
  strategyPlan: AttributionStrategyPlan;
  attributionOpportunities: Opportunity[];
};

export const ATTRIBUTION_MODEL_LABELS: Record<AttributionModel, string> = {
  last_click: "Last Click",
  first_click: "First Click",
  linear: "Linear",
  position_based: "Position Based (40-20-40)",
  time_decay: "Time Decay",
};

export const CHANNEL_LABELS: Record<AttributionChannelId, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  email: "Email",
  organic_search: "Organic Search",
  organic: "Organic",
  direct: "Direct",
  referral: "Referral",
  influencer: "Influencer",
  unknown: "Unknown",
};
