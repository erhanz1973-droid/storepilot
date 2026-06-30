import { describe, expect, it } from "vitest";
import { evaluateCampaignGoalAware } from "@/lib/recommendations/goal-aware-evaluation";
import type { StoreBusinessGoals } from "@/lib/business-goals/types";

const baseCampaign = {
  id: "act_1:1",
  name: "Awareness Push",
  effectiveStatus: "ACTIVE" as const,
  metaEffectiveStatus: "ACTIVE",
  status: "ACTIVE" as const,
  objective: "BRAND_AWARENESS",
  spend7d: 120,
  impressions7d: 28000,
  reach7d: 14000,
  revenue7d: 0,
  roas7d: 0,
  ctr7d: 1.2,
  frequency7d: 2.1,
};

function goals(primary: StoreBusinessGoals["primaryGoal"], list?: StoreBusinessGoals["goals"]) {
  return {
    storeId: "store-1",
    primaryGoal: primary,
    goals: list ?? [primary],
  };
}

describe("evaluateCampaignGoalAware", () => {
  it("continues brand awareness campaigns when business goal is build brand awareness", () => {
    const result = evaluateCampaignGoalAware(baseCampaign, {
      businessGoals: goals("build_brand_awareness"),
    });
    expect(result.verdict).toBe("continue");
    expect(result.shouldEmitRecommendation).toBe(false);
    expect(result.why).toContain("Continue running");
    expect(result.why).not.toContain("Pause");
  });

  it("recommends pause for low ROAS sales when business goal is increase profit", () => {
    const result = evaluateCampaignGoalAware(
      {
        ...baseCampaign,
        name: "Sales Retargeting",
        objective: "OUTCOME_SALES",
        spend7d: 400,
        revenue7d: 320,
        roas7d: 0.8,
        impressions7d: 12000,
      },
      { businessGoals: goals("increase_profit") },
    );
    expect(result.verdict).toBe("pause_consider");
    expect(result.shouldEmitRecommendation).toBe(true);
    expect(result.why).toContain("Increase Profit");
    expect(result.financialImpact.estimatedMonthlyCostSavings).toBeGreaterThan(0);
  });

  it("continues low ROAS campaigns when business goal is launch new product", () => {
    const result = evaluateCampaignGoalAware(
      {
        ...baseCampaign,
        objective: "OUTCOME_TRAFFIC",
        spend7d: 200,
        impressions7d: 18000,
        reach7d: 9000,
        revenue7d: 50,
        roas7d: 0.25,
      },
      { businessGoals: goals("launch_new_product") },
    );
    expect(result.verdict).toBe("continue");
    expect(result.shouldEmitRecommendation).toBe(false);
    expect(result.why).toContain("Launch New Product");
  });

  it("continues low ROAS sales when business goal is clear inventory and stock is high", () => {
    const result = evaluateCampaignGoalAware(
      {
        ...baseCampaign,
        name: "Clearance Ads",
        objective: "OUTCOME_SALES",
        spend7d: 300,
        revenue7d: 240,
        roas7d: 0.8,
        impressions7d: 10000,
      },
      {
        businessGoals: goals("clear_inventory"),
        inventoryPressure: "high",
      },
    );
    expect(result.verdict).toBe("continue");
    expect(result.shouldEmitRecommendation).toBe(false);
    expect(result.why).toContain("Clear Inventory");
  });

  it("includes financial impact with dollar amounts for measurable recommendations", () => {
    const result = evaluateCampaignGoalAware(
      {
        ...baseCampaign,
        name: "Bleeding Sales",
        objective: "OUTCOME_SALES",
        spend7d: 500,
        revenue7d: 200,
        roas7d: 0.4,
        impressions7d: 15000,
      },
      { businessGoals: goals("increase_profit"), profitMarginPct: 40 },
    );
    expect(result.shouldEmitRecommendation).toBe(true);
    expect(result.financialImpact.summary).toMatch(/\$/);
    expect(result.financialImpact.confidence).toBeGreaterThan(0.7);
  });
});
