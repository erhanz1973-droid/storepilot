import { describe, expect, it } from "vitest";
import { dataQualityScore, runDataQualityChecks } from "../data-quality";
import type { StoreSnapshot } from "@/lib/connectors/types";

function minimalSnapshot(overrides: Partial<StoreSnapshot> = {}): StoreSnapshot {
  return {
    storeId: "test-store",
    storeMetrics: { revenue30d: 10000, orders30d: 50, aov30d: 200, conversionRate30d: 2.5 },
    products: [{ id: "p1", title: "Widget", inventoryQuantity: 10, price: 29, variants: [] }],
    campaigns: [],
    collections: [],
    connectorStates: {},
    ...overrides,
  } as StoreSnapshot;
}

describe("runDataQualityChecks", () => {
  it("flags negative revenue as critical", () => {
    const issues = runDataQualityChecks(
      minimalSnapshot({ storeMetrics: { revenue30d: -1, orders30d: 0, aov30d: 0, conversionRate30d: 0 } }),
      null,
    );
    expect(issues.some((i) => i.id === "revenue-negative" && i.severity === "critical")).toBe(true);
  });

  it("flags negative inventory", () => {
    const issues = runDataQualityChecks(
      minimalSnapshot({
        products: [{ id: "p1", title: "X", inventoryQuantity: -2, price: 10, variants: [] } as never],
      }),
      null,
    );
    expect(issues.some((i) => i.id === "inventory-negative")).toBe(true);
  });

  it("returns info when no issues", () => {
    const issues = runDataQualityChecks(minimalSnapshot(), null);
    expect(issues.some((i) => i.id === "quality-ok")).toBe(true);
    expect(dataQualityScore(issues)).toBe(98);
  });
});
