import type { AttributionDashboard } from "@/lib/attribution/models";
import type { BudgetRecommendation } from "./types";

export function buildBudgetRecommendations(
  attribution: AttributionDashboard | null,
): BudgetRecommendation[] {
  if (!attribution) return [];

  const results: BudgetRecommendation[] = [];

  for (const opp of attribution.attributionOpportunities.slice(0, 4)) {
    const action =
      opp.adEfficiencyAction === "pause_campaign"
        ? "pause_campaign"
        : opp.adEfficiencyAction === "increase_budget"
          ? "increase_budget"
          : opp.adEfficiencyAction === "reduce_budget"
            ? "reduce_budget"
            : "shift_budget";

    results.push({
      id: `budget-${opp.id}`,
      action: action as BudgetRecommendation["action"],
      target: opp.title.replace(/^(Increase|Reduce|Pause|Duplicate|Refresh|Shift).*—\s*/i, ""),
      expectedNetProfitGain: opp.estimatedMonthlyNetProfitImpact,
      confidenceScore: opp.confidenceScore,
      reasoning: opp.description,
    });
  }

  const winner = attribution.winningCreatives[0];
  if (winner) {
    results.push({
      id: `budget-dup-${winner.creativeId}`,
      action: "duplicate_winner",
      target: winner.creativeName,
      expectedNetProfitGain: Math.round(winner.profit * 4),
      confidenceScore: 0.78,
      reasoning: `Winning creative ROAS ${winner.roas?.toFixed(2)} — duplicate to scale profit.`,
    });
  }

  const worst = attribution.worstCampaigns[0];
  const best = attribution.bestCampaigns[0];
  if (worst && best && worst.netProfit < 0) {
    results.push({
      id: "budget-shift-campaigns",
      action: "shift_budget",
      target: `${worst.campaignName} → ${best.campaignName}`,
      fromChannel: worst.campaignName,
      toChannel: best.campaignName,
      expectedNetProfitGain: Math.round((best.netProfit - worst.netProfit) * 0.2),
      confidenceScore: 0.75,
      reasoning: "Shift spend from negative net profit campaign to top performer.",
    });
  }

  return results.sort((a, b) => b.expectedNetProfitGain - a.expectedNetProfitGain).slice(0, 6);
}
