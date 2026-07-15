import { describe, expect, it } from "vitest";
import { calculateBusinessKPIs } from "@/lib/calculations/kpis/engine";
import {
  buildDecisionImpactPresentation,
  calculateDecisionImpact,
} from "@/lib/calculations/impact/engine";
import { buildCalculationAudit } from "@/lib/calculations/audit/builder";
import {
  assertApprovalMatchesImpact,
  assertExecutiveMatchesImpact,
  validateCrossScreenImpact,
} from "@/lib/calculations/audit/cross-screen";
import { integrityDecision, integrityRawFacts } from "@/lib/calculations/integrity/bridge";
import { INTEGRITY_LOCKED } from "@/lib/calculations/integrity/fixtures";
import { independentKpisFromIntegrityFixtures } from "@/lib/calculations/integrity/independent";
import { assertFinancialIntegrity } from "@/lib/calculations/integrity/checks";

/**
 * Phase 2 — End-to-end reconciliation
 *
 * Raw Data → KPIs → Decision → Impact → Executive → Approval → History
 * Every displayed number must reconcile to the Shopify + Meta fixtures.
 */
describe("Phase 2 — end-to-end financial reconciliation", () => {
  const rawFacts = integrityRawFacts();
  const independent = independentKpisFromIntegrityFixtures();
  const kpis = calculateBusinessKPIs(rawFacts);
  const decision = integrityDecision();
  const impact = calculateDecisionImpact(decision, kpis);
  const presentation = buildDecisionImpactPresentation(impact);
  const audit = buildCalculationAudit({
    decision,
    rawFacts,
    kpis,
    lastSyncedAt: "2026-07-14T12:00:00.000Z",
  });

  it("Raw Shopify revenue feeds every downstream stage", () => {
    expect(rawFacts.commerce.revenue).toBe(INTEGRITY_LOCKED.revenue);
    expect(kpis.revenue).toBe(INTEGRITY_LOCKED.revenue);
    expect(independent.revenue).toBe(INTEGRITY_LOCKED.revenue);
    expect(audit.rawFacts.commerce.revenue).toBe(INTEGRITY_LOCKED.revenue);
    expect(audit.calculatedKPIs.revenue).toBe(INTEGRITY_LOCKED.revenue);
  });

  it("KPI stage matches independent + integrity identities", () => {
    expect(kpis.grossProfit).toBe(INTEGRITY_LOCKED.grossProfit);
    expect(kpis.netProfit).toBe(INTEGRITY_LOCKED.netProfit);
    expect(kpis.blendedRoas).toBe(INTEGRITY_LOCKED.blendedRoas);
    assertFinancialIntegrity({
      revenue: kpis.revenue,
      orders: kpis.orders,
      cogs: kpis.cogs,
      shippingCost: kpis.shippingCost,
      refunds: kpis.refunds,
      platformFees: kpis.platformFees,
      adSpend: kpis.adSpend,
      grossProfit: kpis.grossProfit,
      netProfit: kpis.netProfit,
      contributionMargin: kpis.contributionMargin,
      blendedRoas: kpis.blendedRoas,
      mer: kpis.mer,
      aov: kpis.aov,
      cpa: kpis.cpa,
      cac: kpis.cac,
      grossMarginPct: kpis.grossMarginPct,
      netMarginPct: kpis.netMarginPct,
      conversionRatePct: kpis.conversionRatePct,
    });
  });

  it("Decision → Impact locks Business Recovery + Net Profit Impact", () => {
    expect(impact.businessRecovery).toBe(INTEGRITY_LOCKED.businessRecovery);
    expect(impact.netProfitImpact).toBe(INTEGRITY_LOCKED.netProfitImpact);
  });

  it("Executive hero == Approval waterfall source == History expected", () => {
    // Executive hero
    assertExecutiveMatchesImpact(impact, presentation.heroAmount);
    // Approval net
    assertApprovalMatchesImpact(impact, presentation.netProfitAmount);
    // Story / Ask AI / History — same DecisionImpact object
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

  it("CalculationAudit is explainable (sources + formula version + steps)", () => {
    expect(audit.formulaVersion).toBeTruthy();
    expect(audit.explained.netProfit?.formula).toMatch(/Net Profit/i);
    expect(audit.explained.netProfit?.dataSources?.length).toBeGreaterThan(0);
    expect(audit.explained.businessRecovery?.intermediateSteps.length).toBeGreaterThan(0);
    expect(audit.explained.netProfitImpact?.value).toBe(INTEGRITY_LOCKED.netProfitImpact);
    expect(audit.pipeline.map((p) => p.stage)).toEqual([
      "raw_facts",
      "business_kpis",
      "decision",
      "decision_impact",
      "presentation",
    ]);
  });
});
