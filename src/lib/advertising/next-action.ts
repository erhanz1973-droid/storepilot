import type { CampaignRecommendationKind } from "@/lib/analytics/marketing-recommendations";
import type { AdvertisingCampaignRow } from "./types";

export function deriveBriefRecommendation(
  recommendation: CampaignRecommendationKind,
): string {
  switch (recommendation) {
    case "pause_campaign":
    case "reduce_budget":
      return "Reduce targeting or pause.";
    case "healthy":
    case "continue_learning":
      return "Continue running.";
    case "scale":
    case "increase_budget":
      return "Scale cautiously using the detailed optimization workspace.";
    case "improve_creative":
      return "Refresh creatives.";
    case "review_audience":
      return "Review audience targeting.";
    case "optimize_campaign":
      return "Optimize campaign structure.";
    case "landing_page_issue":
      return "Fix landing page conversion.";
    default:
      return "Monitor performance.";
  }
}

export function deriveNextAction(campaign: AdvertisingCampaignRow): string {
  switch (campaign.recommendation) {
    case "pause_campaign":
      return "Pause campaign";
    case "reduce_budget":
      return "Reduce budget 20%";
    case "increase_budget":
    case "scale":
      return "Increase budget 20%";
    case "improve_creative":
      return "Replace weak creatives";
    case "review_audience":
      return "Pause 2 ad sets";
    case "optimize_campaign":
      return "Optimize targeting";
    case "landing_page_issue":
      return "Fix landing page";
    case "continue_learning":
      return "Monitor learning phase";
    case "healthy":
      return "Maintain current spend";
    default:
      return campaign.recommendationLabel;
  }
}

export function deriveAiScore(campaign: AdvertisingCampaignRow): number {
  const healthWeight = 0.55;
  const oppWeight = 0.25;
  const roasWeight = 0.2;
  const roasScore = Math.min(100, campaign.roas * 25);
  const oppScore = Math.min(100, campaign.expectedOpportunityMonthly / 50);
  return Math.round(
    campaign.healthScore * healthWeight +
      oppScore * oppWeight +
      roasScore * roasWeight,
  );
}
