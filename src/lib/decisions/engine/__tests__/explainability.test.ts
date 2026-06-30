import { describe, expect, it } from "vitest";
import { computeDecisionExplainability } from "@/lib/decisions/engine/explainability-score";
import { formatModeWeights } from "@/lib/decisions/engine/mode-weights";
import type { DecisionItem } from "@/lib/decisions/center";

describe("computeDecisionExplainability", () => {
  it("scores higher with validation and strategy comparison", () => {
    const item: DecisionItem = {
      id: "1",
      priority: "high",
      summary: "Test",
      why: "Long explanation with enough detail to score strategy component higher for the decision engine",
      supportingMetrics: [{ label: "A", value: "1" }, { label: "B", value: "2" }],
      confidencePct: 82,
      estimatedImpactLabel: "$100",
      recommendedAction: "Go",
      status: "open",
      actionAvailable: false,
      executionAvailability: "manual",
      source: "recommendation",
      sourceId: "1",
      priorityScore: 100,
      validation: {
        aiConfidence: 0.8,
        validationConfidence: 0.99,
        finalConfidence: 0.79,
        validationScore: 99,
        providersUsed: ["meta"],
        providersBlocked: [],
        providersWarned: [],
        evidence: [{ id: "1", label: "Meta", passed: true }],
        calculationBasis: [],
        dateRangeVerified: true,
        blocked: false,
      },
    };

    const without = computeDecisionExplainability({ item });
    const withStrategy = computeDecisionExplainability({
      item,
      strategyComparison: {
        productId: "p1",
        productTitle: "Widget",
        merchantMode: "profit",
        strategies: [],
        recommended: {
          strategyId: "d15",
          label: "15% Discount",
          expectedUnitsSold: 10,
          expectedRevenue: 500,
          expectedGrossProfit: 300,
          expectedNetProfit: 200,
          inventoryReduction: 5,
          remainingInventory: 10,
          cashFlowImpact: 250,
          roasImpact: 0,
          riskScore: 0.2,
          confidence: 0.8,
          reasoning: "Best net profit",
          compositeScore: 500,
        },
        explanation: "Discount wins",
        expectedBusinessImpact: "Profit up",
      },
    });

    expect(withStrategy.scorePct).toBeGreaterThanOrEqual(without.scorePct);
    expect(withStrategy.hasStrategyComparison).toBe(true);
  });
});

describe("formatModeWeights", () => {
  it("returns normalized weight percentages for profit mode", () => {
    const weights = formatModeWeights("profit");
    expect(weights.length).toBeGreaterThan(0);
    const total = weights.reduce((sum, w) => sum + w.weightPct, 0);
    expect(total).toBeGreaterThanOrEqual(95);
    expect(total).toBeLessThanOrEqual(105);
    expect(weights[0]?.label).toBe("Net Profit");
  });
});
