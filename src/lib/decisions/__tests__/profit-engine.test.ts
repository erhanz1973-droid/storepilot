import { describe, expect, it } from "vitest";
import { compareSlowProductStrategies } from "@/lib/decisions/strategy-comparison";
import { simulateDiscount, simulateBundleOffer } from "@/lib/decisions/product-economics";

const slowProduct = {
  productId: "p1",
  title: "Slow Serum",
  price: 40,
  unitCost: 12,
  unitsSold30d: 8,
  inventory: 120,
  inventoryAgeDays: 90,
  costSource: "shopify" as const,
};

describe("product-economics", () => {
  it("prefers higher net profit for bundle vs deep discount on margin", () => {
    const discount = simulateDiscount(slowProduct, 0.15);
    const bundle = simulateBundleOffer(slowProduct);
    expect(bundle.expectedNetProfit).toBeGreaterThanOrEqual(discount.expectedNetProfit * 0.8);
  });
});

describe("strategy-comparison", () => {
  it("does not auto-pick highest revenue strategy in profit mode", () => {
    const result = compareSlowProductStrategies({
      product: slowProduct,
      merchantMode: "profit",
    });

    const highestRevenue = [...result.strategies].sort(
      (a, b) => b.expectedRevenue - a.expectedRevenue,
    )[0];

    if (highestRevenue.strategyId !== result.recommended.strategyId) {
      expect(result.recommended.expectedNetProfit).toBeGreaterThanOrEqual(
        highestRevenue.expectedNetProfit,
      );
    }

    expect(result.explanation).toContain("Recommended:");
    expect(result.strategies.length).toBe(7);
  });

  it("ranks cash recovery higher in cash flow mode", () => {
    const profit = compareSlowProductStrategies({ product: slowProduct, merchantMode: "profit" });
    const cash = compareSlowProductStrategies({ product: slowProduct, merchantMode: "cash_flow" });
    expect(cash.recommended.strategyId).toBeTruthy();
    expect(profit.recommended.strategyId).toBeTruthy();
  });
});
