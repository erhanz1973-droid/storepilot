import { describe, expect, it } from "vitest";
import { calculateBusinessKPIs } from "@/lib/calculations/kpis/engine";
import { integrityRawFacts } from "@/lib/calculations/integrity/bridge";
import {
  assertFinancialIntegrity,
  runFinancialIntegrityChecks,
} from "@/lib/calculations/integrity/checks";
import { classifyDiscrepancy } from "@/lib/calculations/integrity/external-crosscheck";

describe("Phase 4 — financial integrity suite", () => {
  it("passes structural identities on integrity fixture KPIs", () => {
    const kpis = calculateBusinessKPIs(integrityRawFacts());
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

  it("flags broken ROAS identity", () => {
    const kpis = calculateBusinessKPIs(integrityRawFacts());
    const violations = runFinancialIntegrityChecks({
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
      blendedRoas: 99, // intentionally wrong
      mer: kpis.mer,
      aov: kpis.aov,
      cpa: kpis.cpa,
      cac: kpis.cac,
      grossMarginPct: kpis.grossMarginPct,
      netMarginPct: kpis.netMarginPct,
      conversionRatePct: kpis.conversionRatePct,
    });
    expect(violations.some((v) => v.code === "ROAS_IDENTITY")).toBe(true);
  });

  it("Phase 5: unexplained external gaps require investigation", () => {
    const gap = classifyDiscrepancy({
      metricId: "revenue",
      storepilot: 52_340,
      external: 48_000,
      externalSource: "shopify_analytics",
    });
    expect(gap.category).toBe("unexplained");
    expect(gap.requiresInvestigation).toBe(true);

    const attributed = classifyDiscrepancy({
      metricId: "attributed_revenue",
      storepilot: 40_100,
      external: 38_500,
      externalSource: "meta_ads_manager",
      knownCause: "attribution_window",
      explanation: "Meta 7-day click vs StorePilot blended store revenue.",
    });
    expect(attributed.requiresInvestigation).toBe(false);
    expect(attributed.category).toBe("attribution_window");
  });
});
