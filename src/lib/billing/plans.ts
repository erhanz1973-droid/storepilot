import type { PlanLimits, StorePlanId } from "./types";

export const PLAN_LABELS: Record<StorePlanId, string> = {
  free: "Free",
  starter: "Starter",
};

export const PLAN_LIMITS: Record<StorePlanId, PlanLimits> = {
  free: {
    maxAnalyzedCampaigns: 1,
    unlimitedCampaigns: false,
  },
  starter: {
    maxAnalyzedCampaigns: Number.POSITIVE_INFINITY,
    unlimitedCampaigns: true,
  },
};

/** Free scans every campaign; Starter unlocks deep analysis for all. */
export const FREE_DEEP_ANALYSIS_CAMPAIGNS = 1;

export function getUpgradePlan(current: StorePlanId): StorePlanId | null {
  if (current === "free") return "starter";
  return null;
}
