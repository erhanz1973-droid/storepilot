import { describe, expect, it } from "vitest";
import { consolidateCampaignActions } from "@/lib/attribution/action-packages";
import type { UnrankedStrategyAction } from "@/lib/attribution/action-priority";
import type { CampaignAttributionRow } from "@/lib/attribution/models";

const campaigns: CampaignAttributionRow[] = [
  {
    campaignId: "camp-1",
    campaignName: "Prospecting Broad",
    channelId: "meta_ads",
    revenue: 5000,
    attributedRevenue: 1808,
    orders: 12,
    adSpend: 34800,
    grossProfit: 1048,
    netProfit: -32000,
    roas: 0.052,
    profitRoas: -0.92,
    breakEvenRoas: 2.1,
    roasGapPct: 98,
    cpa: 2900,
    cac: 2900,
    conversionRate: 0.8,
    ctr: 1.2,
    frequency: 2.4,
    status: "ACTIVE",
    aov: 150,
    impressions: 120000,
    clicks: 960,
  },
];

function action(
  partial: Partial<UnrankedStrategyAction> & Pick<UnrankedStrategyAction, "id" | "title">,
): UnrankedStrategyAction {
  return {
    description: "Test action",
    reason: "Test reason",
    estimatedMonthlyImprovement: 1000,
    confidencePct: 80,
    riskLevel: "Low",
    expectedRevenueImpactPct: -5,
    cashFlowImpact: "Positive",
    ...partial,
  };
}

describe("consolidateCampaignActions", () => {
  it("merges multiple actions on the same campaign into one optimization package", () => {
    const actions = [
      action({
        id: "reduce-prospect-camp-1",
        title: "Reduce Prospecting Broad Budget 25%",
      }),
      action({
        id: "refresh-retarget-camp-1",
        title: "Improve Prospecting Broad Creatives",
      }),
      action({
        id: "pause-adsets-camp-1",
        title: "Pause Worst Prospecting Broad Ad Sets",
      }),
    ];

    const result = consolidateCampaignActions(actions, campaigns);
    expect(result).toHaveLength(1);
    expect(result[0]!.isPackage).toBe(true);
    expect(result[0]!.title).toBe("Prospecting Broad Optimization");
    expect(result[0]!.packageSteps?.length).toBe(3);
    expect(result[0]!.implementationTime).toBe("7–14 days");
  });

  it("keeps standalone actions when only one action targets a campaign", () => {
    const actions = [
      action({
        id: "reduce-prospect-camp-1",
        title: "Reduce Prospecting Broad Budget 25%",
      }),
      action({
        id: "shift-meta-to-google",
        title: "Shift Meta Spend to Google",
      }),
    ];

    const result = consolidateCampaignActions(actions, campaigns);
    expect(result).toHaveLength(2);
    expect(result.every((a) => !a.isPackage)).toBe(true);
  });
});
