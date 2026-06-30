/** Product-level attribution types — shared across profit, marketing, and AI */

export type AttributionMethod =
  | "direct_purchase"
  | "campaign_attribution"
  | "revenue_allocation"
  | "equal_distribution"
  | "unknown";

export type ProductAttributionConfidenceLevel =
  | "verified"
  | "high"
  | "estimated"
  | "low"
  | "unknown";

export const ATTRIBUTION_METHOD_LABELS: Record<AttributionMethod, string> = {
  direct_purchase: "Direct Purchase Attribution",
  campaign_attribution: "Campaign Attribution",
  revenue_allocation: "Revenue Allocation",
  equal_distribution: "Equal Distribution",
  unknown: "Unknown",
};

export const ATTRIBUTION_CONFIDENCE_LABELS: Record<ProductAttributionConfidenceLevel, string> = {
  verified: "Verified",
  high: "High Confidence",
  estimated: "Estimated",
  low: "Low Confidence",
  unknown: "Unknown",
};

export type ProductRevenueSources = {
  meta: number;
  google: number;
  organic: number;
  direct: number;
  email: number;
  referral: number;
};

export type ProductAdCostBreakdown = {
  metaSpend: number | null;
  googleSpend: number | null;
  totalSpend: number | null;
  isEstimated: boolean;
  isUnknown: boolean;
};

export type ProductCampaignAttribution = {
  campaignId: string;
  campaignName: string;
  channel: "meta" | "google" | "tiktok";
  attributedRevenue: number;
  attributedSpend: number;
  method: AttributionMethod;
  confidencePct: number;
};

export type ProductAttributionProfile = {
  productId: string;
  title: string;
  imageUrl: string | null;
  revenue: number;
  adCost: ProductAdCostBreakdown;
  cogs: number;
  shippingCost: number;
  paymentFees: number;
  grossProfit: number;
  netProfit: number;
  marginPct: number;
  roas: number | null;
  unitsSold: number;
  inventory: number;
  confidencePct: number;
  confidenceLevel: ProductAttributionConfidenceLevel;
  method: AttributionMethod;
  methodLabel: string;
  primaryTrafficSource: string;
  recommendation: string;
  sources: ProductRevenueSources;
  campaigns: ProductCampaignAttribution[];
  costSource: "shopify" | "manual" | "estimated";
  losingMoney: boolean;
};

export type ProductAttributionWidget = {
  id: string;
  label: string;
  products: { productId: string; title: string; value: number; sublabel?: string }[];
};

export type ProductAttributionDashboard = {
  syncedAt: string;
  products: ProductAttributionProfile[];
  byProductId: Record<string, ProductAttributionProfile>;
  overallConfidencePct: number;
  widgets: {
    topByProfit: ProductAttributionWidget;
    topByRoas: ProductAttributionWidget;
    topByOrganic: ProductAttributionWidget;
    mostExpensiveToAdvertise: ProductAttributionWidget;
    losingMoney: ProductAttributionWidget;
    highestAdCost: ProductAttributionWidget;
    highestMargin: ProductAttributionWidget;
  };
};

/** Explicit campaign → product mapping (demo, catalog, or future API sync) */
export type CampaignProductLink = {
  campaignId: string;
  productIds: string[];
  collectionIds?: string[];
  method: AttributionMethod;
  confidencePct: number;
};
