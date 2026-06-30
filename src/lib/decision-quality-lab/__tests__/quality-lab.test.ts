import { describe, expect, it } from "vitest";
import { mapDecisionToIntents, intentsAreCompatible } from "../intent-mapper";
import { evaluateSemanticIntents } from "../semantic-evaluator";
import { computeExtendedDecisionQuality } from "../quality-score";
import { buildDecisionSelfAssessment } from "../self-assessment";
import { generateRandomStores } from "../monte-carlo";
import { evaluateReleaseQualityGate } from "../release-gate";

describe("decision quality lab", () => {
  it("maps reduce advertising intent semantically", () => {
    const intents = mapDecisionToIntents({
      id: "d1",
      summary: "Pause underperforming Meta campaign",
      why: "ROAS below target",
      recommendedAction: "Reduce budget on prospecting",
      confidencePct: 78,
      priority: "high",
      supportingMetrics: [],
      status: "open",
    } as never);
    expect(intents).toContain("reduce_advertising");
  });

  it("accepts pause campaign as reduce advertising intent", () => {
    const result = evaluateSemanticIntents({
      decisions: [
        {
          id: "d1",
          summary: "Pause summer SPF campaign",
          why: "High CPC compressing margin",
          recommendedAction: "Pause campaign",
          confidencePct: 80,
          priority: "high",
          supportingMetrics: [],
          status: "open",
        } as never,
      ],
      expectedIntents: ["reduce_advertising"],
    });
    expect(result.verdict).toBe("pass");
    expect(result.accuracyPct).toBe(100);
  });

  it("rejects increase budget when reduce advertising expected", () => {
    const result = evaluateSemanticIntents({
      decisions: [
        {
          id: "d1",
          summary: "Increase budget on prospecting",
          why: "Scale spend",
          recommendedAction: "Launch new campaign",
          confidencePct: 70,
          priority: "medium",
          supportingMetrics: [],
          status: "open",
        } as never,
      ],
      expectedIntents: ["reduce_advertising"],
    });
    expect(result.verdict).toBe("fail");
  });

  it("computes extended quality breakdown", () => {
    const breakdown = computeExtendedDecisionQuality({
      item: {
        id: "d1",
        summary: "Bundle slow movers",
        why: "Dead inventory tying up cash with detailed margin analysis",
        recommendedAction: "Create bundle offer",
        confidencePct: 82,
        priority: "high",
        supportingMetrics: [{ label: "Stock", value: "180" }, { label: "Sold", value: "2" }],
        explainability: { scorePct: 88, validationPct: 90, confidencePct: 82, evidenceStatus: "complete", hasStrategyComparison: true },
        validationGate: { canGenerateRecommendations: true, overallMatchPercent: 95 } as never,
        strategyComparison: { recommended: { strategyId: "bundle", label: "Bundle" } } as never,
        status: "open",
      } as never,
      businessModel: "own_inventory",
      expectedIntents: ["inventory_clearance"],
    });
    expect(breakdown.overallPct).toBeGreaterThan(50);
    expect(breakdown.explainabilityPct).toBe(88);
  });

  it("builds self-assessment", () => {
    const assessment = buildDecisionSelfAssessment({
      item: {
        id: "d1",
        summary: "Scale winner",
        why: "Strong ROAS",
        recommendedAction: "Increase budget",
        confidencePct: 85,
        priority: "high",
        supportingMetrics: [{ label: "ROAS", value: "4.2" }, { label: "Spend", value: "$2k" }, { label: "Rev", value: "$8k" }],
        explainability: { scorePct: 90, validationPct: 92, confidencePct: 85, evidenceStatus: "complete", hasStrategyComparison: true },
        validation: { validationScore: 92 } as never,
        strategyComparison: { recommended: { strategyId: "scale", label: "Scale" } } as never,
        status: "open",
      } as never,
      businessModel: "dropshipping",
    });
    expect(assessment.scorePct).toBeGreaterThanOrEqual(80);
  });

  it("generates consistent random stores", () => {
    const stores = generateRandomStores(5, { seedBase: 100 });
    expect(stores).toHaveLength(5);
    for (const s of stores) {
      expect(s.params.revenue30d).toBeGreaterThan(0);
      expect(s.params.orders30d).toBeGreaterThan(0);
    }
  });

  it("evaluates release quality gate", () => {
    const gate = evaluateReleaseQualityGate({
      accuracyPct: 96,
      businessModelCompliancePct: 100,
      validationCoveragePct: 100,
      criticalScenarioPassPct: 100,
      avgQualityPct: 92,
    });
    expect(gate.passed).toBe(true);
  });

  it("intent compatibility links scaling and increase advertising", () => {
    expect(intentsAreCompatible("scaling", "increase_advertising")).toBe(true);
  });
});
