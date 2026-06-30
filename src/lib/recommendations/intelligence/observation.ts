import type { RecommendationCategory } from "@/lib/types";

/** Observation window (days) per recommendation category. */
const OBSERVATION_DAYS: Partial<Record<RecommendationCategory, number>> = {
  campaign_review: 7,
  low_inventory: 14,
  slow_selling: 14,
  promotion_opportunity: 14,
  bundle_opportunity: 14,
  homepage_merchandising: 30,
};

export function getObservationDays(category: RecommendationCategory | string): number {
  return OBSERVATION_DAYS[category as RecommendationCategory] ?? 7;
}

export function getObservationEndDate(
  startIso: string,
  category: RecommendationCategory | string,
): string {
  const days = getObservationDays(category);
  return new Date(new Date(startIso).getTime() + days * 86400000).toISOString();
}

export function observationLabel(category: RecommendationCategory | string): string {
  const days = getObservationDays(category);
  return `${days} days`;
}
