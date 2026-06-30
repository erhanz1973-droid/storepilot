import { buildProductAttributionDashboard } from "@/lib/attribution/product-engine";
import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildProductIntelligence } from "@/lib/products/engine";
import { assembleProductsPageView, filterProducts } from "@/lib/products/page-view";
import { deriveProductRecommendation } from "@/lib/products/recommendations";
import { describe, expect, it } from "vitest";

describe("products page view", () => {
  const snapshot = getPeakOutfittersSnapshot();
  const profitDashboard = computeProfitDashboard(snapshot, [])!;
  const attribution = buildProductAttributionDashboard(snapshot, [], profitDashboard)!;
  const intelligence = buildProductIntelligence(snapshot, [], profitDashboard, attribution)!;

  const view = assembleProductsPageView(intelligence, attribution, snapshot, profitDashboard);

  it("builds executive summary with counts", () => {
    expect(view.executiveSummary.totalProducts).toBeGreaterThanOrEqual(30);
    expect(view.executiveSummary.activeProducts).toBeGreaterThan(0);
    expect(view.executiveSummary.profitable).toBeGreaterThan(0);
    expect(view.executiveSummary.highestProfitProduct).not.toBeNull();
  });

  it("generates multiple recovery opportunities with reasoning", () => {
    expect(view.recovery.opportunities.length).toBeGreaterThan(1);
    expect(view.recovery.totalMonthlyRecovery).toBeGreaterThan(0);
    expect(view.recovery.opportunities[0]!.reasoning.length).toBeGreaterThan(0);
    expect(view.recovery.opportunities[0]!.action.length).toBeGreaterThan(0);
  });

  it("enriches products with lifecycle and health breakdown", () => {
    const first = view.products[0]!;
    expect(first.recommendation.badge).toBeDefined();
    expect(first.lifecycleStage).toBeDefined();
    expect(first.healthBreakdown.length).toBeGreaterThan(0);
    expect(first.merchandisingInsights.length).toBeGreaterThanOrEqual(0);
    expect(first.sku).toMatch(/^PO-/);
    expect(first.collectionTitle).not.toBe("");
    expect(first.inventoryHistory.length).toBeGreaterThan(0);
  });

  it("links recovery opportunity SKUs to catalog rows with matching recommendations", () => {
    for (const opp of view.recovery.opportunities) {
      const product = view.products.find((p) => p.productId === opp.productId);
      expect(product).toBeDefined();
      expect(product!.recommendation.badge).toBe(opp.badge);
      expect(product!.title).toBe(opp.productTitle);
    }
  });

  it("filters organic winners", () => {
    const organic = filterProducts(view.products, "organic_winners");
    for (const p of organic) {
      expect(p.isOrganicWinner).toBe(true);
    }
  });

  it("derives pause advertising for out-of-stock products with ad spend", () => {
    const oos = view.products.find((p) => p.displayStatus === "Out of Stock" && p.adCost > 0);
    if (oos) {
      const rec = deriveProductRecommendation(oos, oos.attribution);
      expect(rec.badge).toBe("pause_advertising");
      expect(rec.reasoning.some((r) => r.toLowerCase().includes("stock"))).toBe(true);
    }
  });
});
