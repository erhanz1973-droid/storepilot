import type { AccountWideSummary, AdvertisingCampaignRow } from "./types";

export function buildAccountWideSummary(campaigns: AdvertisingCampaignRow[]): AccountWideSummary {
  const healthy = campaigns.filter(
    (c) => c.healthTier === "excellent" || c.healthTier === "healthy",
  ).length;
  const needAttention = campaigns.filter(
    (c) => c.healthTier === "needs_review" || c.healthTier === "weak",
  ).length;
  const critical = campaigns.filter((c) => c.healthTier === "critical").length;
  const improving = campaigns.filter((c) => c.trend === "up").length;

  const byOpportunity = [...campaigns].sort(
    (a, b) => b.expectedOpportunityMonthly - a.expectedOpportunityMonthly || b.aiScore - a.aiScore,
  );
  const byRisk = [...campaigns].sort(
    (a, b) => a.profit - b.profit || a.healthScore - b.healthScore,
  );

  const largestOpportunity = byOpportunity[0];
  const largestRisk = byRisk.find((c) => c.profit < 0 || c.healthTier === "critical") ?? byRisk[0];

  return {
    totalCampaigns: campaigns.length,
    healthy,
    needAttention,
    critical,
    improving,
    largestOpportunity: largestOpportunity
      ? {
          id: largestOpportunity.id,
          name: largestOpportunity.campaign,
          impactMonthly: largestOpportunity.expectedOpportunityMonthly,
        }
      : null,
    largestRisk: largestRisk
      ? { id: largestRisk.id, name: largestRisk.campaign }
      : null,
    headline: `We analyzed all ${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}.`,
  };
}

export function assignCampaignPriorityRanks(campaigns: AdvertisingCampaignRow[]): AdvertisingCampaignRow[] {
  const sorted = [...campaigns].sort((a, b) => b.aiScore - a.aiScore || b.profit - a.profit);
  const rankById = new Map(sorted.map((c, i) => [c.id, i + 1]));
  return campaigns.map((c) => ({
    ...c,
    priorityRank: rankById.get(c.id) ?? campaigns.length,
  }));
}
