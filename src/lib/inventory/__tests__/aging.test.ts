import { describe, expect, it } from "vitest";
import {
  classifyInventoryAging,
  DEFAULT_INVENTORY_AGING_THRESHOLDS,
  isDeadInventoryByAging,
  productAgeDays,
  resolveInventoryAgingThresholds,
} from "@/lib/inventory/aging";

const NOW = "2026-07-28T12:00:00.000Z";

function daysAgoIso(days: number): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

describe("inventory aging model", () => {
  it("labels 0–14 day products as New Product even with zero sales", () => {
    expect(
      classifyInventoryAging({
        createdAt: daysAgoIso(3),
        inventoryQuantity: 250,
        unitsSold30d: 0,
        now: NOW,
      }),
    ).toBe("new_product");
    expect(
      isDeadInventoryByAging({
        createdAt: daysAgoIso(0),
        inventoryQuantity: 100,
        unitsSold30d: 0,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("never labels New Product window as Dead Inventory", () => {
    for (let day = 0; day <= 14; day += 1) {
      expect(
        classifyInventoryAging({
          createdAt: daysAgoIso(day),
          inventoryQuantity: 80,
          unitsSold30d: 0,
          now: NOW,
        }),
      ).toBe("new_product");
    }
  });

  it("classifies Needs Attention and Slow Moving by age with no sales", () => {
    expect(
      classifyInventoryAging({
        createdAt: daysAgoIso(20),
        inventoryQuantity: 40,
        unitsSold30d: 0,
        now: NOW,
      }),
    ).toBe("needs_attention");

    expect(
      classifyInventoryAging({
        createdAt: daysAgoIso(60),
        inventoryQuantity: 40,
        unitsSold30d: 0,
        now: NOW,
      }),
    ).toBe("slow_moving");
  });

  it("requires 90+ days with no sales for Dead Inventory", () => {
    expect(
      classifyInventoryAging({
        createdAt: daysAgoIso(90),
        inventoryQuantity: 40,
        unitsSold30d: 0,
        now: NOW,
      }),
    ).toBe("dead_inventory");

    expect(
      classifyInventoryAging({
        createdAt: daysAgoIso(89),
        inventoryQuantity: 40,
        unitsSold30d: 0,
        now: NOW,
      }),
    ).toBe("slow_moving");
  });

  it("does not age-label products that are selling after the new window", () => {
    expect(
      classifyInventoryAging({
        createdAt: daysAgoIso(100),
        inventoryQuantity: 40,
        unitsSold30d: 12,
        now: NOW,
      }),
    ).toBeNull();
  });

  it("prefers firstInventoryAt over createdAt", () => {
    expect(
      productAgeDays({
        createdAt: daysAgoIso(100),
        firstInventoryAt: daysAgoIso(5),
        now: NOW,
      }),
    ).toBe(5);

    expect(
      classifyInventoryAging({
        createdAt: daysAgoIso(100),
        firstInventoryAt: daysAgoIso(5),
        inventoryQuantity: 40,
        unitsSold30d: 0,
        now: NOW,
      }),
    ).toBe("new_product");
  });

  it("avoids Dead Inventory when age is unknown (no create date)", () => {
    expect(
      classifyInventoryAging({
        inventoryQuantity: 250,
        unitsSold30d: 0,
        now: NOW,
      }),
    ).toBe("needs_attention");
    expect(
      isDeadInventoryByAging({
        inventoryQuantity: 250,
        unitsSold30d: 0,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("applies industry presets and merchant overrides", () => {
    const fashion = resolveInventoryAgingThresholds({ industry: "fashion" });
    expect(fashion.deadInventoryMinDays).toBe(60);

    const custom = resolveInventoryAgingThresholds({
      industry: "fashion",
      overrides: { deadInventoryMinDays: 45, newProductMaxDays: 5 },
    });
    expect(custom.newProductMaxDays).toBe(5);
    expect(custom.deadInventoryMinDays).toBe(45);

    expect(
      classifyInventoryAging({
        createdAt: daysAgoIso(65),
        inventoryQuantity: 20,
        unitsSold30d: 0,
        now: NOW,
        industry: "fashion",
      }),
    ).toBe("dead_inventory");
  });

  it("keeps default thresholds coherent", () => {
    const t = DEFAULT_INVENTORY_AGING_THRESHOLDS;
    expect(t.newProductMaxDays).toBeLessThan(t.needsAttentionMaxDays);
    expect(t.needsAttentionMaxDays).toBeLessThanOrEqual(t.slowMovingMaxDays);
    expect(t.deadInventoryMinDays).toBeGreaterThanOrEqual(t.needsAttentionMaxDays);
  });
});
