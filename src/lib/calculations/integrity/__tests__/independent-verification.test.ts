import { describe, expect, it } from "vitest";
import { calculateBusinessKPIs } from "@/lib/calculations/kpis/engine";
import { integrityRawFacts } from "@/lib/calculations/integrity/bridge";
import { independentKpisFromIntegrityFixtures } from "@/lib/calculations/integrity/independent";
import { INTEGRITY_EXPECTED_KPIS } from "@/lib/calculations/integrity/fixtures";
import { assertAllMatch, compareMetric } from "@/lib/calculations/integrity/compare";

describe("Phase 3 — independent verification vs StorePilot", () => {
  it("StorePilot KPIs match independent recalculation exactly", () => {
    const engine = calculateBusinessKPIs(integrityRawFacts());
    const independent = independentKpisFromIntegrityFixtures();

    assertAllMatch([
      compareMetric("revenue", engine.revenue, independent.revenue),
      compareMetric("orders", engine.orders, independent.orders),
      compareMetric("cogs", engine.cogs, independent.cogs),
      compareMetric("adSpend", engine.adSpend, independent.adSpend),
      compareMetric("grossProfit", engine.grossProfit, independent.grossProfit),
      compareMetric("netProfit", engine.netProfit, independent.netProfit),
      compareMetric("contributionMargin", engine.contributionMargin, independent.contributionMargin),
      compareMetric("grossMarginPct", engine.grossMarginPct, independent.grossMarginPct),
      compareMetric("netMarginPct", engine.netMarginPct, independent.netMarginPct),
      compareMetric("blendedRoas", engine.blendedRoas, independent.blendedRoas),
      compareMetric("mer", engine.mer, independent.mer),
      compareMetric("aov", engine.aov, independent.aov),
      compareMetric("cpa", engine.cpa, independent.cpa),
      compareMetric("cac", engine.cac, independent.cac),
      compareMetric("conversionRatePct", engine.conversionRatePct, independent.conversionRatePct),
    ]);
  });

  it("both sides match hand-locked expected values", () => {
    const engine = calculateBusinessKPIs(integrityRawFacts());
    expect(engine.revenue).toBe(INTEGRITY_EXPECTED_KPIS.revenue);
    expect(engine.netProfit).toBe(INTEGRITY_EXPECTED_KPIS.netProfit);
    expect(engine.blendedRoas).toBe(INTEGRITY_EXPECTED_KPIS.blendedRoas);
  });
});
