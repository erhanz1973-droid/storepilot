import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findStoreByShopDomain: vi.fn(),
  getCachedShopifySnapshot: vi.fn(),
  getInstallationByShopDomain: vi.fn(),
  purgeShopifyInstallationData: vi.fn(),
  updateShopifySyncResult: vi.fn(),
  deleteAuthSessionsForShop: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/db/shopify", () => ({
  findStoreByShopDomain: mocks.findStoreByShopDomain,
  getCachedShopifySnapshot: mocks.getCachedShopifySnapshot,
  getInstallationByShopDomain: mocks.getInstallationByShopDomain,
  purgeShopifyInstallationData: mocks.purgeShopifyInstallationData,
  updateShopifySyncResult: mocks.updateShopifySyncResult,
}));

vi.mock("@/lib/shopify/supabase-session-storage", () => ({
  deleteAuthSessionsForShop: mocks.deleteAuthSessionsForShop,
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseAdmin: mocks.getSupabaseAdmin,
}));

import {
  handleCustomersDataRequest,
  handleCustomersRedact,
  handleShopRedact,
} from "@/lib/shopify/gdpr";

describe("GDPR handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseAdmin.mockReturnValue(null);
    mocks.getInstallationByShopDomain.mockResolvedValue(null);
    mocks.findStoreByShopDomain.mockResolvedValue("store-1");
    mocks.updateShopifySyncResult.mockResolvedValue(undefined);
    mocks.deleteAuthSessionsForShop.mockResolvedValue(undefined);
    mocks.purgeShopifyInstallationData.mockResolvedValue({
      purged: [{ shopDomain: "test.myshopify.com", storeId: "store-1" }],
    });
  });

  it("data_request collects matching customer orders from sync cache", async () => {
    mocks.getCachedShopifySnapshot.mockResolvedValue({
      commerceOrders: [
        {
          id: "gid://shopify/Order/1",
          externalId: "gid://shopify/Order/1",
          platform: "shopify",
          createdAt: "2026-01-01",
          revenue: 10,
          cogs: 0,
          shipping: 0,
          discounts: 0,
          refunds: 0,
          isNewCustomer: false,
          customerId: "191167",
          customerEmail: "john@example.com",
          lines: [],
        },
        {
          id: "gid://shopify/Order/2",
          externalId: "gid://shopify/Order/2",
          platform: "shopify",
          createdAt: "2026-01-02",
          revenue: 20,
          cogs: 0,
          shipping: 0,
          discounts: 0,
          refunds: 0,
          isNewCustomer: false,
          customerId: "other",
          customerEmail: "other@example.com",
          lines: [],
        },
      ],
    });

    const result = await handleCustomersDataRequest({
      shop_id: 954889,
      shop_domain: "test.myshopify.com",
      customer: { id: 191167, email: "john@example.com" },
      orders_requested: [1],
      data_request: { id: 9999 },
    });

    expect(result.action).toBe("data_export_prepared");
    expect(result.details.orderCount).toBe(1);
    expect(result.details.emailCount).toBe(1);
    expect(result.details.customerEmailMasked).toBe("j***@example.com");
    expect(JSON.stringify(result.details)).not.toContain("john@example.com");
  });

  it("customers/redact anonymizes matching PII idempotently", async () => {
    mocks.getInstallationByShopDomain.mockResolvedValue({
      store_id: "store-1",
      sync_stats: {
        productCount: 0,
        inventoryCount: 0,
        orderCount: 1,
        customerCount: 1,
        collectionCount: 0,
        discountCount: 0,
      },
    });
    mocks.getCachedShopifySnapshot.mockResolvedValue({
      commerceOrders: [
        {
          id: "o1",
          externalId: "o1",
          platform: "shopify",
          createdAt: "2026-01-01",
          revenue: 10,
          cogs: 0,
          shipping: 0,
          discounts: 0,
          refunds: 0,
          isNewCustomer: false,
          customerId: "191167",
          customerEmail: "john@example.com",
          lines: [],
        },
      ],
      customerSnapshot: {
        dataTier: "record_level",
        storeAgeDays: 30,
        totalCustomers: 1,
        newCustomers30d: 0,
        returningCustomers30d: 0,
        repeatPurchaseRatePct: 0,
        aov: 10,
        aovStatus: "verified",
        customers: [
          {
            id: "191167",
            name: "John",
            email: "john@example.com",
            ordersCount: 1,
            revenue30d: 10,
            lifetimeRevenue: 10,
            ltv: 10,
            ltvStatus: "verified",
            aov: 10,
            lastPurchaseAt: "2026-01-01",
            firstPurchaseAt: "2026-01-01",
            segment: "new",
            status: "New",
            acquisitionSource: "unknown",
            acquisitionLabel: "Unknown",
            totalProfit: null,
            profitStatus: "unavailable",
            favoriteProducts: [],
            purchaseHistory: [],
            daysSinceLastPurchase: 1,
          },
        ],
      },
    });

    const result = await handleCustomersRedact({
      shop_id: 1,
      shop_domain: "test.myshopify.com",
      customer: { id: 191167, email: "john@example.com" },
    });

    expect(result.details.redactedOrderCount).toBe(1);
    expect(mocks.updateShopifySyncResult).toHaveBeenCalled();
    const nextSnapshot = mocks.updateShopifySyncResult.mock.calls[0]?.[2];
    expect(nextSnapshot.commerceOrders[0].customerEmail).toBeUndefined();
    expect(nextSnapshot.customerSnapshot.customers).toEqual([]);
  });

  it("shop/redact purges installation and auth sessions", async () => {
    const result = await handleShopRedact({
      shop_id: 1,
      shop_domain: "test.myshopify.com",
    });

    expect(mocks.deleteAuthSessionsForShop).toHaveBeenCalledWith("test.myshopify.com");
    expect(mocks.purgeShopifyInstallationData).toHaveBeenCalledWith({
      shopDomain: "test.myshopify.com",
    });
    expect(result.action).toBe("shop_data_purged");
  });
});
