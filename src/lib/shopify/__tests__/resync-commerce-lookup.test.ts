import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getInstallationByStoreId: vi.fn(),
  getInstallationByShopDomain: vi.fn(),
  ensureShopifySyncIfNeeded: vi.fn(),
}));

vi.mock("@/lib/db/shopify", () => ({
  getInstallationByStoreId: mocks.getInstallationByStoreId,
  getInstallationByShopDomain: mocks.getInstallationByShopDomain,
}));

vi.mock("@/lib/shopify/ensure-sync.server", () => ({
  ensureShopifySyncIfNeeded: mocks.ensureShopifySyncIfNeeded,
}));

import {
  lookupShopifyInstallation,
  resyncShopifyCommerce,
} from "@/lib/shopify/resync-commerce.server";

const INSTALLATION = {
  id: "installation-1",
  store_id: "store-1",
  shop_domain: "test.myshopify.com",
  accessToken: "shpat_test",
  refreshToken: "shprt_test",
  clientId: "client-id",
};

describe("Shopify commerce installation lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.getInstallationByShopDomain.mockResolvedValue(INSTALLATION);
    mocks.getInstallationByStoreId.mockResolvedValue(INSTALLATION);
    mocks.ensureShopifySyncIfNeeded.mockResolvedValue({
      synced: true,
      skipped: false,
      reason: "synced",
    });
  });

  it("returns installation_found and continues processing", async () => {
    const lookup = await lookupShopifyInstallation({
      shopDomain: "test.myshopify.com",
    });

    expect(lookup.state).toBe("installation_found");

    const result = await resyncShopifyCommerce({
      shopDomain: "test.myshopify.com",
      source: "webhook:orders/create",
      force: true,
    });

    expect(result.reason).toBe("synced");
    expect(mocks.ensureShopifySyncIfNeeded).toHaveBeenCalledWith(
      expect.objectContaining({
        shop: "test.myshopify.com",
        storeId: "store-1",
        force: true,
      }),
    );
  });

  it("returns installation_not_found only for a confirmed missing row", async () => {
    mocks.getInstallationByShopDomain.mockResolvedValue(null);

    const lookup = await lookupShopifyInstallation({
      shopDomain: "missing.myshopify.com",
    });
    expect(lookup).toEqual({
      state: "installation_not_found",
      installation: null,
    });

    const result = await resyncShopifyCommerce({
      shopDomain: "missing.myshopify.com",
      source: "webhook:products/update",
      force: true,
    });

    expect(result).toEqual({
      synced: false,
      skipped: true,
      reason: "installation_not_found",
    });
    expect(mocks.ensureShopifySyncIfNeeded).not.toHaveBeenCalled();
  });

  it("returns installation_lookup_failed when the database read fails", async () => {
    mocks.getInstallationByShopDomain.mockRejectedValue(
      new Error("Failed to look up Shopify installation by domain: connection timeout"),
    );

    const lookup = await lookupShopifyInstallation({
      shopDomain: "test.myshopify.com",
    });
    expect(lookup).toMatchObject({
      state: "installation_lookup_failed",
      installation: null,
      error: expect.stringContaining("connection timeout"),
    });

    const result = await resyncShopifyCommerce({
      shopDomain: "test.myshopify.com",
      source: "webhook:inventory_levels/update",
      force: true,
    });

    expect(result).toMatchObject({
      synced: false,
      skipped: false,
      reason: "installation_lookup_failed",
      error: expect.stringContaining("connection timeout"),
    });
    expect(mocks.ensureShopifySyncIfNeeded).not.toHaveBeenCalled();
  });

  it("uses the same explicit states for store-id lookups", async () => {
    mocks.getInstallationByStoreId.mockResolvedValue(null);
    expect(await lookupShopifyInstallation({ storeId: "missing-store" })).toEqual({
      state: "installation_not_found",
      installation: null,
    });

    mocks.getInstallationByStoreId.mockRejectedValue(new Error("database unavailable"));
    expect(await lookupShopifyInstallation({ storeId: "store-1" })).toMatchObject({
      state: "installation_lookup_failed",
      error: "database unavailable",
    });
  });
});
