import { describe, expect, it } from "vitest";
import {
  validateChannelBudgetRecommendation,
  validateOptimizationPackage,
} from "../recommendation-validation";
import type { MarketingPlatformSummary } from "@/lib/analytics/marketing-manager";
import type { OptimizationPackage } from "@/lib/advertising/types";

function platform(partial: Partial<MarketingPlatformSummary> & { channel: "meta" | "google" }): MarketingPlatformSummary {
  return {
    label: partial.channel === "meta" ? "Meta Ads" : "Google Ads",
    connected: true,
    spend: 1000,
    revenue: 3000,
    roas: 3,
    profit: 500,
    profitMeta: { value: 500, status: "verified", confidencePct: 90, missingReasons: [] },
    businessStatus: "profitable",
    businessStatusLabel: "Profitable",
    aiSummary: "",
    recoverableProfitMonthly: 0,
    score: 70,
    scoreExplanation: [],
    ...partial,
  };
}

describe("validateChannelBudgetRecommendation", () => {
  it("warns when shifting to unprofitable Google while Meta is profitable", () => {
    const result = validateChannelBudgetRecommendation({
      meta: platform({ channel: "meta", profit: 8000, roas: 2.78 }),
      google: platform({ channel: "google", profit: -209, roas: 5.2 }),
      rawRecommendation: "Shift approximately 35% of budget from Meta to Google until Meta profitability improves.",
      shiftPct: 35,
    });
    expect(result.text).toMatch(/negative after product costs/i);
    expect(result.issues[0]?.code).toBe("channel_shift_unprofitable_target");
  });

  it("passes consistent shift recommendation", () => {
    const result = validateChannelBudgetRecommendation({
      meta: platform({ channel: "meta", profit: -500, roas: 0.9 }),
      google: platform({ channel: "google", profit: 1200, roas: 4.1 }),
      rawRecommendation: "Shift approximately 20% of budget from Meta to Google until Meta profitability improves.",
      shiftPct: 20,
    });
    expect(result.text).toContain("Shift approximately 20%");
    expect(result.issues).toHaveLength(0);
  });
});

describe("validateOptimizationPackage", () => {
  it("reframes scale package on losing campaign", () => {
    const pkg: OptimizationPackage = {
      id: "pkg-1",
      rank: 1,
      campaignId: "c1",
      campaignName: "Prospecting Broad",
      title: "Prospecting Broad Optimization",
      steps: ["Increase Budget", "Refresh Creatives"],
      expectedProfitMonthly: 500,
      confidencePct: 80,
      risk: "Medium",
      estimatedTime: "7 days",
      rollbackAvailable: true,
      approvalStatus: "pending",
    };
    const adjusted = validateOptimizationPackage(pkg, {
      id: "c1",
      campaign: "Prospecting Broad",
      profit: -400,
      roas: 0.7,
    } as never);
    expect(adjusted.title).toMatch(/stabilize before scaling/i);
    expect(adjusted.steps[0]).toMatch(/product costs/i);
  });
});
