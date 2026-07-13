import { describe, expect, it } from "vitest";
import { isShopifyLoginPath, SHOPIFY_LOGIN_PATH } from "@/lib/shopify/embedded-auth.server";

function req(url: string): Request {
  return new Request(url);
}

describe("isShopifyLoginPath", () => {
  it("matches the configured login path", () => {
    expect(SHOPIFY_LOGIN_PATH).toBe("/auth/login");
    expect(
      isShopifyLoginPath(
        req("https://app.example.com/auth/login?shop=storepilot-ai-demo.myshopify.com"),
      ),
    ).toBe(true);
  });

  it("does not match callback or other auth paths", () => {
    expect(isShopifyLoginPath(req("https://app.example.com/auth/callback?shop=x"))).toBe(false);
    expect(isShopifyLoginPath(req("https://app.example.com/auth/session-token"))).toBe(false);
    expect(isShopifyLoginPath(req("https://app.example.com/auth"))).toBe(false);
  });
});
