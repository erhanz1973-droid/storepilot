import { describe, expect, it } from "vitest";
import {
  isEligibleExecutiveDecision,
  selectTodaysExecutiveDecision,
  type ExecutiveCandidate,
} from "@/lib/analytics/executive-decision-ranking";
import { buildRecommendationGate } from "@/lib/calculations/reality/recommendation-gate";
import type { RealityKpiResult } from "@/lib/calculations/reality/types";
import { buildFinancialTrustScore } from "@/lib/calculations/reality/trust-score";
import type { DecisionImpact } from "@/lib/calculations/impact/engine";

function candidate(
  partial: Partial<ExecutiveCandidate> & Pick<ExecutiveCandidate, "id" | "title">,
): ExecutiveCandidate {
  return {
    description: partial.description ?? partial.title,
    impactLabel: partial.impactLabel ?? "+$500/mo",
    confidencePct: partial.confidencePct ?? 90,
    priority: partial.priority ?? "high",
    risk: partial.risk ?? "low",
    ...partial,
  };
}

const IMPACT: DecisionImpact = {
  businessRecovery: 6168,
  recoverableWaste: 6168,
  recoverableRevenue: null,
  revenueRecovered: null,
  advertisingSavings: 8000,
  advertisingSavingsLow: 6168,
  advertisingSavingsHigh: 11102,
  grossProfitImpact: 8000,
  netProfitImpact: 636,
  cashFlowImpact: 8000,
  monthlyProfitRecovery: 636,
  expectedProfit: 636,
  expectedROAS: null,
  paybackDays: null,
  confidence: 92,
  campaignCount: 1,
  observationPeriodDays: 30,
  sourceAmount: 8000,
  alreadyProfitLabeled: true,
  sourceLabel: "test",
};

describe("Executive ranking × Reality gate", () => {
  it("blocks eligible decision when reality gate denies high confidence", () => {
    const results: RealityKpiResult[] = [
      {
        kpiId: "revenue",
        label: "Revenue",
        storepilotValue: 50_000,
        sourceValue: 30_000,
        source: "shopify_analytics",
        differenceAbs: 20_000,
        differencePct: 0.666,
        status: "needs_investigation",
        trusted: false,
        critical: true,
        profitSensitive: false,
      },
      {
        kpiId: "ad_spend",
        label: "Advertising Spend",
        storepilotValue: 10_000,
        sourceValue: 10_000,
        source: "meta_ads_manager",
        differenceAbs: 0,
        differencePct: 0,
        status: "verified",
        trusted: true,
        critical: true,
        profitSensitive: false,
      },
    ];
    const trust = buildFinancialTrustScore(results);
    const gate = buildRecommendationGate(results, trust);
    expect(gate.allowHighConfidenceRecommendations).toBe(false);

    const c = candidate({
      id: "1",
      title: "Pause wasteful campaign",
      impactLabel:
        "cost savings ~$6,168–$11,102/mo (~$636/mo profit preserved)",
      confidencePct: 92,
      knownBusinessRecovery: 6168,
      knownNetProfit: 636,
    });

    expect(isEligibleExecutiveDecision(IMPACT, c, { realityGate: gate })).toBe(false);

    const selection = selectTodaysExecutiveDecision([c], { realityGate: gate });
    expect(selection.kind).toBe("none");
  });
});
