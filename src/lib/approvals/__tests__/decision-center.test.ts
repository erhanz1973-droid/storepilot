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
    status: "pending",
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

const mockDataSources = [
  { id: "shopify" as const, label: "Shopify", status: "connected" as const },
  { id: "meta_ads" as const, label: "Meta Ads", status: "connected" as const },
  { id: "google_ads" as const, label: "Google Ads", status: "disconnected" as const },
  { id: "ga4" as const, label: "GA4", status: "disconnected" as const },
];

describe("buildDecisionCenterView", () => {
  it("builds executive briefing with business status and stats", () => {
    const items = [
      rec({
        id: "r1",
        title: "Pause campaign — Prospecting",
        severity: "high",
      }),
      rec({ id: "r2", title: "Reduce budget — Retargeting", severity: "medium" }),
    ];
    const presentation = buildApprovalPresentation(items, {
      campaigns: [],
      netMarginPct: 22,
    });
    const view = buildDecisionCenterView(presentation, items, null, {
      dataSources: mockDataSources,
    });

    expect(view.briefing.topOpportunityTitle).toBeTruthy();
    expect(view.briefing.urgentDecisions).toBeGreaterThanOrEqual(1);
    expect(view.briefing.narrative).toContain("StorePilot analyzed");
    expect(view.briefing.executiveSummary).not.toBeNull();
    expect(view.primaryDecision).not.toBeNull();
    expect(view.primaryDecision?.whyItMatters).toContain("Without intervention");
    expect(view.primaryDecision?.evidence.length).toBeGreaterThan(0);
  });

  it("builds executive narrative with impact and confidence", () => {
    const items = [rec({ id: "r1", title: "Reduce budget — Prospecting" })];
    const presentation = buildApprovalPresentation(items, { campaigns: [] });
    const { narrative } = buildExecutiveNarrative(presentation);

    expect(narrative).toContain("high-impact decision");
    expect(narrative).toContain("monthly net profit");
    expect(narrative).toContain("confidence");
  });

  it("includes forecast scenario and decision details on decision memo", () => {
    const items = [rec({ id: "r1", title: "Reduce budget — Prospecting" })];
    const presentation = buildApprovalPresentation(items, { campaigns: [] });
    const view = buildDecisionCenterView(presentation, items, null, {
      dataSources: mockDataSources,
    });

    const memo = view.primaryDecision;
    expect(memo?.forecast.estimatedProfit).toBeGreaterThan(0);
    expect(memo?.forecast.confidencePct).toBe(63);
    expect(memo?.decisionDetails.platform).toBeTruthy();
    expect(memo?.decisionDetails.businessGoal).toBe("Increase Profit");
    expect(memo?.decisionDetails.expectedImpactMonthly).toBeGreaterThan(0);
    expect(memo?.confidenceBreakdown.availableSignals.length).toBeGreaterThan(0);
    expect(memo?.confidenceBreakdown.missingSignals).toContain("Google Ads");
    expect(memo?.confidenceBreakdown.qualitativeLabel).toBe("Moderate Confidence");
    expect(memo?.confidenceBreakdown.reducedBecause).toContain("Google Ads not connected");
    expect(memo?.actionPlan.length).toBeGreaterThan(0);
    expect(memo?.approvalPreview.items.length).toBeGreaterThan(0);
    expect(memo?.approvalPreview.items.some((i) => i.includes("Rollback available"))).toBe(true);
    expect(memo?.expectedKpis.length).toBeGreaterThan(0);
    expect(memo?.timeline.length).toBe(7);
    expect(memo?.timeline[0].label).toBe("AI collected campaign data");
    expect(memo?.timeline.some((t) => t.label === "Impact monitoring")).toBe(true);
    expect(memo?.aiReasoning.signals.length).toBeGreaterThan(0);
    expect(memo?.riskAnalysis.quantifiedRisks.length).toBeGreaterThan(0);
    expect(memo?.riskAnalysis.quantifiedRisks[0].estimate).toBeTruthy();
    expect(memo?.riskAnalysis.mitigations.length).toBeGreaterThan(0);
    expect(memo?.explainNarrative.paragraphs.length).toBeGreaterThan(1);
    expect(memo?.explainNarrative.signalCount).toBeGreaterThan(0);
    expect(memo?.businessContext.selectedStrategyReason).toContain("highest expected profit");
  });

  it("builds campaign evidence rows for campaign portfolio", () => {
    const items = [
      rec({ id: "r1", title: "Pause campaign — Summer Sale" }),
      rec({ id: "r2", title: "Reduce budget — Advantage+" }),
    ];
    const presentation = buildApprovalPresentation(items, { campaigns: [] });
    const view = buildDecisionCenterView(presentation, items, null);

    expect(view.primaryDecision?.campaignEvidence.length).toBeGreaterThan(0);
    expect(view.primaryDecision?.campaignEvidence[0].campaign).toContain("Summer");
    expect(view.primaryDecision?.campaignEvidence[0].status).toBeTruthy();
  });

  it("marks track record as insufficient when there are no successful outcomes", () => {
    const items = [rec({ id: "r1", title: "Pause campaign — Prospecting" })];
    const presentation = buildApprovalPresentation(items, { campaigns: [] });
    const view = buildDecisionCenterView(presentation, items, null, {
      dataSources: mockDataSources,
      intelligence: {
        generated: 4,
        approvedPct: 100,
        rejectedPct: 0,
        executionRatePct: 0,
        successRatePct: 0,
        revenueRecovered: 0,
        revenueGenerated: 7368,
        costSaved: 0,
        avgConfidence: 62,
        avgValidationScore: 70,
        topPerforming: [],
        worstPerforming: [],
        recentTimeline: [],
      },
    });

    expect(view.trackRecord?.hasSufficientData).toBe(false);
    // No contradictory stats: zero success means zero profit claims.
    expect(view.trackRecord?.avgMonthlyProfitIncrease).toBe(0);
    expect(view.trackRecord?.falsePositivePct).toBe(0);
  });

  it("shows consistent track record stats when data is sufficient", () => {
    const items = [rec({ id: "r1", title: "Pause campaign — Prospecting" })];
    const presentation = buildApprovalPresentation(items, { campaigns: [] });
    const view = buildDecisionCenterView(presentation, items, null, {
      dataSources: mockDataSources,
      intelligence: {
        generated: 10,
        approvedPct: 80,
        rejectedPct: 20,
        executionRatePct: 75,
        successRatePct: 75,
        revenueRecovered: 4200,
        revenueGenerated: 6800,
        costSaved: 900,
        avgConfidence: 71,
        avgValidationScore: 78,
        topPerforming: [],
        worstPerforming: [],
        recentTimeline: [],
      },
    });

    const record = view.trackRecord;
    expect(record?.hasSufficientData).toBe(true);
    expect(record?.successful).toBeLessThanOrEqual(record?.approvedDecisions ?? 0);
    expect((record?.successRatePct ?? 0) + (record?.falsePositivePct ?? 0)).toBeLessThanOrEqual(100);
    expect(record?.avgMonthlyProfitIncrease).toBeGreaterThan(0);
  });

  it("builds similar decisions only from measured outcomes and hides otherwise", () => {
    const pendingOnly = [rec({ id: "r1", title: "Pause campaign — Prospecting" })];
    const presentation = buildApprovalPresentation(pendingOnly, { campaigns: [] });
    const view = buildDecisionCenterView(presentation, pendingOnly, null);
    expect(view.similarDecisions).toHaveLength(0);

    const withMeasured = [
      rec({ id: "r1", title: "Pause campaign — Prospecting" }),
      rec({
        id: "r2",
        title: "Reduced Meta budget",
        actualImpact: "+$1,102/month",
        measuredAt: "2026-03-14T10:00:00.000Z",
        approval: {
          recommendationId: "r2",
          status: "measured",
          updatedAt: new Date().toISOString(),
        },
      }),
    ];
    const presentation2 = buildApprovalPresentation(withMeasured, { campaigns: [] });
    const view2 = buildDecisionCenterView(presentation2, withMeasured, null);
    expect(view2.similarDecisions.length).toBe(1);
    expect(view2.similarDecisions[0].periodLabel).toBe("March");
    expect(view2.similarDecisions[0].resultLabel).toContain("$1,102");
  });

  it("builds explicit approval preview for campaign reviews", () => {
    const items = [
      rec({ id: "r1", title: "Review campaign — Prospecting Broad" }),
      rec({ id: "r2", title: "Review campaign — Retargeting Warm" }),
    ];
    const presentation = buildApprovalPresentation(items, { campaigns: [] });
    const view = buildDecisionCenterView(presentation, items, null);

    const previewItems = view.primaryDecision?.approvalPreview.items ?? [];
    expect(previewItems.some((i) => /Recommend pausing campaigns if ROAS/.test(i))).toBe(true);
    expect(previewItems.some((i) => /budget reductions where profitability/.test(i))).toBe(true);
    expect(previewItems.some((i) => /Continue monitoring unaffected campaigns/.test(i))).toBe(true);
  });
});
