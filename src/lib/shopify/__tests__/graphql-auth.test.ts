import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShopifyAccessTokenInvalidError } from "@/lib/shopify/auth-errors";
import { shopifyGraphQL } from "@/lib/shopify/graphql-client";

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

  it("maps Shopify HTTP 401 to reinstall-required error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Invalid API key or access token", { status: 401 })),
    );

    await expect(
      shopifyGraphQL("beta.myshopify.com", "shpat_bad", "{ shop { name } }"),
    ).rejects.toBeInstanceOf(ShopifyAccessTokenInvalidError);
  });
});
