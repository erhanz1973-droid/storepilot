import { analyzeInventoryContext, inventoryCrossModuleImpact } from "@/lib/attribution/inventory-context";
import type { StoreSnapshot } from "@/lib/connectors/types";
import { describe, expect, it } from "vitest";

describe("inventory context for attribution", () => {
  it("flags critical inventory when entire catalog is out of stock", () => {
    const snapshot = {
      products: [
        { id: "1", title: "A", inventoryQuantity: 0, unitsSold30d: 10, revenue30d: 100, price: 10 },
        { id: "2", title: "B", inventoryQuantity: 0, unitsSold30d: 5, revenue30d: 50, price: 10 },
      ],
    } as unknown as StoreSnapshot;

    const ctx = analyzeInventoryContext(snapshot);
    expect(ctx.severity).toBe("critical");
    expect(ctx.oosPct).toBe(100);

    const impact = inventoryCrossModuleImpact(ctx, "Increase Prospecting budget by 20%");
    expect(impact.headline).toBe("Critical Risk");
    expect(impact.detail).toContain("100% of tracked inventory is out of stock");
    expect(impact.detail).toContain("not recommended");
  });
});
