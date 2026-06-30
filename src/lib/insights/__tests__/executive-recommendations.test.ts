import { describe, expect, it } from "vitest";
import type { DecisionItem } from "@/lib/decisions/center";
import {
  buildExecutiveInsightsView,
  computeExecutivePriorityScore,
  humanizeRecommendationTitle,
  parseImpactMonthly,
} from "@/lib/insights/executive-recommendations";

function mockDecision(overrides: Partial<DecisionItem> = {}): DecisionItem {
  return {
    id: "dec-1",
    priority: "high",
    summary: "Campaign needs review",
    why: "ROAS below target · spend $2,860",
    supportingMetrics: [
      { label: "ROAS", value: "0.60" },
      { label: "Ad spend", value: "$2,860" },
      { label: "Net loss", value: "$1,155" },
    ],
    confidencePct: 90,
    estimatedImpactLabel: "Est. +$4,334/mo net profit",
    recommendedAction: "Pause campaign",
    status: "open",
    actionAvailable: true,
    executionAvailability: "available",
    source: "insight",
    sourceId: "opp-1",
    priorityScore: 900,
    entityName: "Prospecting – Core",
    entityType: "campaign",
    entityId: "camp-1",
    ...overrides,
  };
}

describe("executive recommendations", () => {
  it("rewrites technical titles into business language", () => {
    expect(humanizeRecommendationTitle("Campaign needs review")).toBe(
      "This campaign is losing money",
    );
    expect(humanizeRecommendationTitle("ROAS below target")).toBe(
      "Your advertising spend is not profitable",
    );
  });

  it("parses monthly impact from labels", () => {
    expect(parseImpactMonthly("Est. +$4,334/mo net profit")).toBe(4334);
  });

  it("limits top recommendations to five and sums recovery", () => {
    const decisions = Array.from({ length: 8 }, (_, i) =>
      mockDecision({
        id: `dec-${i}`,
        summary: `Issue ${i}`,
        entityName: `Campaign ${i}`,
        estimatedImpactLabel: `Est. +$${(i + 1) * 1000}/mo`,
        priorityScore: 500 - i,
      }),
    );

    const view = buildExecutiveInsightsView(decisions, { topLimit: 5 });
    expect(view.topRecommendations).toHaveLength(5);
    expect(view.moreRecommendations).toHaveLength(3);
    expect(view.summary.opportunityCount).toBe(8);
    expect(view.summary.estimatedMonthlyRecovery).toBeGreaterThan(0);
  });

  it("scores higher impact and confidence above low-priority items", () => {
    const strong = mockDecision({
      priority: "critical",
      confidencePct: 92,
      estimatedImpactLabel: "Est. +$8,000/mo",
    });
    const weak = mockDecision({
      priority: "low",
      confidencePct: 55,
      estimatedImpactLabel: "Est. +$200/mo",
    });

    const strongScore = computeExecutivePriorityScore(strong, 8000);
    const weakScore = computeExecutivePriorityScore(weak, 200);
    expect(strongScore).toBeGreaterThan(weakScore);
    expect(strongScore).toBeLessThanOrEqual(100);
  });
});
