import type { Recommendation } from "@/lib/types";

/** Product-facing store maturity — separate from Merchant DNA growthStage. */
export type MerchantStage = "new" | "growing" | "established";

export type MerchantExperience = "guide_me" | "optimize_me" | "improve_profitability";

export type ChecklistStepId =
  | "store_setup"
  | "product_readiness"
  | "conversion_readiness"
  | "marketing_setup"
  | "first_traffic"
  | "first_sales"
  | "profitability";

export type CheckStatus = "ready" | "needs_attention" | "missing" | "locked" | "unknown";

export type GrowthCheckItem = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** Evidence from live store data — omitted when the field was never synced. */
  evidence?: string;
};

export type GrowthChecklistStep = {
  id: ChecklistStepId;
  title: string;
  status: CheckStatus;
  summary: string;
  items: GrowthCheckItem[];
  ctaLabel?: string;
  ctaHref?: string;
  complete: boolean;
};

export type KnownFact = {
  label: string;
  value: string;
};

export type NextBestAction = {
  id: string;
  stepId: ChecklistStepId;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  problem: string;
  whyItMatters: string;
  recommendedAction: string;
  ctaLabel: string;
  ctaHref: string;
  basedOn: KnownFact[];
  /** True when this came from the existing recommendation engine. */
  fromRecommendationEngine: boolean;
  recommendationId?: string;
};

export type MerchantMaturity = {
  stage: MerchantStage;
  experience: MerchantExperience;
  label: string;
  reason: string;
  orders30d: number;
  revenue30d: number;
  productCount: number;
  adsConnected: boolean;
  meaningfulAdsData: boolean;
  acquisitionChannelCount: number;
  shopAgeDays: number | null;
};

export type GrowthCopilotView = {
  storeId: string;
  maturity: MerchantMaturity;
  headline: string;
  lede: string;
  nextBestAction: NextBestAction;
  checklist: GrowthChecklistStep[];
  progress: {
    complete: number;
    total: number;
    label: string;
  };
  known: KnownFact[];
  unknown: KnownFact[];
  basedOn: string;
  /** Existing engine recs that are still honest for this stage — never fabricated profit. */
  engineRecommendations: Recommendation[];
  showProfitabilityDashboard: boolean;
};
