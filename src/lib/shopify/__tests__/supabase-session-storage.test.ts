import { Session } from "@shopify/shopify-api";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  __clearMemoryAuthSessionsForTests,
  SupabaseSessionStorage,
} from "@/lib/shopify/supabase-session-storage";

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseAdmin: () => null,
}));

vi.mock("@/lib/db/shopify", () => ({
  findStoreByShopDomain: vi.fn(async () => "store-1"),
  createStoreForShop: vi.fn(async () => "store-1"),
  getInstallationByShopDomain: vi.fn(async (shop: string) => ({
    id: "inst-1",
    store_id: "store-1",
    shop_domain: shop,
    shop_name: shop,
    shopify_plan: null,
    scopes: ["read_products"],
    status: "active",
    connection_health: "healthy",
    error_message: null,
    installed_at: new Date().toISOString(),
    uninstalled_at: null,
    last_sync_at: null,
    sync_stats: {},
    accessToken: "shpat_offline_token",
    refreshToken: null,
    refreshTokenExpires: null,
  })),
  upsertShopifyInstallation: vi.fn(async () => ({
    id: "inst-1",
    store_id: "store-1",
    shop_domain: "beta.myshopify.com",
    shop_name: "beta",
    shopify_plan: null,
    scopes: ["read_products"],
    status: "active",
    connection_health: "healthy",
    error_message: null,
    installed_at: new Date().toISOString(),
    uninstalled_at: null,
    last_sync_at: null,
    sync_stats: {},
  })),
}));

describe("SupabaseSessionStorage", () => {
  beforeEach(() => {
    __clearMemoryAuthSessionsForTests();
  });

  it("persists offline sessions via shopify_installations", async () => {
    const storage = new SupabaseSessionStorage();
    const { upsertShopifyInstallation } = await import("@/lib/db/shopify");

    const session = new Session({
      id: "offline_beta.myshopify.com",
      shop: "beta.myshopify.com",
      state: "",
      isOnline: false,
      scope: "read_products",
      accessToken: "shpat_new_token",
    });

    await storage.storeSession(session);
    expect(upsertShopifyInstallation).toHaveBeenCalledWith(
      expect.objectContaining({
        shopDomain: "beta.myshopify.com",
        accessToken: "shpat_new_token",
      }),
    );
  });

  it("loads offline sessions from shopify_installations", async () => {
    const storage = new SupabaseSessionStorage();
    const loaded = await storage.loadSession("offline_beta.myshopify.com");

    expect(loaded?.shop).toBe("beta.myshopify.com");
    expect(loaded?.accessToken).toBe("shpat_offline_token");
    expect(loaded?.isOnline).toBe(false);
  });

  it("stores transient online sessions in memory when Supabase is unavailable", async () => {
    const storage = new SupabaseSessionStorage();
    const online = new Session({
      id: "online_session_1",
      shop: "beta.myshopify.com",
      state: "test-state",
      isOnline: true,
      accessToken: "online-token",
    });

    await storage.storeSession(online);
    const loaded = await storage.loadSession("online_session_1");
    expect(loaded?.accessToken).toBe("online-token");
    expect(loaded?.isOnline).toBe(true);
  });
});
