import { parseRevenueImpact } from "@/lib/approvals/revenue";
import type { Recommendation } from "@/lib/types";

const MIN_CONFIDENCE = 0.5;

export function recommendationHasDeliveryData(rec: Recommendation): boolean {
  if (rec.category !== "campaign_review") return true;

  const spend = rec.supportingMetrics.find((m) =>
    m.label.toLowerCase().includes("spend"),
  );
  const revenue = rec.supportingMetrics.find((m) =>
    m.label.toLowerCase().includes("revenue"),
  );

  const spendVal = spend ? Number(spend.value.replace(/[$,]/g, "")) : 0;
  const revenueVal = revenue ? Number(revenue.value.replace(/[$,]/g, "")) : 0;
  return spendVal > 0 && revenueVal > 0;
}

export function isActionableRecommendation(rec: Recommendation): boolean {
  if (parseRevenueImpact(rec.expectedImpact) <= 0) return false;
  if (rec.confidenceScore < MIN_CONFIDENCE) return false;
  if (!recommendationHasDeliveryData(rec)) return false;
  return true;
}

export function filterActionableRecommendations<T extends Recommendation>(
  items: T[],
): T[] {
  return items.filter(isActionableRecommendation);
}

export const INSUFFICIENT_DATA_MESSAGE = "Not enough data to evaluate.";
