import { describe, expect, it } from "vitest";
import { calculateBusinessKPIs } from "@/lib/calculations/kpis/engine";
import {
  calculateDecisionImpact,
  buildDecisionImpactPresentation,
} from "@/lib/calculations/impact/engine";
import { buildCalculationAudit } from "@/lib/calculations/audit/builder";
import {
  validateCrossScreenImpact,
  assertExecutiveMatchesImpact,
  assertApprovalMatchesImpact,
} from "@/lib/calculations/audit/cross-screen";
import { FORMULA_ENGINE_VERSION } from "@/lib/calculations/version";
import {
  GOLDEN_EXPECTED,
  goldenDecision,
  goldenRawFacts,
} from "@/lib/calculations/golden/campaign-recovery-30d";

describe("golden dataset — financial regression lock", () => {
  const facts = goldenRawFacts();
  const decision = goldenDecision();
  const kpis = calculateBusinessKPIs(facts);
  const impact = calculateDecisionImpact(decision, kpis);
  const presentation = buildDecisionImpactPresentation(impact);
  const audit = buildCalculationAudit({
    decision,
    rawFacts: facts,
    kpis,
    lastSyncedAt: "2026-07-14T12:00:00.000Z",
  });

  it("locks formula engine version", () => {
    expect(FORMULA_ENGINE_VERSION).toBe(GOLDEN_EXPECTED.formulaVersion);
    expect(audit.formulaVersion).toBe(GOLDEN_EXPECTED.formulaVersion);
  });

  it("calculateBusinessKPIs → expected ROAS", () => {
    expect(facts.campaigns).toHaveLength(GOLDEN_EXPECTED.campaignCount);
    expect(facts.window).toBe(GOLDEN_EXPECTED.window);
    expect(kpis.blendedRoas).toBe(GOLDEN_EXPECTED.blendedRoas);
  });

  it("calculateDecisionImpact → recovery + net profit", () => {
    expect(impact.businessRecovery).toBe(GOLDEN_EXPECTED.businessRecovery);
    expect(impact.netProfitImpact).toBe(GOLDEN_EXPECTED.netProfitImpact);
  });

  it("Executive / Approval / Story / Ask AI / History share DecisionImpact values", () => {
    assertExecutiveMatchesImpact(impact, presentation.heroAmount);
    assertApprovalMatchesImpact(impact, presentation.netProfitAmount);

    const recoveryParity = validateCrossScreenImpact(
      impact,
      {
        executiveHero: presentation.heroAmount,
        approvalSummary: impact.businessRecovery,
        story: impact.businessRecovery,
        askAi: impact.businessRecovery,
        history: impact.businessRecovery,
      },
      { metric: "businessRecovery" },
    );
    expect(recoveryParity.ok).toBe(true);

    const netParity = validateCrossScreenImpact(
      impact,
      {
        executiveHero: impact.netProfitImpact,
        approvalSummary: presentation.netProfitAmount,
        story: impact.netProfitImpact,
        askAi: impact.netProfitImpact,
        history: impact.netProfitImpact,
      },
      { metric: "netProfitImpact" },
    );
    expect(netParity.ok).toBe(true);
  });

  it("CalculationAudit is immutable pipeline with explained steps", () => {
    expect(audit.decisionId).toBe(decision.id);
    expect(audit.decisionImpact.businessRecovery).toBe(GOLDEN_EXPECTED.businessRecovery);
    expect(audit.decisionImpact.netProfitImpact).toBe(GOLDEN_EXPECTED.netProfitImpact);
    expect(audit.presentation.heroAmount).toBe(GOLDEN_EXPECTED.businessRecovery);
    expect(audit.presentation.netProfitAmount).toBe(GOLDEN_EXPECTED.netProfitImpact);
    expect(audit.pipeline).toHaveLength(5);
    expect(audit.explained.businessRecovery?.intermediateSteps.length).toBeGreaterThan(0);
    expect(audit.explained.netProfitImpact?.value).toBe(GOLDEN_EXPECTED.netProfitImpact);
    expect(audit.decisionImpactFingerprint).toMatch(/^[0-9a-f]{8}$/);
  });

  it("FAIL BUILD if cross-screen values diverge from DecisionImpact", () => {
    expect(() =>
      assertExecutiveMatchesImpact(impact, GOLDEN_EXPECTED.businessRecovery + 1),
    ).toThrow(/Cross-screen FAIL/);
    expect(() =>
      assertApprovalMatchesImpact(impact, GOLDEN_EXPECTED.netProfitImpact + 1),
    ).toThrow(/Cross-screen FAIL/);
  });
});
