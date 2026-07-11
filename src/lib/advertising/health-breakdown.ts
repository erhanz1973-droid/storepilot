import type { AdvertisingHealthFactor, AdvertisingWorkspaceView } from "./types";
import { healthTierFromScore } from "./health-score";

export function buildAdvertisingHealthFactors(
  workspace: Pick<
    AdvertisingWorkspaceView,
    "campaigns" | "creatives" | "audiences" | "budgetAllocation" | "platforms"
  >,
): AdvertisingHealthFactor[] {
  const pool = workspace.campaigns;

  const campaignQuality =
    pool.length > 0
      ? Math.round(pool.reduce((s, c) => s + c.healthScore, 0) / pool.length)
      : 50;

  const creativeHealth =
    workspace.creatives.length > 0
      ? Math.round(
          workspace.creatives.reduce((s, c) => s + c.creativeScore, 0) /
            workspace.creatives.length,
        )
      : 54;

  const audienceQuality =
    workspace.audiences.length > 0
      ? Math.round(
          workspace.audiences.reduce((s, a) => s + a.healthScore, 0) /
            workspace.audiences.length,
        )
      : 60;

  const connectedPlatforms = workspace.platforms.filter((p) => p.connected && p.spend > 0);
  const budgetAllocation =
    connectedPlatforms.length >= 2
      ? Math.round(
          connectedPlatforms.reduce((s, p) => s + (p.healthScore ?? 50), 0) /
            connectedPlatforms.length,
        )
      : 50;

  const tracking = workspace.platforms.some((p) => p.connected) ? 100 : 40;

  return [
    { id: "campaign_quality", label: "Campaign Quality", score: campaignQuality, tier: healthTierFromScore(campaignQuality) },
    { id: "creative_health", label: "Creative Health", score: creativeHealth, tier: healthTierFromScore(creativeHealth) },
    { id: "audience_quality", label: "Audience Quality", score: audienceQuality, tier: healthTierFromScore(audienceQuality) },
    { id: "budget_allocation", label: "Budget Allocation", score: budgetAllocation, tier: healthTierFromScore(budgetAllocation) },
    { id: "tracking", label: "Tracking", score: tracking, tier: healthTierFromScore(tracking) },
  ];
}
