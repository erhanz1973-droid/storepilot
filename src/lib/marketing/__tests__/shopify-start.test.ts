import { afterEach, describe, expect, it } from "vitest";
import {
  normalizeMarketingShopDomain,
  resolveShopifyAuthStartUrl,
} from "@/lib/marketing/shopify-start";

describe("normalizeMarketingShopDomain", () => {
  it("appends myshopify.com when only the store handle is entered", () => {
    expect(normalizeMarketingShopDomain("my-store")).toBe("my-store.myshopify.com");
  });

  it("strips protocol and path", () => {
    expect(normalizeMarketingShopDomain("https://My-Store.myshopify.com/admin")).toBe(
      "my-store.myshopify.com",
    );
  });
});

describe("resolveShopifyAuthStartUrl", () => {
  const previousApp = process.env.NEXT_PUBLIC_APP_URL;
  const previousShopify = process.env.SHOPIFY_APP_URL;

  afterEach(() => {
    if (previousApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previousApp;
    if (previousShopify === undefined) delete process.env.SHOPIFY_APP_URL;
    else process.env.SHOPIFY_APP_URL = previousShopify;
  });

  it("uses a relative path when the visitor is already on the app origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    expect(
      resolveShopifyAuthStartUrl("my-store.myshopify.com", "https://app.example.com"),
    ).toBe("/api/shopify/auth?shop=my-store.myshopify.com");
  });

  it("sends marketing visitors to the app origin so OAuth cookies match the callback", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    expect(
      resolveShopifyAuthStartUrl("my-store.myshopify.com", "https://storepilotai.pro"),
    ).toBe("https://app.example.com/api/shopify/auth?shop=my-store.myshopify.com");
  });
});
