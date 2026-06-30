export type CampaignRecommendationKind =
  | "pause_campaign"
  | "increase_budget"
  | "reduce_budget"
  | "optimize_campaign"
  | "continue_learning"
  | "review_audience"
  | "improve_creative"
  | "landing_page_issue"
  | "healthy"
  | "scale";

export const RECOMMENDATION_LABELS: Record<CampaignRecommendationKind, string> = {
  pause_campaign: "Pause Campaign",
  increase_budget: "Increase Budget",
  reduce_budget: "Reduce Budget",
  optimize_campaign: "Optimize Campaign",
  continue_learning: "Continue Learning",
  review_audience: "Review Audience",
  improve_creative: "Improve Creative",
  landing_page_issue: "Landing Page Issue",
  healthy: "Healthy",
  scale: "Scale",
};
