import { describe, expect, it } from "vitest";
import { validateDecisionCompleteness } from "@/lib/decisions/qa/completeness";
import { computeDecisionQualityScore } from "@/lib/decisions/qa/quality-score";
import { runConsistencyChecks, consistencyAllPassed } from "@/lib/decisions/qa/consistency";
import { runProductionChecklist, productionAllPassed } from "@/lib/decisions/qa/production-checklist";
import { runScenarioTests, scenariosAllPassed } from "@/lib/decisions/qa/scenario-runner";
import { decisionRankingSignature } from "@/lib/decisions/qa/runner";
import { compareSlowProductStrategies } from "@/lib/decisions/strategy-comparison";
import { QA_SCENARIOS } from "@/lib/decisions/qa/scenarios";
import type { EnrichedDecisionItem } from "@/lib/decisions/engine/types";
import { DEAD_INVENTORY_GROUP_KEY } from "@/lib/insights/business-action-groups";

function mockDecision(overrides: Partial<EnrichedDecisionItem>): EnrichedDecisionItem {
  return {
    id: "dec-1",
    priority: "high",
    summary: "Dead inventory",
    why: "14 products unsold for 30 days",
    supportingMetrics: [{ label: "Products", value: "14" }],
    confidencePct: 78,
    estimatedImpactLabel: "$2,400/mo",
    recommendedAction: "15% Automatic Discount",
    status: "open",
    actionAvailable: false,
    executionAvailability: "manual",
    source: "insight",
    sourceId: "opp-1",
    priorityScore: 500,
    groupKey: DEAD_INVENTORY_GROUP_KEY,
    isGroupedAction: true,
    validation: {
      aiConfidence: 0.8,
      validationConfidence: 0.99,
      finalConfidence: 0.78,
      validationScore: 99,
      providersUsed: ["shopify"],
      providersBlocked: [],
      providersWarned: [],
      evidence: [{ id: "1", label: "Shopify passed", passed: true }],
      calculationBasis: [],
      dateRangeVerified: true,
      blocked: false,
    },
    validationGate: {
      storeId: "s1",
      evaluatedAt: new Date().toISOString(),
      providers: [],
      overallMatchPercent: 99,
      canGenerateRecommendations: true,
      trustedProviderIds: ["shopify"],
      blockedProviderIds: [],
      warnedProviderIds: [],
    },
    strategyComparison: compareSlowProductStrategies({
      product: QA_SCENARIOS[0]!.product,
      merchantMode: "profit",
    }),
    explainability: {
      scorePct: 88,
      validationPct: 99,
      confidencePct: 78,
      evidenceStatus: "complete",
      hasStrategyComparison: true,
    },
    ...overrides,
  };
}

describe("decision completeness gate", () => {
  it("marks complete decisions with all required fields", () => {
    const { status, checks } = validateDecisionCompleteness(mockDecision({}));
    expect(status).toBe("complete");
    expect(checks.every((c) => c.passed)).toBe(true);
  });

  it("marks incomplete when evidence missing", () => {
    const { status } = validateDecisionCompleteness(
      mockDecision({ supportingMetrics: [], validation: undefined }),
    );
    expect(status).toBe("incomplete");
  });
});

describe("decision quality score", () => {
  it("scores high-quality decisions above threshold", () => {
    const score = computeDecisionQualityScore(mockDecision({}));
    expect(score).toBeGreaterThanOrEqual(65);
  });
});

describe("consistency checks", () => {
  it("passes for valid decision set", () => {
    const decisions = [
      mockDecision({ id: "a", summary: "Dead inventory", problemKey: "dead-1" }),
      mockDecision({
        id: "b",
        summary: "Campaign ROAS below target",
        problemKey: "camp-1",
        isGroupedAction: false,
        groupKey: undefined,
        entityType: "campaign",
        entityId: "camp-99",
        strategyComparison: undefined,
        why: "Campaign spend exceeds incremental revenue with sustained low ROAS over 7 days.",
      }),
    ];
    const checks = runConsistencyChecks(decisions);
    expect(consistencyAllPassed(checks)).toBe(true);
  });

  it("fails on duplicate problem keys", () => {
    const decisions = [
      mockDecision({ id: "a", problemKey: "same-key" }),
      mockDecision({ id: "b", problemKey: "same-key" }),
    ];
    const checks = runConsistencyChecks(decisions);
    expect(checks.find((c) => c.id === "no_duplicates")?.passed).toBe(false);
  });
});

describe("production checklist", () => {
  it("passes sanity checks on mock decisions", () => {
    const checks = runProductionChecklist([mockDecision({})]);
    expect(productionAllPassed(checks)).toBe(true);
  });

  it("detects NaN in strategy estimates", () => {
    const d = mockDecision({});
    d.strategyComparison!.recommended.expectedNetProfit = NaN;
    const checks = runProductionChecklist([d]);
    expect(checks.find((c) => c.id === "no_nan")?.passed).toBe(false);
  });
});

describe("scenario tests", () => {
  it("runs all predefined business scenarios", () => {
    const results = runScenarioTests();
    expect(results.length).toBe(QA_SCENARIOS.length);
    expect(scenariosAllPassed(results)).toBe(true);
  });
});

describe("decision regression snapshot", () => {
  it("produces stable ranking for fixture scenarios", () => {
    const rankings = QA_SCENARIOS.map((scenario) => {
      const result = compareSlowProductStrategies({
        product: scenario.product,
        merchantMode: scenario.merchantMode ?? "profit",
      });
      return `${scenario.id}:${result.recommended.strategyId}:${Math.round(result.recommended.expectedNetProfit)}`;
    });
    expect(rankings).toMatchSnapshot();
  });

  it("produces stable QA ranking signature", () => {
    const decisions = [
      mockDecision({ id: "a", problemKey: "key-a", qualityScorePct: 90 }),
      mockDecision({ id: "b", problemKey: "key-b", qualityScorePct: 85, summary: "Slow SKU" }),
    ];
    expect(decisionRankingSignature(decisions)).toMatchSnapshot();
  });
});
