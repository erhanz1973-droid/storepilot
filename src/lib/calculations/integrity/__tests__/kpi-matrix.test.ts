import { describe, expect, it } from "vitest";
import {
  INTEGRITY_EXPECTED_KPIS,
  INTEGRITY_LOCKED,
  META_ADS_30D,
  SHOPIFY_ORDERS_30D,
} from "@/lib/calculations/integrity/fixtures";
import {
  independentKpisFromIntegrityFixtures,
  sumMetaAds,
  sumShopifyOrders,
} from "@/lib/calculations/integrity/independent";
import { assertRegistryComplete, KPI_VALIDATION_REGISTRY } from "@/lib/calculations/integrity/registry";
import {
  formulaAov,
  formulaBlendedRoas,
  formulaCac,
  formulaCpa,
  formulaGrossMarginPct,
  formulaGrossProfit,
  formulaMer,
  formulaNetMarginPct,
  formulaNetProfit,
  formulaContributionMargin,
} from "@/lib/calculations/formulas";

const REQUIRED = [
  "revenue",
  "orders",
  "ad_spend",
  "gross_profit",
  "net_profit",
  "roas",
  "mer",
  "cpa",
  "cac",
  "aov",
  "business_recovery",
  "net_profit_impact",
];

describe("Phase 1 — KPI validation matrix", () => {
  it("registry covers every required KPI as validated", () => {
    assertRegistryComplete(REQUIRED);
    expect(KPI_VALIDATION_REGISTRY.length).toBeGreaterThanOrEqual(REQUIRED.length);
  });

  it("fixture Shopify rows sum to locked commerce totals", () => {
    const c = sumShopifyOrders(SHOPIFY_ORDERS_30D);
    expect(c.revenue).toBe(INTEGRITY_LOCKED.revenue);
    expect(c.orders).toBe(INTEGRITY_LOCKED.orders);
    expect(c.cogs).toBe(INTEGRITY_LOCKED.cogs);
    expect(c.shippingCost).toBe(INTEGRITY_LOCKED.shippingCost);
    expect(c.platformFees).toBe(INTEGRITY_LOCKED.platformFees);
  });

  it("fixture Meta rows sum to locked ad totals", () => {
    const a = sumMetaAds(META_ADS_30D);
    expect(a.adSpend).toBe(INTEGRITY_LOCKED.adSpend);
    expect(a.purchases).toBe(INTEGRITY_LOCKED.purchases);
  });

  it("each KPI formula matches expected example calculation", () => {
    const L = INTEGRITY_LOCKED;
    // Revenue / Orders / Ad Spend — from source totals
    expect(L.revenue).toBe(52_340);
    expect(L.orders).toBe(10);
    expect(L.adSpend).toBe(12_100);

    // Gross Profit = Revenue − COGS
    expect(formulaGrossProfit(L.revenue, L.cogs)).toBe(L.grossProfit);
    expect(L.grossProfit).toBe(30_240);

    // Net Profit waterfall
    expect(
      formulaNetProfit({
        revenue: L.revenue,
        cogs: L.cogs,
        shippingCost: L.shippingCost,
        refunds: L.refunds,
        platformFees: L.platformFees,
        adSpend: L.adSpend,
      }),
    ).toBe(L.netProfit);
    expect(L.netProfit).toBe(13_320);

    expect(formulaContributionMargin(L.revenue, L.cogs, L.adSpend)).toBe(L.contributionMargin);

    // ROAS / MER
    expect(formulaBlendedRoas(L.revenue, L.adSpend)).toBe(L.blendedRoas);
    expect(formulaMer(L.revenue, L.adSpend)).toBe(L.mer);

    // CPA / CAC / AOV
    expect(formulaCpa(L.adSpend, L.purchases)).toBe(L.cpa);
    expect(formulaCac(L.adSpend, L.customers)).toBe(L.cac);
    expect(formulaAov(L.revenue, L.orders)).toBe(L.aov);

    expect(formulaGrossMarginPct(L.grossProfit, L.revenue)).toBe(L.grossMarginPct);
    expect(formulaNetMarginPct(L.netProfit, L.revenue)).toBe(L.netMarginPct);

    // Decision-layer locks
    expect(INTEGRITY_EXPECTED_KPIS.businessRecovery).toBe(6168);
    expect(INTEGRITY_EXPECTED_KPIS.netProfitImpact).toBe(636);
  });

  it("independent recalculator reproduces locked KPIs without StorePilot engine", () => {
    const ind = independentKpisFromIntegrityFixtures();
    expect(ind.revenue).toBe(INTEGRITY_EXPECTED_KPIS.revenue);
    expect(ind.grossProfit).toBe(INTEGRITY_EXPECTED_KPIS.grossProfit);
    expect(ind.netProfit).toBe(INTEGRITY_EXPECTED_KPIS.netProfit);
    expect(ind.blendedRoas).toBe(INTEGRITY_EXPECTED_KPIS.blendedRoas);
    expect(ind.aov).toBe(INTEGRITY_EXPECTED_KPIS.aov);
    expect(ind.cpa).toBe(INTEGRITY_EXPECTED_KPIS.cpa);
    expect(ind.cac).toBe(INTEGRITY_EXPECTED_KPIS.cac);
    expect(ind.grossMarginPct).toBe(INTEGRITY_EXPECTED_KPIS.grossMarginPct);
    expect(ind.netMarginPct).toBe(INTEGRITY_EXPECTED_KPIS.netMarginPct);
  });
});
