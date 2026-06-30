import { PEAK_OUTFITTERS_BASE_SNAPSHOT } from "@/lib/demo/peak-outfitters";
import { computeProfitDashboard } from "@/lib/profit/engine";
import {
  buildProductAttributionDashboard,
  summarizeProductAttributionForAi,
} from "@/lib/attribution/product-engine";
import { describe, expect, it } from "vitest";

describe("product attribution engine", () => {
  const profitDashboard = computeProfitDashboard(PEAK_OUTFITTERS_BASE_SNAPSHOT, [])!;
  const dashboard = buildProductAttributionDashboard(
    PEAK_OUTFITTERS_BASE_SNAPSHOT,
    [],
    profitDashboard,
  )!;

  it("assigns campaign-level ad spend to linked products", () => {
    const backpack = dashboard.byProductId["gid://shopify/Product/po-1001"];
    expect(backpack).toBeDefined();
    expect(backpack!.adCost.metaSpend).toBeGreaterThan(0);
    expect(backpack!.campaigns.length).toBeGreaterThan(0);
    expect(backpack!.confidencePct).toBeGreaterThanOrEqual(60);
  });

  it("labels estimated vs verified methods transparently", () => {
    const methods = new Set(dashboard.products.map((p) => p.method));
    expect(methods.has("campaign_attribution") || methods.has("revenue_allocation")).toBe(
      true,
    );
    for (const p of dashboard.products) {
      expect(p.methodLabel.length).toBeGreaterThan(0);
    }
  });

  it("builds dashboard widgets", () => {
    expect(dashboard.widgets.topByProfit.products.length).toBeGreaterThan(0);
    expect(dashboard.widgets.losingMoney.products.length).toBeGreaterThanOrEqual(0);
    expect(dashboard.overallConfidencePct).toBeGreaterThan(0);
  });

  it("summarizes for AI with attribution transparency", () => {
    const summary = summarizeProductAttributionForAi(dashboard);
    expect(summary).toContain("attribution confidence");
    expect(summary.length).toBeGreaterThan(40);
  });

  it("never assigns negative ad spend", () => {
    for (const p of dashboard.products) {
      expect(p.adCost.totalSpend ?? 0).toBeGreaterThanOrEqual(0);
    }
  });
});
