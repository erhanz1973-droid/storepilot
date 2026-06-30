import { describe, expect, it } from "vitest";
import { DEMO_STORE_SNAPSHOT } from "@/lib/connectors/demo-data";
import { evaluateCampaignRecovery } from "@/lib/analytics/campaign-recovery-engine";
import { buildMarketingManagerView } from "@/lib/analytics/marketing-manager";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { PEAK_OUTFITTERS_WORST_CAMPAIGN } from "@/lib/demo/peak-outfitters/meta-campaigns";

describe("campaign recovery engine", () => {
  it("does not recommend pause for young or learning campaigns", () => {
    const youngCampaign = {
      id: "new-camp",
      channel: "meta" as const,
      campaign: "New Launch Test",
      status: "ACTIVE",
      spend: 320,
      impressions: 12000,
      reach: 8000,
      clicks: 180,
      ctr: 1.5,
      cpc: 1.78,
      cpm: 26,
      purchases: 3,
      cpa: 106,
      revenue: 240,
      roas: 0.75,
      profit: -80,
      margin: -33,
    };

    const result = evaluateCampaignRecovery({
      row: youngCampaign,
      health: "losing_money",
      profitMeta: { value: -80, status: "estimated", confidencePct: 70, missingReasons: [] },
      snapshot: {
        ...DEMO_STORE_SNAPSHOT,
        campaigns: [
          {
            ...PEAK_OUTFITTERS_WORST_CAMPAIGN,
            id: "new-camp",
            name: "New Launch Test",
            startTime: new Date(Date.now() - 3 * 86_400_000).toISOString(),
            spend7d: 320,
            roas7d: 0.75,
            conversions7d: 3,
          },
        ],
      },
    });

    expect(result.recommendation).not.toBe("pause_campaign");
    expect(result.isLearningPhase).toBe(true);
    expect(result.recommendation).toBe("continue_learning");
  });

  it("recommends optimize before pause for underperforming mature campaigns", () => {
    const result = evaluateCampaignRecovery({
      row: {
        id: "po-meta-spring-collection",
        channel: "meta",
        campaign: "Spring Collection Launch",
        status: "ACTIVE",
        spend: 890,
        impressions: 52000,
        reach: 22000,
        clicks: 728,
        ctr: 1.4,
        cpc: 1.22,
        cpm: 17,
        purchases: 12,
        cpa: 74,
        revenue: 1200,
        roas: 1.35,
        profit: -120,
        margin: -10,
      },
      health: "needs_attention",
      profitMeta: { value: -120, status: "estimated", confidencePct: 75, missingReasons: [] },
      snapshot: DEMO_STORE_SNAPSHOT,
    });

    expect(result.recommendation).toBe("optimize_campaign");
    expect(result.recoveryProbabilityPct).toBeGreaterThan(15);
    expect(result.recoveryLadder.length).toBeGreaterThan(0);
    expect(result.recommendationReason).toContain("optimize");
  });

  it("recommends pause only after recovery paths are exhausted", () => {
    const result = evaluateCampaignRecovery({
      row: {
        id: PEAK_OUTFITTERS_WORST_CAMPAIGN.id,
        channel: "meta",
        campaign: PEAK_OUTFITTERS_WORST_CAMPAIGN.name,
        status: "ACTIVE",
        spend: PEAK_OUTFITTERS_WORST_CAMPAIGN.spend7d,
        impressions: PEAK_OUTFITTERS_WORST_CAMPAIGN.impressions7d,
        reach: 30000,
        clicks: 893,
        ctr: PEAK_OUTFITTERS_WORST_CAMPAIGN.ctr7d,
        cpc: 2.25,
        cpm: 16,
        purchases: 8,
        cpa: 251,
        revenue: PEAK_OUTFITTERS_WORST_CAMPAIGN.revenue7d,
        roas: PEAK_OUTFITTERS_WORST_CAMPAIGN.roas7d,
        profit: -1680,
        margin: -144,
      },
      health: "losing_money",
      profitMeta: { value: -1680, status: "estimated", confidencePct: 75, missingReasons: [] },
      snapshot: DEMO_STORE_SNAPSHOT,
    });

    expect(result.recommendation).toBe("pause_campaign");
    expect(result.recoveryProbabilityPct).toBeLessThan(15);
    expect(result.recommendationReason).toContain("Recovery probability");
  });

  it("includes recovery probability on enriched campaigns", () => {
    const view = buildMarketingManagerView({
      snapshot: DEMO_STORE_SNAPSHOT,
      profitDashboard: computeProfitDashboard(DEMO_STORE_SNAPSHOT, []),
    });

    const losing = view.campaigns.filter((c) => c.health === "losing_money");
    expect(losing.length).toBeGreaterThan(0);

    const pauseCount = losing.filter((c) => c.recommendation === "pause_campaign").length;
    const optimizeCount = losing.filter(
      (c) =>
        c.recommendation === "optimize_campaign" ||
        c.recommendation === "improve_creative" ||
        c.recommendation === "continue_learning",
    ).length;

    expect(optimizeCount).toBeGreaterThanOrEqual(pauseCount);
    for (const c of view.campaigns) {
      expect(c.recoveryProbabilityPct).toBeGreaterThanOrEqual(5);
      expect(c.recoveryProbabilityPct).toBeLessThanOrEqual(95);
      expect(c.recoveryLadder.length).toBe(6);
    }
  });
});
