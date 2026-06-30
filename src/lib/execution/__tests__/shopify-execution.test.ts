import { describe, expect, it, vi, beforeEach } from "vitest";
import { DEMO_STORE_SNAPSHOT } from "@/lib/connectors/demo-data";
import { getExecutionMode } from "@/lib/execution/config";
import { buildAutomaticDiscountRequest } from "@/lib/shopify/mutations/discount";
import { buildAddToCollectionRequest } from "@/lib/shopify/mutations/collection";
import { buildBundleConfigurationRequest } from "@/lib/shopify/mutations/bundle";

vi.mock("@/lib/db/shopify", () => ({
  getInstallationByStoreId: vi.fn(async () => ({
    id: "shop-inst-1",
    store_id: "demo-store",
    shop_domain: "demo.myshopify.com",
    shop_name: "Demo Shop",
    shopify_plan: "Basic",
    scopes: ["read_products", "write_products", "write_discounts"],
    status: "active",
    connection_health: "healthy",
    error_message: null,
    installed_at: new Date().toISOString(),
    uninstalled_at: null,
    last_sync_at: null,
    sync_stats: {
      productCount: 7,
      inventoryCount: 7,
      orderCount: 100,
      customerCount: 50,
      collectionCount: 4,
      discountCount: 2,
    },
    accessToken: "shpat_test",
  })),
  updateShopifySyncResult: vi.fn(async () => undefined),
}));

vi.mock("@/lib/connectors/registry", () => ({
  aggregateStoreSnapshot: vi.fn(async () => DEMO_STORE_SNAPSHOT),
}));

vi.mock("@/lib/shopify/mutations/discount", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/shopify/mutations/discount")>();
  return {
    ...actual,
    createAutomaticDiscountLive: vi.fn(async () => ({
      id: "gid://shopify/DiscountAutomaticNode/1",
      response: { success: true },
    })),
    createDiscountCodeLive: vi.fn(async () => ({
      id: "gid://shopify/DiscountCodeNode/1",
      response: { success: true },
    })),
  };
});

vi.mock("@/lib/shopify/mutations/collection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/shopify/mutations/collection")>();
  return {
    ...actual,
    addProductToCollectionLive: vi.fn(async () => ({
      response: { collection: { id: "gid://shopify/Collection/po-clearance", title: "Clearance Gear" } },
    })),
  };
});

vi.mock("@/lib/shopify/mutations/product-visibility", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/shopify/mutations/product-visibility")>();
  return {
    ...actual,
    fetchProductStatus: vi.fn(async () => ({
      id: "gid://shopify/Product/1007",
      title: "Summit Ice Axe (Clearance)",
      status: "DRAFT",
    })),
    updateProductVisibilityLive: vi.fn(async () => ({
      response: { product: { status: "ACTIVE" } },
    })),
  };
});

vi.mock("@/lib/shopify/sync", () => ({
  syncShopifyStore: vi.fn(async () => ({
    snapshot: DEMO_STORE_SNAPSHOT,
    stats: {},
    shopName: "Demo",
    shopifyPlan: "Basic",
  })),
}));

vi.mock("@/lib/db/action-executions", () => ({
  insertActionExecution: vi.fn(async (input) => ({
    id: "log-shopify-1",
    storeId: input.storeId,
    decisionId: input.decisionId ?? null,
    recommendationId: input.recommendationId ?? null,
    opportunityKey: input.opportunityKey ?? null,
    actionType: input.actionType,
    platform: input.platform,
    entityType: input.entityType,
    entityId: input.entityId,
    entityName: input.entityName,
    executionMode: input.executionMode,
    status: input.status,
    approvedBy: input.approvedBy ?? "Merchant",
    requestPayload: input.requestPayload,
    responsePayload: input.responsePayload ?? null,
    errorMessage: input.errorMessage ?? null,
    executedAt: new Date().toISOString(),
  })),
}));

describe("Shopify execution", () => {
  beforeEach(() => {
    vi.stubEnv("STOREPILOT_EXECUTION_MODE", "dry_run");
  });

  it("defaults to dry run mode", () => {
    expect(getExecutionMode()).toBe("dry_run");
  });

  it("builds automatic discount request with product scope", () => {
    const product = DEMO_STORE_SNAPSHOT.products.find((p) => p.title === "Summit Ice Axe (Clearance)")!;
    const request = buildAutomaticDiscountRequest({
      productIds: [product.id],
      productName: product.title,
      discountPercent: 15,
      startsAt: "2026-06-26T00:00:00.000Z",
      endsAt: "2026-07-10T00:00:00.000Z",
    });

    expect(request.mutation).toBe("discountAutomaticBasicCreate");
    expect(request.discountPercent).toBe(15);
    expect(request.productIds).toEqual([product.id]);
    expect(request.variables.automaticBasicDiscount.customerGets.value.percentage).toBe(0.15);
    expect(request.variables.automaticBasicDiscount.customerGets.items.products.productsToAdd).toEqual([
      product.id,
    ]);
  });

  it("builds automatic discount request for multiple products", () => {
    const products = DEMO_STORE_SNAPSHOT.products.slice(0, 2);
    const request = buildAutomaticDiscountRequest({
      productIds: products.map((p) => p.id),
      productName: "2 products",
      discountPercent: 15,
      startsAt: "2026-06-26T00:00:00.000Z",
      endsAt: "2026-07-03T00:00:00.000Z",
    });

    expect(request.productIds).toHaveLength(2);
    expect(request.variables.automaticBasicDiscount.title).toContain("2 products");
    expect(request.variables.automaticBasicDiscount.customerGets.items.products.productsToAdd).toHaveLength(2);
  });

  it("validates and logs automatic discount in dry run", async () => {
    const { executeCreateAutomaticDiscount } = await import(
      "@/lib/execution/shopify/create-automatic-discount"
    );
    const product = DEMO_STORE_SNAPSHOT.products.find((p) => p.title === "Summit Ice Axe (Clearance)")!;

    const outcome = await executeCreateAutomaticDiscount({
      storeId: "demo-store",
      actionType: "create_automatic_discount",
      platform: "shopify",
      entityType: "product",
      entityId: product.id,
      entityName: product.title,
      opportunityKey: "shop-dead-inv-1",
      approvedBy: "Merchant",
      params: { discountPercent: 15, durationDays: 14 },
    });

    expect(outcome.success).toBe(true);
    expect(outcome.executed).toBe(false);
    expect(outcome.status).toBe("ready");
    expect(outcome.message).toContain("ready to be executed");
  });

  it("builds bundle configuration with both product IDs", () => {
    const primary = DEMO_STORE_SNAPSHOT.products.find((p) => p.tags.includes("bundle-candidate"))!;
    const partner = DEMO_STORE_SNAPSHOT.products.find(
      (p) => p.id !== primary.id && p.tags.includes("bundle-candidate"),
    )!;

    const request = buildBundleConfigurationRequest({
      primaryProductId: primary.id,
      primaryProductName: primary.title,
      partnerProductId: partner.id,
      partnerProductName: partner.title,
      discountPercent: 10,
      startsAt: "2026-06-26T00:00:00.000Z",
      endsAt: "2026-07-26T00:00:00.000Z",
    });

    expect(request.productIds).toHaveLength(2);
    expect(request.discountRequest.variables.automaticBasicDiscount.customerGets.items.products.productsToAdd).toEqual(
      [primary.id, partner.id],
    );
  });

  it("validates add to collection in dry run", async () => {
    const { executeAddToCollection } = await import("@/lib/execution/shopify/add-to-collection");
    const product = DEMO_STORE_SNAPSHOT.products.find((p) => p.title === "Mountain Pro Backpack 65L")!;
    const collection = DEMO_STORE_SNAPSHOT.collections.find((c) => c.title === "Clearance Gear")!;

    const outcome = await executeAddToCollection({
      storeId: "demo-store",
      actionType: "add_to_collection",
      platform: "shopify",
      entityType: "product",
      entityId: product.id,
      entityName: product.title,
      params: { collectionId: collection.id, collectionName: collection.title },
    });

    expect(outcome.success).toBe(true);
    expect(outcome.executed).toBe(false);
    expect((outcome.request as ReturnType<typeof buildAddToCollectionRequest>).collectionName).toBe(
      "Clearance Gear",
    );
  });

  it("never executes blocked price update actions", async () => {
    const { executeShopifyAction } = await import("@/lib/execution/shopify/dispatch");
    const product = DEMO_STORE_SNAPSHOT.products[0];

    const outcome = await executeShopifyAction({
      storeId: "demo-store",
      actionType: "update_product_price",
      platform: "shopify",
      entityType: "product",
      entityId: product.id,
      entityName: product.title,
    });

    expect(outcome).toBeNull();
  });
});
