import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Guards the legacy OAuth callback: install and reconnect both run through this
 * route, so a refresh token issued by Shopify must reach the installation row.
 * Dropping it here leaves the store unrefreshable until a manual reinstall.
 */

const OAUTH_STATE = "state-token-123";

type TokenExchangeResult = {
  access_token: string;
  scope: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
};

type InstallationInput = {
  storeId: string;
  shopDomain: string;
  accessToken: string;
  scopes: string[];
  clientId?: string;
  refreshToken?: string;
  refreshTokenExpires?: Date;
};

type SyncOptions = {
  storedClientId?: string | null;
  installationId?: string | null;
  refreshToken?: string | null;
};

type SyncLike = {
  stats: Record<string, number>;
  snapshot: Record<string, unknown>;
  shopName: string;
  shopifyPlan: string;
};

const SYNC_RESULT: SyncLike = {
  stats: {
    productCount: 1,
    inventoryCount: 0,
    orderCount: 0,
    customerCount: 0,
    collectionCount: 0,
    discountCount: 0,
  },
  snapshot: {},
  shopName: "Test Shop",
  shopifyPlan: "basic",
};

const mocks = vi.hoisted(() => ({
  upsertShopifyInstallation: vi.fn<(input: InstallationInput) => Promise<{ id: string }>>(),
  updateShopifySyncResult: vi.fn<(...args: unknown[]) => Promise<void>>(),
  findStoreByShopDomain: vi.fn<(shop: string) => Promise<string | null>>(),
  createStoreForShop: vi.fn<(shop: string, name: string) => Promise<string>>(),
  exchangeCodeForToken: vi.fn<(shop: string, code: string) => Promise<TokenExchangeResult>>(),
  registerAppWebhooks: vi.fn<(shop: string, token: string) => Promise<void>>(),
  syncShopifyStore:
    vi.fn<(shop: string, token: string, options?: SyncOptions) => Promise<SyncLike>>(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "shopify_oauth_state" ? { name, value: OAUTH_STATE } : undefined,
  }),
}));

vi.mock("@/lib/db/shopify", () => ({
  upsertShopifyInstallation: mocks.upsertShopifyInstallation,
  updateShopifySyncResult: mocks.updateShopifySyncResult,
  findStoreByShopDomain: mocks.findStoreByShopDomain,
  createStoreForShop: mocks.createStoreForShop,
}));

vi.mock("@/lib/shopify/oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/shopify/oauth")>();
  return {
    ...actual,
    // tokenExpiryFromSeconds / normalizeShopDomain stay real.
    getShopifyConfig: () => ({
      apiKey: "65ef315b32098769438404654f2d4688",
      apiSecret: "shpss_test_secret_value_here_123456",
      appUrl: "https://storepilot.example.com",
      scopes: "read_products",
    }),
    verifyOAuthHmac: () => true,
    exchangeCodeForToken: mocks.exchangeCodeForToken,
    registerAppWebhooks: mocks.registerAppWebhooks,
  };
});

vi.mock("@/lib/shopify/sync", () => ({
  syncShopifyStore: mocks.syncShopifyStore,
}));

vi.mock("@/lib/shopify/embedded-return-url", () => ({
  buildEmbeddedAdminReturnUrl: async () => "https://admin.shopify.com/store/test/apps/storepilot",
}));

vi.mock("@/lib/store/tenant-binding", () => ({
  tenantBindingCookie: () => null,
}));

vi.mock("@/lib/analytics/alpha-funnel", () => ({
  trackAlphaEvent: async () => undefined,
}));

function callbackRequest(shop: string): Request {
  const url = new URL("https://storepilot.example.com/api/shopify/callback");
  url.searchParams.set("shop", shop);
  url.searchParams.set("code", "auth-code-1");
  url.searchParams.set("state", OAUTH_STATE);
  url.searchParams.set("hmac", "deadbeef");
  return new Request(url);
}

function firstInstallationPayload(): InstallationInput {
  const call = mocks.upsertShopifyInstallation.mock.calls[0];
  if (!call) throw new Error("upsertShopifyInstallation was never called");
  return call[0];
}

describe("Shopify OAuth callback token persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.findStoreByShopDomain.mockResolvedValue("store-1");
    mocks.createStoreForShop.mockResolvedValue("store-1");
    mocks.upsertShopifyInstallation.mockResolvedValue({ id: "inst-1" });
    mocks.updateShopifySyncResult.mockResolvedValue(undefined);
    mocks.registerAppWebhooks.mockResolvedValue(undefined);
    mocks.syncShopifyStore.mockResolvedValue(SYNC_RESULT);
  });

  it("persists the refresh token and its expiry on a new installation", async () => {
    mocks.exchangeCodeForToken.mockResolvedValue({
      access_token: "shpat_new01",
      scope: "read_products,read_orders",
      refresh_token: "shprt_new01",
      expires_in: 3600,
      refresh_token_expires_in: 7776000,
    });

    const { GET } = await import("@/app/api/shopify/callback/route");
    await GET(callbackRequest("fresh-store.myshopify.com"));

    expect(mocks.upsertShopifyInstallation).toHaveBeenCalledTimes(1);
    const payload = firstInstallationPayload();
    expect(payload.accessToken).toBe("shpat_new01");
    expect(payload.refreshToken).toBe("shprt_new01");
    expect(payload.refreshTokenExpires).toBeInstanceOf(Date);
  });

  it("passes a rotated refresh token through when an existing store reconnects", async () => {
    mocks.exchangeCodeForToken.mockResolvedValue({
      access_token: "shpat_reconnect02",
      scope: "read_products",
      refresh_token: "shprt_reconnect02",
      expires_in: 3600,
      refresh_token_expires_in: 7776000,
    });

    const { GET } = await import("@/app/api/shopify/callback/route");
    await GET(callbackRequest("reconnect-store.myshopify.com"));

    expect(firstInstallationPayload().refreshToken).toBe("shprt_reconnect02");
    expect(mocks.createStoreForShop).not.toHaveBeenCalled();
  });

  it("forwards the refresh token to the post-install sync so a 401 can self-heal", async () => {
    mocks.exchangeCodeForToken.mockResolvedValue({
      access_token: "shpat_sync01",
      scope: "read_products",
      refresh_token: "shprt_sync01",
      expires_in: 3600,
      refresh_token_expires_in: 7776000,
    });

    const { GET } = await import("@/app/api/shopify/callback/route");
    await GET(callbackRequest("sync-store.myshopify.com"));

    expect(mocks.syncShopifyStore).toHaveBeenCalledTimes(1);
    const syncCall = mocks.syncShopifyStore.mock.calls[0];
    if (!syncCall) throw new Error("syncShopifyStore was never called");
    expect(syncCall[2]?.refreshToken).toBe("shprt_sync01");
  });

  it("completes installation when Shopify returns no refresh token", async () => {
    mocks.exchangeCodeForToken.mockResolvedValue({
      access_token: "shpat_legacy01",
      scope: "read_products",
    });

    const { GET } = await import("@/app/api/shopify/callback/route");
    const response = await GET(callbackRequest("legacy-store.myshopify.com"));

    const payload = firstInstallationPayload();
    expect(payload.accessToken).toBe("shpat_legacy01");
    // An omitted refresh token must not clear the stored one downstream.
    expect(payload.refreshToken).toBeUndefined();
    expect(payload.refreshTokenExpires).toBeUndefined();
    expect(response.status).toBeGreaterThanOrEqual(300);
  });
});
