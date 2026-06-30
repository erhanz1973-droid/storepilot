import { describe, expect, it } from "vitest";
import type { ShopifyProduct } from "@/lib/connectors/types";
import {
  buildDeadInventoryBusinessAction,
  groupCommerceOpportunities,
  DEAD_INVENTORY_GROUP_ID,
} from "@/lib/insights/business-action-groups";
import { createCommerceOpportunity } from "@/lib/insights/opportunity-schema";

function deadProduct(id: string, title: string, inventory: number, sold = 0, price = 99): ShopifyProduct {
  return {
    id,
    title,
    inventoryQuantity: inventory,
    unitsSold30d: sold,
    revenue30d: 0,
    price,
    collectionIds: [],
    tags: [],
    imageUrl: "",
  };
}

describe("business action grouping", () => {
  it("builds one dead inventory business action for multiple SKUs", () => {
    const action = buildDeadInventoryBusinessAction([
      deadProduct("gid://shopify/Product/1", "Product A", 50, 0, 80),
      deadProduct("gid://shopify/Product/2", "Product B", 60, 2, 90),
      deadProduct("gid://shopify/Product/3", "Product C", 45, 1, 70),
    ]);

    expect(action).not.toBeNull();
    expect(action?.id).toBe(DEAD_INVENTORY_GROUP_ID);
    expect(action?.title).toBe("Dead inventory");
    expect(action?.description).toContain("3 products");
    expect(action?.isGroupedAction).toBe(true);
    expect(action?.affectedEntities).toHaveLength(3);
    expect(action?.executionParams?.productIds).toHaveLength(3);
    expect(action?.executionParams?.discountPercent).toBe(15);
    expect(action?.executionParams?.durationDays).toBe(7);
    expect(action?.supportingMetrics.some((m) => m.label === "Products affected" && m.value === "3")).toBe(
      true,
    );
  });

  it("merges legacy per-product dead inventory opportunities into one card", () => {
    const members = ["A", "B", "C"].map((name, i) =>
      createCommerceOpportunity({
        id: `shop-dead-inv-${i}`,
        source: "shopify",
        severity: "medium",
        confidence: 74,
        title: `Dead inventory — ${name}`,
        description: "Slow mover",
        recommendation: "Markdown",
        category: "inventory",
        supportingMetrics: [
          { label: "Inventory", value: "50" },
          { label: "30-day units sold", value: "0" },
          { label: "Tied-up value", value: "$4,000" },
        ],
        futureAction: "create_automatic_discount",
        relatedEntityType: "product",
        relatedEntityId: `gid://shopify/Product/${i}`,
      }),
    );

    const grouped = groupCommerceOpportunities(members);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].title).toBe("Dead inventory");
    expect(grouped[0].isGroupedAction).toBe(true);
    expect(grouped[0].memberOpportunityIds).toHaveLength(3);
    expect(grouped[0].executionParams?.productIds).toHaveLength(3);
  });
});
