import type { PlanLimits, StorePlanId } from "./types";

export const PLAN_LABELS: Record<StorePlanId, string> = {
  free: "Free Early Access",
  starter: "Free (legacy internal tier)",
};

export const PLAN_LIMITS: Record<StorePlanId, PlanLimits> = {
  free: {
    maxAnalyzedCampaigns: Number.POSITIVE_INFINITY,
    unlimitedCampaigns: true,
  },
  starter: {
    maxAnalyzedCampaigns: Number.POSITIVE_INFINITY,
    unlimitedCampaigns: true,
  },
};

/** Version 1 is completely free: every campaign receives deep analysis. */
export const FREE_DEEP_ANALYSIS_CAMPAIGNS = Number.POSITIVE_INFINITY;

export function getUpgradePlan(current: StorePlanId): StorePlanId | null {
  // Retained for future entitlement architecture; Version 1 has no paid upgrade.
  if (current === "free") return null;
  return null;
}
