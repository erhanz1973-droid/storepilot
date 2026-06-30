import {
  computeInventoryHealthBreakdown,
  computeInventoryCoverageDays,
  isInventoryTrackingUnavailable,
} from "@/lib/inventory/summary";
import { describe, expect, it } from "vitest";

describe("inventory summary", () => {
  it("scores all-OOS inventory low with transparent factors", () => {
    const breakdown = computeInventoryHealthBreakdown(
      { totalProducts: 1, inStock: 0, outOfStock: 1, lowStock: 0, lowStockThreshold: 5 },
      [
        {
          segment: "out_of_stock",
          inventory: 0,
          velocityPerDay: 0.6,
          daysUntilStockout: 0,
        },
      ],
    );

    expect(breakdown.factors.find((f) => f.id === "availability")!.score).toBe(0);
    expect(breakdown.overall).toBeLessThan(50);
    expect(breakdown.factors).toHaveLength(4);
  });

  it("detects untracked inventory when all products are explicitly untracked", () => {
    expect(
      isInventoryTrackingUnavailable([
        {
          id: "1",
          title: "Test",
          inventoryQuantity: 0,
          unitsSold30d: 5,
          revenue30d: 100,
          price: 50,
          collectionIds: [],
          tags: [],
          inventoryTracked: false,
        },
      ]),
    ).toBe(true);
  });

  it("computes zero coverage when no in-stock velocity SKUs exist", () => {
    expect(
      computeInventoryCoverageDays([
        { inventory: 0, velocityPerDay: 0.6, daysUntilStockout: 0 },
      ]),
    ).toBe(0);
  });
});
