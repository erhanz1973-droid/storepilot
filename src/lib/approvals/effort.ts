import type { Recommendation, RecommendationCategory } from "@/lib/types";
import type { ImplementationEffort } from "@/lib/types";

const EFFORT_BY_CATEGORY: Record<RecommendationCategory, ImplementationEffort> = {
  low_inventory: "Low",
  slow_selling: "Medium",
  bundle_opportunity: "Medium",
  homepage_merchandising: "Low",
  promotion_opportunity: "Medium",
  campaign_review: "High",
};

export function effortForCategory(category: RecommendationCategory): ImplementationEffort {
  return EFFORT_BY_CATEGORY[category];
}

export const EFFORT_SORT_RANK: Record<ImplementationEffort, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
};
