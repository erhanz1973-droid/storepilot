import { describe, expect, it } from "vitest";
import {
  normalizeShopDomain,
  resolveShopFromEmbeddedRequest,
  shopDomainFromHostParam,
} from "@/lib/store/embedded-shop";

describe("embedded-shop", () => {
  it("normalizes bare shop slugs", () => {
    expect(normalizeShopDomain("storepilot-ai-demo")).toBe("storepilot-ai-demo.myshopify.com");
  });

  it("derives shop from Shopify host param", () => {
    const host = Buffer.from("admin.shopify.com/store/storepilot-ai-demo").toString("base64");
    expect(shopDomainFromHostParam(host)).toBe("storepilot-ai-demo.myshopify.com");
  });

  it("prefers explicit shop param over host", () => {
    const host = Buffer.from("admin.shopify.com/store/other-shop").toString("base64");
    expect(
      resolveShopFromEmbeddedRequest({
        shopParam: "storepilot-ai-demo.myshopify.com",
        hostParam: host,
      }),
    ).toBe("storepilot-ai-demo.myshopify.com");
  });

  it("falls back to host when shop param is missing", () => {
    const host = Buffer.from("admin.shopify.com/store/storepilot-ai-demo").toString("base64");
    expect(
      resolveShopFromEmbeddedRequest({
        shopParam: null,
        hostParam: host,
      }),
    ).toBe("storepilot-ai-demo.myshopify.com");
  });
});
