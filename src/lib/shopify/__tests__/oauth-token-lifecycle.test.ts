import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  exchangeCodeForToken,
  tokenExpiryFromSeconds,
} from "@/lib/shopify/oauth";
import { upsertShopifyInstallation } from "@/lib/db/shopify";
import {
  emptyShopifyRefreshMetrics,
  refreshOfflineAccessTokenAfter401,
} from "@/lib/shopify/offline-token-refresh";

// Exercises the in-memory installation store so token persistence is asserted
// against the real upsert logic rather than a mock.
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseAdmin: () => null,
}));

const STORE_ID = "00000000-0000-4000-8000-000000000001";

function tokenResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Shopify offline token lifecycle", () => {
  const originalKey = process.env.SHOPIFY_API_KEY;
  const originalSecret = process.env.SHOPIFY_API_SECRET;
  const originalUrl = process.env.SHOPIFY_APP_URL;

  beforeEach(() => {
    process.env.SHOPIFY_API_KEY = "65ef315b32098769438404654f2d4688";
    process.env.SHOPIFY_API_SECRET = "shpss_test_secret_value_here_123456";
    process.env.SHOPIFY_APP_URL = "https://storepilot.example.com";
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.SHOPIFY_API_KEY = originalKey;
    process.env.SHOPIFY_API_SECRET = originalSecret;
    process.env.SHOPIFY_APP_URL = originalUrl;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("authorization code exchange", () => {
    it("requests an expiring offline token and captures the returned refresh fields", async () => {
      const fetchMock = vi.fn(
        async (_input: string | URL | Request, _init?: RequestInit) =>
          tokenResponse({
            access_token: "shpat_install01",
            scope: "read_products,read_orders",
            refresh_token: "shprt_install01",
            expires_in: 3600,
            refresh_token_expires_in: 7776000,
          }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await exchangeCodeForToken("install.myshopify.com", "code-1");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, init] = fetchMock.mock.calls[0]!;
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      });
      const requestBody = init?.body;
      expect(requestBody).toBeInstanceOf(URLSearchParams);
      const params = requestBody as URLSearchParams;
      expect(params.get("code")).toBe("code-1");
      expect(params.get("expiring")).toBe("1");

      expect(result.access_token).toBe("shpat_install01");
      expect(result.refresh_token).toBe("shprt_install01");
      expect(result.expires_in).toBe(3600);
      expect(result.refresh_token_expires_in).toBe(7776000);
    });

    it("still succeeds when Shopify returns no refresh_token", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          tokenResponse({ access_token: "shpat_legacy01", scope: "read_products" }),
        ),
      );

      const result = await exchangeCodeForToken("legacy.myshopify.com", "code-2");

      expect(result.access_token).toBe("shpat_legacy01");
      expect(result.refresh_token).toBeUndefined();
      expect(result.refresh_token_expires_in).toBeUndefined();
    });

    it("rejects a token payload with no access_token", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => tokenResponse({ scope: "read_products" })),
      );

      await expect(exchangeCodeForToken("broken.myshopify.com", "code-3")).rejects.toThrow(
        /no access_token/i,
      );
    });

    it("converts refresh_token_expires_in into an absolute expiry", () => {
      const expiry = tokenExpiryFromSeconds(7776000);
      expect(expiry).toBeInstanceOf(Date);
      expect(expiry!.getTime()).toBeGreaterThan(Date.now());
      expect(tokenExpiryFromSeconds(undefined)).toBeUndefined();
      expect(tokenExpiryFromSeconds(null)).toBeUndefined();
    });
  });

  describe("installation persistence", () => {
    it("stores the refresh token on a new installation", async () => {
      const installation = await upsertShopifyInstallation({
        storeId: STORE_ID,
        shopDomain: "fresh-install.myshopify.com",
        accessToken: "shpat_fresh01",
        scopes: ["read_products"],
        refreshToken: "shprt_fresh01",
        refreshTokenExpires: tokenExpiryFromSeconds(7776000),
      });

      expect(installation.refreshToken).toBe("shprt_fresh01");
      expect(installation.refreshTokenExpires).toBeInstanceOf(Date);
      expect(installation.status).toBe("active");
    });

    it("rotates both tokens when an existing store reconnects", async () => {
      const shopDomain = "reconnect.myshopify.com";

      const first = await upsertShopifyInstallation({
        storeId: STORE_ID,
        shopDomain,
        accessToken: "shpat_old01",
        scopes: ["read_products"],
        refreshToken: "shprt_old01",
      });
      expect(first.refreshToken).toBe("shprt_old01");

      const reconnected = await upsertShopifyInstallation({
        storeId: STORE_ID,
        shopDomain,
        accessToken: "shpat_new01",
        scopes: ["read_products", "read_orders"],
        refreshToken: "shprt_new01",
        refreshTokenExpires: tokenExpiryFromSeconds(7776000),
      });

      // A stale refresh token must not survive a reconnect, otherwise the
      // merchant stays permanently unrefreshable.
      expect(reconnected.refreshToken).toBe("shprt_new01");
      expect(reconnected.id).toBe(first.id);
      expect(reconnected.scopes).toContain("read_orders");
    });

    it("keeps the original installed_at across a reinstall while updating tokens", async () => {
      const shopDomain = "reinstall.myshopify.com";

      const first = await upsertShopifyInstallation({
        storeId: STORE_ID,
        shopDomain,
        accessToken: "shpat_first01",
        scopes: ["read_products"],
        refreshToken: "shprt_first01",
      });

      const reinstalled = await upsertShopifyInstallation({
        storeId: STORE_ID,
        shopDomain,
        accessToken: "shpat_second01",
        scopes: ["read_products"],
        refreshToken: "shprt_second01",
      });

      expect(reinstalled.installed_at).toBe(first.installed_at);
      expect(reinstalled.refreshToken).toBe("shprt_second01");
      expect(reinstalled.uninstalled_at).toBeNull();
    });

    it("never wipes a stored refresh token when a re-persist omits it", async () => {
      const shopDomain = "preserve.myshopify.com";

      await upsertShopifyInstallation({
        storeId: STORE_ID,
        shopDomain,
        accessToken: "shpat_keep01",
        scopes: ["read_products"],
        refreshToken: "shprt_keep01",
      });

      const rePersisted = await upsertShopifyInstallation({
        storeId: STORE_ID,
        shopDomain,
        accessToken: "shpat_keep02",
        scopes: ["read_products"],
      });

      expect(rePersisted.refreshToken).toBe("shprt_keep01");
    });
  });

  describe("expired offline access token", () => {
    it("refreshes and rotates the refresh token without requiring a reinstall", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          tokenResponse({
            access_token: "shpat_rotated01",
            refresh_token: "shprt_rotated01",
            expires_in: 3600,
            refresh_token_expires_in: 7776000,
          }),
        ),
      );

      const metrics = emptyShopifyRefreshMetrics();
      const result = await refreshOfflineAccessTokenAfter401({
        shopDomain: "expired.myshopify.com",
        installationId: "inst-expired",
        refreshToken: "shprt_stale01",
        metrics,
      });

      expect(result.status).toBe("refreshed");
      expect(result.merchantReauthorizationRequired).toBe(false);
      expect(result.tokens?.accessToken).toBe("shpat_rotated01");
      // Rotation: the returned refresh token must differ from the one sent.
      expect(result.tokens?.refreshToken).toBe("shprt_rotated01");
      expect(metrics.refreshSucceeded).toBe(true);
      expect(metrics.refreshFailed).toBe(false);
    });

    it("requires reauthorization when the store has no refresh token stored", async () => {
      const result = await refreshOfflineAccessTokenAfter401({
        shopDomain: "norefresh.myshopify.com",
        installationId: "inst-norefresh",
        refreshToken: null,
      });

      expect(result.status).toBe("reauthorization_required");
      expect(result.failureReason).toBe("missing_refresh_token");
    });
  });

  describe("failed refresh handling", () => {
    it("surfaces invalid_grant as reauthorization required", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          tokenResponse({ error: "invalid_grant", error_description: "refresh token revoked" }, 400),
        ),
      );

      const metrics = emptyShopifyRefreshMetrics();
      const result = await refreshOfflineAccessTokenAfter401({
        shopDomain: "revoked.myshopify.com",
        installationId: "inst-revoked",
        refreshToken: "shprt_revoked01",
        metrics,
      });

      expect(result.status).toBe("reauthorization_required");
      expect(result.failureReason).toBe("invalid_grant");
      expect(metrics.refreshFailed).toBe(true);
      expect(metrics.retrySucceeded).toBe(false);
    });

    it("does not accept an incomplete token pair from the refresh grant", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => tokenResponse({ access_token: "shpat_only01" })),
      );

      const result = await refreshOfflineAccessTokenAfter401({
        shopDomain: "incomplete.myshopify.com",
        installationId: "inst-incomplete",
        refreshToken: "shprt_incomplete01",
      });

      expect(result.status).toBe("reauthorization_required");
      expect(result.failureReason).toBe("incomplete_token_pair");
    });

    it("treats a transport failure as reauthorization required rather than retrying", async () => {
      const fetchMock = vi.fn(async () => {
        throw new Error("network unreachable");
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await refreshOfflineAccessTokenAfter401({
        shopDomain: "offline.myshopify.com",
        installationId: "inst-offline",
        refreshToken: "shprt_offline01",
      });

      expect(result.status).toBe("reauthorization_required");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
