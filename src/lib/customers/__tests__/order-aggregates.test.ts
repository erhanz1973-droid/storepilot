import type { CommerceOrder } from "@/lib/commerce/types";
import {
  aggregateCustomersFromOrders,
  customerOrderKey,
  inferAggregatesFromStoreMetrics,
} from "@/lib/customers/order-aggregates";
import { describe, expect, it } from "vitest";

function order(
  id: string,
  createdAt: string,
  email: string,
  revenue = 100,
): CommerceOrder {
  return {
    id,
    externalId: id,
    platform: "shopify",
    createdAt,
    revenue,
    cogs: 40,
    shipping: 5,
    discounts: 0,
    refunds: 0,
    isNewCustomer: false,
    customerEmail: email,
    lines: [{ productId: "p1", title: "Item", quantity: 1, revenue }],
  };
}

describe("order-aggregates", () => {
  it("derives distinct customer counts from order emails", () => {
    const now = new Date("2026-06-28T12:00:00Z");
    const orders = [
      order("o1", "2026-06-20T10:00:00Z", "new@test.com"),
      order("o2", "2026-06-15T10:00:00Z", "returning@test.com"),
      order("o3", "2026-05-01T10:00:00Z", "returning@test.com"),
      order("o4", "2026-06-10T10:00:00Z", "repeat@test.com"),
      order("o5", "2026-04-01T10:00:00Z", "repeat@test.com"),
    ];

    const agg = aggregateCustomersFromOrders(orders, { now, shopifyCustomersCount: 102 })!;

    expect(agg.totalCustomers).toBe(102);
    expect(agg.newCustomers30d).toBe(1);
    expect(agg.returningCustomers30d).toBe(2);
    expect(agg.fromOrderHistory).toBe(true);
    expect(agg.repeatPurchaseRatePct).toBeGreaterThan(0);
  });

  it("returns null when orders lack customer identifiers", () => {
    const orders: CommerceOrder[] = [
      {
        id: "o1",
        externalId: "o1",
        platform: "shopify",
        createdAt: "2026-06-01T10:00:00Z",
        revenue: 50,
        cogs: 20,
        shipping: 0,
        discounts: 0,
        refunds: 0,
        isNewCustomer: false,
        lines: [],
      },
    ];

    expect(aggregateCustomersFromOrders(orders)).toBeNull();
    expect(customerOrderKey(orders[0]!)).toBeNull();
  });

  it("falls back to store metrics estimates", () => {
    const agg = inferAggregatesFromStoreMetrics({
      orders30d: 120,
      aov30d: 125,
      shopifyCustomersCount: 102,
    });

    expect(agg.totalCustomers).toBe(102);
    expect(agg.aov30d).toBe(125);
    expect(agg.fromOrderHistory).toBe(false);
    expect(agg.repeatPurchaseRatePct).toBeNull();
  });
});
