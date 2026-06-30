import { describe, expect, it } from "vitest";
import { resolveExecutionAvailability } from "@/lib/execution/availability";

describe("resolveExecutionAvailability", () => {
  it("requires write_discounts for Shopify automatic discount actions", () => {
    const withScopes = resolveExecutionAvailability({
      futureAction: "create_automatic_discount",
      platform: "shopify",
      entityId: "gid://shopify/Product/1",
      shopifyConnected: true,
      shopifyScopes: ["read_products", "write_products", "write_discounts"],
    });
    expect(withScopes).toBe("one_click");

    const missingDiscountScope = resolveExecutionAvailability({
      futureAction: "create_automatic_discount",
      platform: "shopify",
      entityId: "gid://shopify/Product/1",
      shopifyConnected: true,
      shopifyScopes: ["read_products", "write_products"],
    });
    expect(missingDiscountScope).toBe("manual");
  });
});
