import { describe, expect, it } from "vitest";
import {
  resolveCampaignBudgetCents,
  rollupAdSetsForCampaign,
} from "@/lib/meta/ad-set-rollup";

describe("rollupAdSetsForCampaign", () => {
  it("uses active ad set budget instead of paused ad set max", () => {
    const rollup = rollupAdSetsForCampaign([
      {
        id: "1",
        campaign_id: "c1",
        effective_status: "PAUSED",
        daily_budget: "500",
        start_time: "2026-06-01T00:00:00.000Z",
        end_time: "2026-06-12T00:00:00.000Z",
      },
      {
        id: "2",
        campaign_id: "c1",
        effective_status: "ACTIVE",
        daily_budget: "200",
        destination_type: "MESSENGER",
        optimization_goal: "CONVERSATIONS",
        start_time: "2026-06-01T00:00:00.000Z",
        end_time: "2026-06-17T00:00:00.000Z",
      },
    ]);

    expect(rollup?.dailyBudgetCents).toBe(200);
    expect(rollup?.destinationType).toBe("MESSENGER");
    expect(rollup?.endTime).toBe("2026-06-17T00:00:00.000Z");
  });

  it("prefers ad set schedule over mixed campaign dates", () => {
    const rollup = rollupAdSetsForCampaign([
      {
        id: "1",
        campaign_id: "c1",
        effective_status: "ACTIVE",
        daily_budget: "200",
        start_time: "2026-06-10T00:00:00.000Z",
        end_time: "2026-06-26T00:00:00.000Z",
      },
    ]);

    expect(rollup?.startTime).toBe("2026-06-10T00:00:00.000Z");
    expect(rollup?.endTime).toBe("2026-06-26T00:00:00.000Z");
  });
});

describe("resolveCampaignBudgetCents", () => {
  it("prefers ad set daily budget over campaign daily budget", () => {
    const resolved = resolveCampaignBudgetCents({
      campaignDailyCents: 500,
      adSetRollup: { dailyBudgetCents: 200 },
    });

    expect(resolved.dailyBudgetCents).toBe(200);
  });

  it("falls back to campaign budget when ad set has no daily budget", () => {
    const resolved = resolveCampaignBudgetCents({
      campaignDailyCents: 500,
      adSetRollup: {},
    });

    expect(resolved.dailyBudgetCents).toBe(500);
  });
});
