import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const shopifyGraphQL = vi.fn();
const shopifyGraphQLResult = vi.fn();

vi.mock("@/lib/shopify/graphql-client", () => ({
  shopifyGraphQL: (...args: unknown[]) => shopifyGraphQL(...args),
  shopifyGraphQLResult: (...args: unknown[]) => shopifyGraphQLResult(...args),
  paginateGraphQL: async (
    _shop: string,
    _token: string,
    query: string,
    extract: (data: Record<string, unknown>) => {
      nodes: unknown[];
      hasNextPage: boolean;
      endCursor: string | null;
    },
    merge: (acc: unknown[], nodes: unknown[]) => unknown[],
    initial: unknown[],
  ) => {
    const data = await shopifyGraphQL(_shop, _token, query);
    const page = extract(data as Record<string, unknown>);
    return merge(initial, page.nodes);
  },
}));

import { syncShopifyStore } from "@/lib/shopify/sync";

describe("syncShopifyStore optional discounts", () => {
  beforeEach(() => {
    shopifyGraphQL.mockImplementation(async (_shop, _token, query) => {
      if (query.includes("query ShopInfo")) {
        return {
          shop: {
            name: "Demo Shop",
            myshopifyDomain: "demo.myshopify.com",
            plan: { displayName: "Basic" },
            currencyCode: "USD",
          },
          customersCount: { count: 2 },
        };
      }
      if (query.includes("query Products")) {
        return {
          products: {
            edges: [],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        };
      }
      if (query.includes("query Orders")) {
        return {
          orders: {
            edges: [],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        };
      }
      if (query.includes("query Collections")) {
        return {
          collections: {
            edges: [],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        };
      }
      throw new Error(`Unexpected query: ${query}`);
    });

    shopifyGraphQLResult.mockResolvedValue({
      data: undefined,
      errors: [
        {
          message: "Access denied for discountNodes field. Required access: read_discounts",
          path: ["discountNodes"],
        },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("completes sync when discountNodes is access denied", async () => {
    const result = await syncShopifyStore("demo.myshopify.com", "shpat_test");

    expect(result.stats.productCount).toBe(0);
    expect(result.stats.orderCount).toBe(0);
    expect(result.stats.customerCount).toBe(2);
    expect(result.stats.discountCount).toBe(0);
    expect(result.stats.discountsUnavailable).toBe(true);
    expect(result.shopName).toBe("Demo Shop");
    expect(result.snapshot.products).toEqual([]);
  });
});
