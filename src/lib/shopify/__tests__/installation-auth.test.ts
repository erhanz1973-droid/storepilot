import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShopifyAppMismatchError } from "@/lib/shopify/auth-errors";
import { assertInstallationAppMatch } from "@/lib/shopify/installation-auth";
import { detectAppMismatch, shopifyApiKeyPrefix } from "@/lib/shopify/token-diagnostics";

describe("shopifyApiKeyPrefix", () => {
  it("returns first six characters", () => {
    expect(shopifyApiKeyPrefix("65ef315b32098769438404654f2d4688")).toBe("65ef31");
  });

  it("returns null for empty input", () => {
    expect(shopifyApiKeyPrefix("")).toBeNull();
    expect(shopifyApiKeyPrefix(null)).toBeNull();
  });
});

describe("detectAppMismatch", () => {
  const originalKey = process.env.SHOPIFY_API_KEY;
  const originalSecret = process.env.SHOPIFY_API_SECRET;
  const originalUrl = process.env.SHOPIFY_APP_URL;

  beforeEach(() => {
    process.env.SHOPIFY_API_KEY = "65ef315b32098769438404654f2d4688";
    process.env.SHOPIFY_API_SECRET = "shpss_test_secret_value_here_123456";
    process.env.SHOPIFY_APP_URL = "https://storepilot.example.com";
  });

  afterEach(() => {
    process.env.SHOPIFY_API_KEY = originalKey;
    process.env.SHOPIFY_API_SECRET = originalSecret;
    process.env.SHOPIFY_APP_URL = originalUrl;
  });

  it("treats legacy rows without client_id as unknown (not mismatch)", () => {
    const result = detectAppMismatch(null);
    expect(result.appMatch).toBeNull();
    expect(result.mismatch).toBe(false);
    expect(result.currentClientIdPrefix).toBe("65ef31");
  });

  it("detects mismatch when stored client_id differs from runtime key", () => {
    const result = detectAppMismatch("d5fc1ddb3ccd86e282bc6e38142654f3");
    expect(result.appMatch).toBe(false);
    expect(result.mismatch).toBe(true);
    expect(result.storedClientIdPrefix).toBe("d5fc1d");
    expect(result.currentClientIdPrefix).toBe("65ef31");
  });

  it("matches when stored client_id equals runtime key", () => {
    const result = detectAppMismatch("65ef315b32098769438404654f2d4688");
    expect(result.appMatch).toBe(true);
    expect(result.mismatch).toBe(false);
  });
});

describe("assertInstallationAppMatch", () => {
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
  });

  it("throws ShopifyAppMismatchError for a different app token", () => {
    expect(() =>
      assertInstallationAppMatch("beta.myshopify.com", "d5fc1ddb3ccd86e282bc6e38142654f3"),
    ).toThrow(ShopifyAppMismatchError);
  });

  it("allows legacy installations without client_id", () => {
    const diagnostics = assertInstallationAppMatch("beta.myshopify.com", null);
    expect(diagnostics.reinstallRequired).toBe(false);
    expect(diagnostics.appMatch).toBeNull();
  });
});
