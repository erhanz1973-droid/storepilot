import type { BusinessModel } from "@/lib/business-model/types";

export type GrowthStage = "startup" | "growing" | "scaling" | "mature" | "declining";
export type StoreMaturity = "new" | "established" | "legacy";
export type TrafficMix =
  | "meta_first"
  | "google_first"
  | "organic_first"
  | "email_first"
  | "marketplace_first"
  | "tiktok_first"
  | "hybrid";
export type ProductDna =
  | "single_product"
  | "hero_product"
  | "general_store"
  | "large_catalog"
  | "luxury"
  | "low_ticket"
  | "high_ticket"
  | "subscription"
  | "seasonal";
export type MerchantPersonality = "aggressive" | "conservative" | "balanced";
export type AutomationPreference =
  | "manual"
  | "approval_required"
  | "semi_automatic"
  | "full_autopilot";
export type ExecutionStyle = "fast" | "measured" | "deliberate";
export type RiskTolerance = "low" | "medium" | "high";
export type DecisionStyle = "data_driven" | "conservative" | "growth_first";
export type PricePosition = "budget" | "mid_market" | "premium" | "luxury";
export type CustomerType = "b2c" | "b2b" | "mixed";
export type SeasonalityLevel = "none" | "moderate" | "high";

/** Core DNA traits — each trait is independently extendable */
export type MerchantDNATraits = {
  businessModel: BusinessModel;
  storeMaturity: StoreMaturity;
  growthStage: GrowthStage;
  primaryAcquisitionChannel: string;
  trafficMix: TrafficMix;
  typicalMarginPct?: number;
  averageOrderValue?: number;
  customerType: CustomerType;
  productCount: number;
  productDna: ProductDna;
  pricePosition: PricePosition;
  seasonality: SeasonalityLevel;
  geographicMarkets: string[];
  preferredAdPlatforms: string[];
  executionStyle: ExecutionStyle;
  riskTolerance: RiskTolerance;
  automationPreference: AutomationPreference;
  decisionStyle: DecisionStyle;
  personality: MerchantPersonality;
};

/** Learned adjustments from merchant behavior (-1 … +1) */
export type MerchantDNALearnedSignals = {
  aggressivenessBias: number;
  scalingAffinity: number;
  discountAffinity: number;
  inventoryClearanceAffinity: number;
  approvalRate?: number;
  rejectionRate?: number;
  tooAggressiveRejections?: number;
  scalingApprovals?: number;
};

export type MerchantDNAManualOverrides = Partial<
  Pick<
    MerchantDNATraits,
    | "growthStage"
    | "trafficMix"
    | "productDna"
    | "personality"
    | "automationPreference"
    | "riskTolerance"
    | "decisionStyle"
    | "executionStyle"
    | "primaryAcquisitionChannel"
  >
>;

/** Persistent intelligence layer consumed by the Decision Engine */
export type MerchantDNA = MerchantDNATraits & {
  storeId: string;
  version: number;
  learned: MerchantDNALearnedSignals;
  manualOverrides: MerchantDNAManualOverrides;
  benchmarkCohort: string;
  inferredAt: string;
  personalizationNarrative: string;
};

export type MerchantBenchmarkMetric = {
  id: string;
  label: string;
  merchantValue: number;
  cohortMedian: number;
  cohortPercentile: number;
  unit: "currency" | "percent" | "ratio" | "count";
};

export type MerchantBenchmark = {
  cohortId: string;
  cohortLabel: string;
  similarMerchantCount: number;
  metrics: MerchantBenchmarkMetric[];
};

export const GROWTH_STAGE_LABELS: Record<GrowthStage, string> = {
  startup: "Startup",
  growing: "Growing",
  scaling: "Scaling",
  mature: "Mature",
  declining: "Declining",
};

export const TRAFFIC_MIX_LABELS: Record<TrafficMix, string> = {
  meta_first: "Meta-first",
  google_first: "Google-first",
  organic_first: "Organic-first",
  email_first: "Email-first",
  marketplace_first: "Marketplace-first",
  tiktok_first: "TikTok-first",
  hybrid: "Hybrid",
};

export const PRODUCT_DNA_LABELS: Record<ProductDna, string> = {
  single_product: "Single Product",
  hero_product: "Hero Product",
  general_store: "General Store",
  large_catalog: "Large Catalog",
  luxury: "Luxury",
  low_ticket: "Low Ticket",
  high_ticket: "High Ticket",
  subscription: "Subscription",
  seasonal: "Seasonal",
};

export const PERSONALITY_LABELS: Record<MerchantPersonality, string> = {
  aggressive: "Aggressive",
  conservative: "Conservative",
  balanced: "Balanced",
};

export const AUTOMATION_LABELS: Record<AutomationPreference, string> = {
  manual: "Manual",
  approval_required: "Approval Required",
  semi_automatic: "Semi-Automatic",
  full_autopilot: "Full Autopilot",
};

export function normalizeGrowthStage(raw?: string | null): GrowthStage {
  const key = (raw ?? "growing").toLowerCase() as GrowthStage;
  return key in GROWTH_STAGE_LABELS ? key : "growing";
}

export function normalizeTrafficMix(raw?: string | null): TrafficMix {
  const key = (raw ?? "hybrid").toLowerCase().replace(/-/g, "_") as TrafficMix;
  return key in TRAFFIC_MIX_LABELS ? key : "hybrid";
}

export function normalizeProductDna(raw?: string | null): ProductDna {
  const key = (raw ?? "general_store").toLowerCase().replace(/-/g, "_") as ProductDna;
  return key in PRODUCT_DNA_LABELS ? key : "general_store";
}

export function normalizePersonality(raw?: string | null): MerchantPersonality {
  const key = (raw ?? "balanced").toLowerCase() as MerchantPersonality;
  return key in PERSONALITY_LABELS ? key : "balanced";
}

export function normalizeAutomationPreference(raw?: string | null): AutomationPreference {
  const key = (raw ?? "approval_required").toLowerCase().replace(/-/g, "_") as AutomationPreference;
  return key in AUTOMATION_LABELS ? key : "approval_required";
}
