import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { probeShopifyProducts } from "@/lib/smoke/shopify-probe";
import { isTokenRejectionStatus } from "@/lib/shopify/graphql-client";

const EXPIRED_TOKEN_403_BODY =
  '{"errors":"[API] Non-expiring access tokens are no longer accepted for the Admin API. Start using expiring offline tokens: https://shopify.dev/..."}';
const AUTHORIZATION_403_BODY =
  '{"errors":"[API] This app is not approved to access REST endpoints with protected customer data."}';

/**
 * Smoke token scenarios — mirrors production offline refresh contract:
 * 1. valid access token → PASS, no reauth
 * 2. expired access + valid refresh → PASS after one refresh + one retry, no reauth
 * 3. expired access + expired/invalid refresh → FAIL, merchantReauthorizationRequired
 * 4. expired access + missing refresh → FAIL, merchantReauthorizationRequired
 *
 * Only cases where the refresh token is missing or unusable require merchant reauthorization.
 */
describe("smoke Shopify token scenarios", () => {
  const originalKey = process.env.SHOPIFY_API_KEY;
  const originalSecret = process.env.SHOPIFY_API_SECRET;
  const originalUrl = process.env.SHOPIFY_APP_URL;
  const shop = "beta.myshopify.com";

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

  it("valid token: PASS without refresh or merchant reauthorization", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: { products: { edges: [{ node: { id: "gid://shopify/Product/1" } }] } },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await probeShopifyProducts({
      shopDomain: shop,
      accessToken: "shpat_valid_token",
      refreshToken: "shprt_unused",
    });

    expect(result.status).toBe("PASS");
    expect(result.merchantReauthorizationRequired).toBe(false);
    expect(result.metrics.refreshAttempted).toBe(false);
    expect(result.metrics.refreshSucceeded).toBe(false);
    expect(result.metrics.refreshFailed).toBe(false);
    expect(result.metrics.retrySucceeded).toBe(false);
    expect(result.metrics.retryFailed).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("expired access + valid refresh: PASS after exactly one refresh and one retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("Invalid API key or access token", { status: 401 }),
      )
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
        new Response(
          JSON.stringify({
            data: { products: { edges: [{ node: { id: "gid://shopify/Product/1" } }] } },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await probeShopifyProducts({
      shopDomain: shop,
      accessToken: "shpat_expired",
      refreshToken: "shprt_valid",
      installationId: "inst-1",
    });

    expect(result.status).toBe("PASS");
    expect(result.merchantReauthorizationRequired).toBe(false);
    expect(result.metrics.refreshAttempted).toBe(true);
    expect(result.metrics.refreshSucceeded).toBe(true);
    expect(result.metrics.refreshFailed).toBe(false);
    expect(result.metrics.retrySucceeded).toBe(true);
    expect(result.metrics.retryFailed).toBe(false);
    // GraphQL 401 + refresh + GraphQL retry = 3 fetches; never a second refresh.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const refreshCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes("/admin/oauth/access_token"),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("expired access + expired refresh: FAIL with merchantReauthorizationRequired (no GraphQL retry)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("Invalid API key or access token", { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "invalid_grant", error_description: "refresh token expired" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await probeShopifyProducts({
      shopDomain: shop,
      accessToken: "shpat_expired",
      refreshToken: "shprt_expired",
      installationId: "inst-1",
    });

    expect(result.status).toBe("FAIL");
    expect(result.merchantReauthorizationRequired).toBe(true);
    expect(result.details.failureReason).toBe("invalid_grant");
    expect(result.metrics.refreshAttempted).toBe(true);
    expect(result.metrics.refreshSucceeded).toBe(false);
    expect(result.metrics.refreshFailed).toBe(true);
    expect(result.metrics.retrySucceeded).toBe(false);
    expect(result.metrics.retryFailed).toBe(false);
    // No GraphQL retry when refresh fails.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("expired access rejected with HTTP 403 + valid refresh: PASS after one refresh and one retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(EXPIRED_TOKEN_403_BODY, { status: 403 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "shpua_fresh_tok",
            refresh_token: "shprt_fresh_ref",
            expires_in: 7200,
            refresh_token_expires_in: 7776000,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { products: { edges: [{ node: { id: "gid://shopify/Product/1" } }] } },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await probeShopifyProducts({
      shopDomain: shop,
      accessToken: "shpua_expired",
      refreshToken: "shprt_valid",
      installationId: "inst-1",
    });

    expect(result.status).toBe("PASS");
    expect(result.merchantReauthorizationRequired).toBe(false);
    expect(result.metrics.refreshAttempted).toBe(true);
    expect(result.metrics.refreshSucceeded).toBe(true);
    expect(result.metrics.retrySucceeded).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("HTTP 403 authorization failure (not a token rejection): FAIL without refresh", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(AUTHORIZATION_403_BODY, { status: 403 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await probeShopifyProducts({
      shopDomain: shop,
      accessToken: "shpua_valid",
      refreshToken: "shprt_valid",
      installationId: "inst-1",
    });

    expect(result.status).toBe("FAIL");
    expect(result.message).toContain("403");
    expect(result.merchantReauthorizationRequired).toBe(false);
    expect(result.metrics.refreshAttempted).toBe(false);
    // Genuine authorization failures never consume the refresh token.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("expired access + missing refresh: FAIL with merchantReauthorizationRequired (no retry)", async () => {
    const fetchMock = vi.fn(async () =>
      new Response("Invalid API key or access token", { status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await probeShopifyProducts({
      shopDomain: shop,
      accessToken: "shpat_expired",
      refreshToken: null,
      installationId: "inst-1",
    });

    expect(result.status).toBe("FAIL");
    expect(result.merchantReauthorizationRequired).toBe(true);
    expect(result.details.failureReason).toBe("missing_refresh_token");
    expect(result.metrics.refreshAttempted).toBe(true);
    expect(result.metrics.refreshSucceeded).toBe(false);
    expect(result.metrics.refreshFailed).toBe(true);
    expect(result.metrics.retrySucceeded).toBe(false);
    expect(result.metrics.retryFailed).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("isTokenRejectionStatus", () => {
  it("treats every 401 as a token rejection", () => {
    expect(isTokenRejectionStatus(401, "anything")).toBe(true);
    expect(isTokenRejectionStatus(401, "")).toBe(true);
  });

  it("treats 403 as token rejection only when the body mentions access tokens", () => {
    expect(isTokenRejectionStatus(403, EXPIRED_TOKEN_403_BODY)).toBe(true);
    expect(isTokenRejectionStatus(403, AUTHORIZATION_403_BODY)).toBe(false);
    expect(isTokenRejectionStatus(403, "")).toBe(false);
  });

  it("never flags other statuses", () => {
    expect(isTokenRejectionStatus(200, EXPIRED_TOKEN_403_BODY)).toBe(false);
    expect(isTokenRejectionStatus(500, EXPIRED_TOKEN_403_BODY)).toBe(false);
  });
});
