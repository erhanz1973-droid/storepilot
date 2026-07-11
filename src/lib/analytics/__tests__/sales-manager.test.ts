import { describe, expect, it } from "vitest";
import { getPeakOutfittersSnapshot } from "@/lib/connectors/demo-data";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildSalesManagerView } from "@/lib/analytics/sales-manager";

describe("sales manager view", () => {
  it("builds v2 AI sales intelligence sections", () => {
    const snapshot = getPeakOutfittersSnapshot();
    const profitDashboard = computeProfitDashboard(snapshot, []);
    const view = buildSalesManagerView({ snapshot, profitDashboard });

    expect(view.v2.brief.lines.length).toBeGreaterThan(0);
    expect(view.v2.businessKpis.length).toBe(7);
    expect(view.v2.revenueQuality.score).toBeGreaterThan(0);
    expect(view.v2.drivers.length).toBeGreaterThan(0);
    expect(view.v2.opportunities.length).toBeGreaterThan(0);
    expect(view.v2.revenueStudio.playbooks.length).toBeGreaterThan(0);
    expect(view.v2.dailyPlaybook.items.length).toBeGreaterThan(0);
    expect(view.v2.orders.length).toBeGreaterThan(0);
  });

  it("prioritizes business KPIs over taxes and shipping", () => {
    const view = buildSalesManagerView({
      snapshot: getPeakOutfittersSnapshot(),
      profitDashboard: computeProfitDashboard(getPeakOutfittersSnapshot(), []),
    });

    const primaryLabels = view.v2.businessKpis.map((k) => k.label);
    const secondaryLabels = view.v2.secondaryMetrics.map((k) => k.label);

    expect(primaryLabels).toContain("Net Revenue");
    expect(primaryLabels).toContain("Gross Margin");
    expect(primaryLabels).toContain("Repeat Purchase Rate");
    expect(secondaryLabels).toContain("Taxes");
    expect(secondaryLabels).toContain("Shipping");
    expect(primaryLabels).not.toContain("Taxes");
  });

  it("includes trend commentary and discount explanation", () => {
    const view = buildSalesManagerView({
      snapshot: getPeakOutfittersSnapshot(),
      profitDashboard: computeProfitDashboard(getPeakOutfittersSnapshot(), []),
    });

    expect(view.v2.trendCommentary.insight.length).toBeGreaterThan(10);
    expect(view.v2.discountInsight.explanation).toContain("margin");
    expect(view.v2.customerValue.returningCustomerRevenue).toBeGreaterThan(0);
  });

  it("orders include profit variation and highlights", () => {
    const view = buildSalesManagerView({
      snapshot: getPeakOutfittersSnapshot(),
      profitDashboard: computeProfitDashboard(getPeakOutfittersSnapshot(), []),
    });

    const margins = view.v2.orders.map((o) => o.marginPct);
    const profitable = margins.filter((m) => m > 10).length;
    const losing = margins.filter((m) => m < 0).length;

    expect(profitable).toBeGreaterThan(0);
    expect(losing).toBeGreaterThan(0);
    expect(new Set(margins).size).toBeGreaterThan(3);
    expect(view.v2.orderHighlights.length).toBeGreaterThan(0);
    expect(view.v2.orders[0].breakdown.netProfit).toBe(view.v2.orders[0].profit);
    expect(view.v2.orders.filter((o) => o.badges.length > 0).length).toBeGreaterThan(0);
  });

  it("recovery estimates use shared engine caps", () => {
    const view = buildSalesManagerView({
      snapshot: getPeakOutfittersSnapshot(),
      profitDashboard: computeProfitDashboard(getPeakOutfittersSnapshot(), []),
    });

    for (const opp of view.v2.opportunities) {
      expect(opp.recoveryProbabilityPct).toBeGreaterThan(0);
      expect(opp.recoveryProbabilityPct).toBeLessThanOrEqual(100);
    }
  });
});
