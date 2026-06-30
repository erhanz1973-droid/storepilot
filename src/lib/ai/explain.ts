import type { BusinessContext, RecommendationExplanation } from "./types";
import type { Recommendation } from "@/lib/types";
import { wasExplained } from "./session";

const CATEGORY_RISKS: Record<Recommendation["category"], string[]> = {
  low_inventory: [
    "Supplier lead time may exceed days of cover",
    "Stockout could push customers to competitors",
  ],
  slow_selling: [
    "Further discounting may erode margin without lifting volume",
    "Price changes need monitoring to avoid demand collapse",
  ],
  bundle_opportunity: [
    "Bundle discount could cannibalize full-price single-SKU sales",
    "Attach rate assumptions may not hold for all customer segments",
  ],
  homepage_merchandising: [
    "Homepage changes affect brand positioning — test before permanent swap",
    "Seasonal collections may need featured placement regardless of revenue",
  ],
  promotion_opportunity: [
    "Promotions can train customers to wait for discounts",
    "Margin compression if discount depth is too aggressive",
  ],
  campaign_review: [
    "Pausing campaigns may reduce top-of-funnel awareness",
    "Creative refresh takes 3–7 days to re-enter learning phase",
  ],
};

function confidenceExplanation(rec: Recommendation): string {
  const pct = Math.round(rec.confidenceScore * 100);
  const base = `Base confidence ${pct}% from `;

  if (rec.category === "low_inventory") {
    return `${base}inventory velocity vs. days-of-cover math. Higher when sell-through is steady and stock is critically low.`;
  }
  if (rec.category === "campaign_review") {
    return `${base}ROAS, spend efficiency, and frequency signals. Critical when ROAS < 1.0 (below break-even).`;
  }
  if (rec.category === "bundle_opportunity") {
    return `${base}co-purchase patterns and combined SKU revenue. Medium confidence without cart-level data.`;
  }
  return `${base}30-day sales trends, inventory levels, and category-specific thresholds in the recommendation engine.`;
}

export function explainRecommendation(
  rec: Recommendation,
  sessionId?: string,
): RecommendationExplanation {
  const alreadyExplained = sessionId ? wasExplained(sessionId, rec.id) : false;

  return {
    recommendationId: rec.id,
    title: rec.title,
    why: alreadyExplained
      ? `As noted earlier today: ${rec.reason}`
      : rec.reason,
    supportingMetrics: rec.supportingMetrics,
    risks: CATEGORY_RISKS[rec.category] ?? ["Monitor results after any action"],
    expectedOutcome: rec.expectedImpact,
    actualOutcome: rec.actualImpact,
    predictionAccuracy: rec.predictionAccuracy,
    confidenceBreakdown: confidenceExplanation(rec),
    confidenceScore: rec.confidenceScore,
  };
}

export function findRecommendation(
  context: BusinessContext,
  id: string,
): Recommendation | undefined {
  return context.recommendations.find((r) => r.id === id);
}
