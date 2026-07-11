export type StorePlanId = "free" | "starter";

export type PlanLimits = {
  maxAnalyzedCampaigns: number;
  unlimitedCampaigns: boolean;
};

export type CampaignEntitlements = {
  planId: StorePlanId;
  planLabel: string;
  upgradePlanLabel: string;
  maxAnalyzedCampaigns: number;
  maxDeepAnalysisCampaigns: number;
  totalCampaigns: number;
  scannedCampaignCount: number;
  unlockedCampaignId: string;
  unlockedCampaignName: string;
  lockedCampaignCount: number;
  isUnlimited: boolean;
};

export type CampaignAccessStatus = "overview" | "deep";

export const STARTER_DEEP_FEATURES = [
  "Root cause analysis",
  "Creative intelligence",
  "Audience analysis",
  "AI timelines",
  "Simulations",
  "Budget optimization",
  "AI reasoning & expected impact",
  "Step-by-step optimization packages",
  "Approval workflows",
] as const;

export const STARTER_UNLOCK_FEATURES = STARTER_DEEP_FEATURES;
