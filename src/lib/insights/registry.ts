import type { CommerceOpportunity } from "./opportunity-schema";

/** Catalog of all insight detectors across sources (Phase 1) */
export const INSIGHT_DETECTOR_CATALOG = {
  google_ads: [
    "Campaign spending with zero conversions",
    "CPA above account average",
    "ROAS below target",
    "Budget limited campaigns",
    "Advertising efficiency decline (rising acquisition costs)",
    "Conversion decline",
    "Campaigns ready to scale",
    "Search vs Shopping comparison",
    "Branded vs Non-branded performance",
    "Weekend vs Weekday performance",
    "Cross-channel Google vs Meta efficiency",
    "Blended ROAS below target",
  ],
  meta_ads: [
    "Audience saturation",
    "Creative fatigue",
    "Customer acquisition efficiency decline",
    "Rising advertising costs with declining efficiency",
    "High spend with low purchases",
    "Winning creatives",
    "Best audiences",
    "Prospecting vs Retargeting efficiency",
    "Learning Limited campaigns",
    "Budget saturation",
    "ROAS below target",
    "CPA above account average",
  ],
  shopify: [
    "Low inventory bestseller",
    "Dead inventory",
    "High margin products receiving little traffic",
    "Products with high cart abandonment",
    "Products with declining sales trend",
    "Fast-growing products",
    "Frequently bought together opportunities",
    "Collections with low conversion",
    "Returning customer opportunities",
    "Net margin under pressure",
  ],
  ga4: ["Low-converting landing pages", "Mobile vs desktop conversion gap", "UTM channel efficiency"],
  klaviyo: ["Underperforming email flows", "List growth opportunities"],
  merchant_center: ["Disapproved products", "Feed quality issues"],
} as const;

export function hasValidEvidence(opp: CommerceOpportunity): boolean {
  if (opp.supportingMetrics.length === 0) return false;
  const onlyPlaceholder = opp.supportingMetrics.every(
    (m) => m.label === "Data" && m.value.includes("Insufficient"),
  );
  return !onlyPlaceholder;
}

export function filterOpportunitiesWithEvidence(
  opportunities: CommerceOpportunity[],
): CommerceOpportunity[] {
  return opportunities.filter(hasValidEvidence);
}
