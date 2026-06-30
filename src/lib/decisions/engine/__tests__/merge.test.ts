import { describe, expect, it } from "vitest";
import type { DecisionItem } from "@/lib/decisions/center";
import {
  decisionProblemKey,
  filterShadowedByGroupedDeadInventory,
  mergeDuplicateDecisions,
} from "@/lib/decisions/engine/merge";
import { DEAD_INVENTORY_GROUP_KEY } from "@/lib/insights/business-action-groups";

function decision(overrides: Partial<DecisionItem> & { id: string }): DecisionItem {
  return {
    priority: "medium",
    summary: "Test",
    why: "Because",
    supportingMetrics: [],
    confidencePct: 70,
    estimatedImpactLabel: "$100",
    recommendedAction: "Review",
    status: "open",
    actionAvailable: false,
    executionAvailability: "manual",
    source: "insight",
    sourceId: overrides.id,
    priorityScore: 100,
    ...overrides,
  };
}

describe("decisionProblemKey", () => {
  it("uses groupKey for grouped actions", () => {
    const item = decision({
      id: "1",
      groupKey: DEAD_INVENTORY_GROUP_KEY,
      isGroupedAction: true,
    });
    expect(decisionProblemKey(item)).toBe(DEAD_INVENTORY_GROUP_KEY);
  });

  it("groups product slow inventory by entity", () => {
    const item = decision({
      id: "2",
      entityType: "product",
      entityId: "prod-1",
      summary: "Slow selling — Widget",
    });
    expect(decisionProblemKey(item)).toContain("prod-1");
  });
});

describe("mergeDuplicateDecisions", () => {
  it("merges items with the same problem key", () => {
    const a = decision({
      id: "a",
      groupKey: DEAD_INVENTORY_GROUP_KEY,
      isGroupedAction: true,
      priority: "high",
      supportingMetrics: [{ label: "Products", value: "14" }],
    });
    const b = decision({
      id: "b",
      groupKey: DEAD_INVENTORY_GROUP_KEY,
      isGroupedAction: true,
      priority: "medium",
      supportingMetrics: [{ label: "Tied-up value", value: "$5000" }],
    });

    const merged = mergeDuplicateDecisions([a, b]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.supportingMetrics).toHaveLength(2);
    expect(merged[0]?.priority).toBe("high");
  });
});

describe("filterShadowedByGroupedDeadInventory", () => {
  it("removes per-SKU recs covered by grouped dead inventory", () => {
    const grouped = decision({
      id: "g",
      groupKey: DEAD_INVENTORY_GROUP_KEY,
      summary: "Dead inventory",
      isGroupedAction: true,
    });
    const skuRec = decision({
      id: "r",
      entityType: "product",
      entityId: "sku-1",
      source: "recommendation",
      summary: "Slow selling SKU",
    });

    const filtered = filterShadowedByGroupedDeadInventory([grouped, skuRec], new Set(["sku-1"]));
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("g");
  });
});
