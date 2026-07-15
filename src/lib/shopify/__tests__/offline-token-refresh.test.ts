import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyRefreshFailure,
  emptyShopifyRefreshMetrics,
  refreshOfflineAccessTokenAfter401,
  refreshShopifyOfflineAccessToken,
} from "@/lib/shopify/offline-token-refresh";
import { ShopifyMerchantReauthorizationRequiredError } from "@/lib/shopify/auth-errors";

describe("offline token refresh", () => {
  const originalKey = process.env.SHOPIFY_API_KEY;
  const originalSecret = process.env.SHOPIFY_API_SECRET;
  const originalUrl = process.env.SHOPIFY_APP_URL;

  beforeEach(() => {
    process.env.SHOPIFY_API_KEY = "65ef315b32098769438404654f2d4688";
    process.env.SHOPIFY_API_SECRET = "shpss_test_secret_value_here_123456";
    process.env.SHOPIFY_APP_URL = "https://storepilot.example.com";
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.SHOPIFY_API_KEY = originalKey;
    process.env.SHOPIFY_API_SECRET = originalSecret;
    process.env.SHOPIFY_APP_URL = originalUrl;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("exchanges refresh_token for a new offline access token pair", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            access_token: "shpat_newtoken12",
            refresh_token: "shprt_newrefresh",
            expires_in: 3600,
            refresh_token_expires_in: 7776000,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await refreshShopifyOfflineAccessToken(
      "beta.myshopify.com",
      "shprt_oldrefresh",
    );
    expect(result.accessToken).toBe("shpat_newtoken12");
    expect(result.refreshToken).toBe("shprt_newrefresh");
    expect(result.expiresIn).toBe(3600);
  });

  it("returns reauthorization_required when no refresh token is stored", async () => {
    const metrics = emptyShopifyRefreshMetrics();
    const result = await refreshOfflineAccessTokenAfter401({
      shopDomain: "beta.myshopify.com",
      installationId: "inst-1",
      refreshToken: null,
      tokenFingerprint: "shpat_stale01",
      metrics,
    });
    expect(result.status).toBe("reauthorization_required");
    expect(result.merchantReauthorizationRequired).toBe(true);
    expect(result.failureReason).toBe("missing_refresh_token");
    expect(metrics.refreshAttempted).toBe(true);
    expect(metrics.refreshFailed).toBe(true);
  });

  it("maps invalid_grant to merchant reauthorization without throwing past the attempt helper", async () => {
    const metrics = emptyShopifyRefreshMetrics();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "invalid_grant" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const result = await refreshOfflineAccessTokenAfter401({
      shopDomain: "beta.myshopify.com",
      refreshToken: "shprt_dead",
      metrics,
    });

    expect(result).toMatchObject({
      status: "reauthorization_required",
      merchantReauthorizationRequired: true,
      failureReason: "invalid_grant",
    });
    expect(metrics.refreshFailed).toBe(true);
  });

  it("throws ShopifyMerchantReauthorizationRequiredError from direct refresh on invalid_grant", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "invalid_grant" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      refreshShopifyOfflineAccessToken("beta.myshopify.com", "shprt_dead"),
    ).rejects.toBeInstanceOf(ShopifyMerchantReauthorizationRequiredError);
  });

  it("classifies common refresh failure bodies", () => {
    expect(classifyRefreshFailure(400, '{"error":"invalid_grant"}')).toBe("invalid_grant");
    expect(classifyRefreshFailure(400, "refresh token expired")).toBe("expired_refresh_token");
    expect(classifyRefreshFailure(500, "upstream")).toBe("refresh_http_error");
  });
});
