import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ShopifyAccessTokenInvalidError,
  ShopifyMerchantReauthorizationRequiredError,
} from "@/lib/shopify/auth-errors";
import { shopifyGraphQL } from "@/lib/shopify/graphql-client";
import { emptyShopifyRefreshMetrics } from "@/lib/shopify/offline-token-refresh";

describe("shopifyGraphQL auth handling", () => {
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

  it("blocks GraphQL when stored client_id belongs to another app", async () => {
    await expect(
      shopifyGraphQL(
        "beta.myshopify.com",
        "shpat_token",
        "{ shop { name } }",
        undefined,
        { shopDomain: "beta.myshopify.com", storedClientId: "d5fc1ddb3ccd86e282bc6e38142654f3" },
      ),
    ).rejects.toBeInstanceOf(ShopifyAccessTokenInvalidError);
  });

  it("sets merchantReauthorizationRequired immediately when refresh token is missing", async () => {
    const metrics = emptyShopifyRefreshMetrics();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Invalid API key or access token", { status: 401 })),
    );

    await expect(
      shopifyGraphQL("beta.myshopify.com", "shpat_bad", "{ shop { name } }", undefined, {
        shopDomain: "beta.myshopify.com",
        refreshToken: null,
        refreshMetrics: metrics,
      }),
    ).rejects.toBeInstanceOf(ShopifyMerchantReauthorizationRequiredError);

    expect(metrics.refreshAttempted).toBe(true);
    expect(metrics.refreshFailed).toBe(true);
    expect(metrics.retrySucceeded).toBe(false);
    expect(metrics.retryFailed).toBe(false);
  });

  it("retries GraphQL exactly once after offline token refresh on HTTP 401", async () => {
    const metrics = emptyShopifyRefreshMetrics();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("Invalid API key or access token", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "shpat_fresh_tok",
            refresh_token: "shprt_fresh_ref",
            expires_in: 3600,
            refresh_token_expires_in: 7776000,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { shop: { name: "Beta" } } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const onAccessTokenRefreshed = vi.fn();
    const data = await shopifyGraphQL<{ shop: { name: string } }>(
      "beta.myshopify.com",
      "shpat_stale",
      "{ shop { name } }",
      undefined,
      {
        shopDomain: "beta.myshopify.com",
        refreshToken: "shprt_old",
        sessionType: "offline",
        onAccessTokenRefreshed,
        refreshMetrics: metrics,
      },
    );

    expect(data.shop.name).toBe("Beta");
    expect(onAccessTokenRefreshed).toHaveBeenCalledWith("shpat_fresh_tok", "shprt_fresh_ref");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(metrics.refreshAttempted).toBe(true);
    expect(metrics.refreshSucceeded).toBe(true);
    expect(metrics.retrySucceeded).toBe(true);
    expect(metrics.retryFailed).toBe(false);
  });

  it("does not retry GraphQL when refresh returns invalid_grant", async () => {
    const metrics = emptyShopifyRefreshMetrics();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("Invalid API key or access token", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "invalid_grant" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      shopifyGraphQL("beta.myshopify.com", "shpat_stale", "{ shop { name } }", undefined, {
        shopDomain: "beta.myshopify.com",
        refreshToken: "shprt_dead",
        refreshMetrics: metrics,
      }),
    ).rejects.toMatchObject({
      name: "ShopifyMerchantReauthorizationRequiredError",
      merchantReauthorizationRequired: true,
      failureReason: "invalid_grant",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(metrics.refreshFailed).toBe(true);
    expect(metrics.retrySucceeded).toBe(false);
    expect(metrics.retryFailed).toBe(false);
  });
});
