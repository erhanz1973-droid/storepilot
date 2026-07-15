import { describe, expect, it } from "vitest";
import { calculateBusinessKPIs } from "@/lib/calculations/kpis/engine";
import { emptyRawFacts } from "@/lib/calculations/facts/types";
import {
  calculateDecisionImpactFromInputs,
  buildDecisionImpactPresentation,
  DECISION_IMPACT_COPY,
} from "@/lib/calculations/impact/engine";

const CAMPAIGN_LABEL =
  "If accepted, estimated cost savings ~$6,168–$11,102/mo (~$636/mo profit preserved).";

describe("impact engine", () => {
  const kpis = calculateBusinessKPIs(
    emptyRawFacts({
      commerce: {
        revenue: 50_000,
        orders: 400,
        refunds: 500,
        discounts: 0,
        taxes: null,
        shippingCost: 1200,
        shippingRevenue: 0,
        cogs: 20_000,
        platformFees: 800,
        sessions: 12_000,
        customers: 350,
        inventoryUnits: null,
        inventoryValue: null,
      },
      advertising: {
        adSpend: 8000,
        impressions: 100_000,
        clicks: 5000,
        purchases: 200,
        attributedRevenue: 25_000,
      },
    }),
  );

  it("produces consistent executive and approval metrics from one label", () => {
    const impact = calculateDecisionImpactFromInputs(
      {
        expectedImpactLabel: CAMPAIGN_LABEL,
        category: "campaign_review",
        confidenceScore: 0.92,
      },
      kpis,
    );
    const presentation = buildDecisionImpactPresentation(impact);

    expect(impact.businessRecovery).toBe(6168);
    expect(impact.netProfitImpact).toBe(636);
    expect(presentation.heroLabel).toBe(DECISION_IMPACT_COPY.heroLabel);
    expect(presentation.heroAmount).toBe(6168);
    expect(presentation.netProfitAmount).toBe(636);
    expect(presentation.confidencePct).toBe(92);
    expect(presentation.waterfall).toHaveLength(3);
  });

  it("exposes extended DecisionImpact fields", () => {
    const impact = calculateDecisionImpactFromInputs(
      { expectedImpactLabel: CAMPAIGN_LABEL, category: "campaign_review" },
      kpis,
    );
    expect(impact.recoverableWaste).toBe(6168);
    expect(impact.cashFlowImpact).toBeGreaterThan(0);
    expect(impact.advertisingSavings).toBe(Math.round((6168 + 11102) / 2));
  });
});
