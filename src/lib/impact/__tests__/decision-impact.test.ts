import { describe, expect, it } from "vitest";
import {
  buildDecisionImpactPresentation,
  calculateDecisionImpact,
  calculateDecisionImpactFromRecommendation,
  DECISION_IMPACT_COPY,
} from "@/lib/impact/decision-impact";
import type { Recommendation } from "@/lib/types";

const CAMPAIGN_IMPACT_LABEL =
  "If accepted, estimated cost savings ~$6,168–$11,102/mo (~$636/mo profit preserved).";

describe("calculateDecisionImpact — multi-metric canonical model", () => {
  it("exposes business recovery and net profit from the same label", () => {
    const impact = calculateDecisionImpact({
      expectedImpactLabel: CAMPAIGN_IMPACT_LABEL,
      category: "campaign_review",
      confidenceScore: 0.86,
      netMarginPct: 10.3,
    });
    expect(impact.businessRecovery).toBe(6168);
    expect(impact.netProfitImpact).toBe(636);
    expect(impact.advertisingSavings).toBe(Math.round((6168 + 11102) / 2));
  });

  it("builds executive-friendly presentation with waterfall story", () => {
    const impact = calculateDecisionImpact({
      expectedImpactLabel: CAMPAIGN_IMPACT_LABEL,
      category: "campaign_review",
      confidenceScore: 0.92,
    });
    const presentation = buildDecisionImpactPresentation(impact);

    expect(presentation.heroLabel).toBe(DECISION_IMPACT_COPY.heroLabel);
    expect(presentation.heroValueFormatted).toBe("+$6,168");
    expect(presentation.netProfitFormatted).toBe("+$636/month");
    expect(presentation.confidencePct).toBe(92);
    expect(presentation.showNetProfitSecondary).toBe(true);
    expect(presentation.waterfall.map((s) => s.label)).toEqual([
      DECISION_IMPACT_COPY.recoverableBusinessValue,
      DECISION_IMPACT_COPY.advertisingEfficiencyGain,
      DECISION_IMPACT_COPY.netProfitImprovement,
    ]);
    expect(presentation.waterfallNarrative).toMatch(/eliminating wasted ad spend/i);
    expect(presentation.heroTooltip).toMatch(/Recoverable Business Value/i);
  });

  it("keeps Executive and Approvals callers consistent", () => {
    const rec = {
      id: "rec-1",
      category: "campaign_review",
      title: "High spend, low purchases — Prospecting Broad",
      severity: "high",
      reason: "spend high",
      expectedImpact: CAMPAIGN_IMPACT_LABEL,
      confidenceScore: 0.86,
      actionLabel: "Pause",
      supportingMetrics: [{ label: "ROAS", value: "0.58" }],
      createdAt: new Date().toISOString(),
    } satisfies Recommendation;

    const fromLabel = buildDecisionImpactPresentation(
      calculateDecisionImpact({
        expectedImpactLabel: rec.expectedImpact,
        category: rec.category,
        confidenceScore: rec.confidenceScore,
      }),
    );
    const fromRec = buildDecisionImpactPresentation(
      calculateDecisionImpactFromRecommendation(rec),
    );

    expect(fromLabel.heroAmount).toBe(fromRec.heroAmount);
    expect(fromLabel.netProfitAmount).toBe(fromRec.netProfitAmount);
    expect(fromLabel.heroAmount).toBe(6168);
    expect(fromLabel.netProfitAmount).toBe(636);
  });
});
