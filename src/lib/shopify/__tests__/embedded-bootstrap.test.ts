import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateAdmin = vi.fn();
const persistInstallation = vi.fn();
const getActiveStoreId = vi.fn();

vi.mock("@/lib/shopify/shopify-app.server", () => ({
  getShopifyApp: () => ({
    authenticate: { admin: (...args: unknown[]) => authenticateAdmin(...args) },
  }),
}));

vi.mock("@/lib/shopify/persist-installation.server", () => ({
  persistInstallationFromSession: (...args: unknown[]) => persistInstallation(...args),
}));

vi.mock("@/lib/db/shopify", () => ({
  getActiveStoreIdForShopDomain: (...args: unknown[]) => getActiveStoreId(...args),
}));

import { runEmbeddedShopifyBootstrap } from "@/lib/shopify/embedded-bootstrap.server";

describe("runEmbeddedShopifyBootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveStoreId.mockResolvedValue(null);
  });

  it("skips non-embedded requests without calling authenticate.admin", async () => {
    const request = new Request("https://storepilot.example/api/shopify/bootstrap");
    const result = await runEmbeddedShopifyBootstrap(request);
    expect(result).toEqual({ skipped: true, reason: "not_embedded" });
    expect(authenticateAdmin).not.toHaveBeenCalled();
  });

  it("authenticates and persists for embedded shop requests", async () => {
    authenticateAdmin.mockResolvedValue({
      session: {
        id: "offline_demo.myshopify.com",
        shop: "demo.myshopify.com",
        accessToken: "shpat_test",
        isOnline: false,
        scope: "read_products",
      },
    });
    persistInstallation.mockResolvedValue({
      storeId: "store-1",
      shopDomain: "demo.myshopify.com",
      clientId: "abc",
      clientIdPrefix: "abc",
    });

    const request = new Request(
      "https://storepilot.example/api/shopify/bootstrap?shop=demo.myshopify.com&embedded=1",
    );
    const result = await runEmbeddedShopifyBootstrap(request);

    expect(authenticateAdmin).toHaveBeenCalledOnce();
    expect(persistInstallation).toHaveBeenCalledOnce();
    expect(result).toEqual({
      shop: "demo.myshopify.com",
      storeId: "store-1",
      sessionId: "offline_demo.myshopify.com",
      persisted: true,
    });
  });
});
