import { describe, expect, it } from "vitest";
import { buildApprovalPresentation } from "../presenter";
import { buildDecisionCenterView, buildExecutiveNarrative } from "../decision-center";
import type { ApprovalEnrichedRecommendation } from "../presenter";

function rec(
  partial: Partial<ApprovalEnrichedRecommendation> & Pick<ApprovalEnrichedRecommendation, "id" | "title">,
): ApprovalEnrichedRecommendation {
  return {
    category: "campaign_review",
    severity: "high",
    reason: "ROAS below break-even for 7 consecutive days.",
    expectedImpact: "+$3,715/month",
    confidenceScore: 0.63,
    actionLabel: "Review",
    supportingMetrics: [
      { label: "ROAS", value: "0.61" },
      { label: "Break-even ROAS", value: "1.29" },
      { label: "7d Spend", value: "$1,200" },
      { label: "7d Revenue", value: "$732" },
      { label: "Spend change", value: "+18%" },
      { label: "Purchases", value: "-9%" },
    ],
    entityType: "campaign",
    entityId: partial.id,
    createdAt: new Date().toISOString(),
    approval: {
      recommendationId: partial.id,
      status: "pending",
      updatedAt: new Date().toISOString(),
    },
    ...partial,
  };
}

describe("buildDecisionCenterView", () => {
  it("builds executive briefing with business status and stats", () => {
    const items = [
      rec({
        id: "r1",
        title: "Campaign: Reduce Prospecting spend",
        severity: "high",
      }),
      rec({ id: "r2", title: "Campaign: Pause retargeting", severity: "medium" }),
    ];
    const presentation = buildApprovalPresentation(items, {
      campaigns: [],
      netMarginPct: 22,
    });
    const view = buildDecisionCenterView(presentation, items, null);

    expect(view.briefing.topOpportunityTitle).toBeTruthy();
    expect(view.briefing.urgentDecisions).toBeGreaterThanOrEqual(1);
    expect(view.briefing.narrative).toContain("StorePilot analyzed");
    expect(view.primaryDecision).not.toBeNull();
    expect(view.primaryDecision?.whyItMatters).toContain("Without intervention");
    expect(view.primaryDecision?.evidence.length).toBeGreaterThan(0);
  });

  it("builds executive narrative with impact and confidence", () => {
    const items = [rec({ id: "r1", title: "Campaign: Reduce spend" })];
    const presentation = buildApprovalPresentation(items, { campaigns: [] });
    const { narrative } = buildExecutiveNarrative(presentation);

    expect(narrative).toContain("high-impact decision");
    expect(narrative).toContain("monthly net profit");
    expect(narrative).toContain("confidence");
  });

  it("includes forecast scenario on decision memo", () => {
    const items = [rec({ id: "r1", title: "Campaign: Reduce Prospecting" })];
    const presentation = buildApprovalPresentation(items, { campaigns: [] });
    const view = buildDecisionCenterView(presentation, items, null);

    expect(view.primaryDecision?.forecast.estimatedProfit).toBeGreaterThan(0);
    expect(view.primaryDecision?.forecast.confidencePct).toBe(63);
  });
});
