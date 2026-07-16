import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { resolveShopifyAppBridgeApiKey } from "@/lib/shopify/app-bridge-config";
import { redirectTop } from "@/lib/shopify/embedded-navigation";
import {
  normalizeShopDomain,
  resolveShopFromEmbeddedRequest,
} from "@/lib/store/embedded-shop";

describe("App Bridge / embedded compliance", () => {
  it("exposes App Bridge CDN script + NavMenu in root layout", () => {
    const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout).toContain("cdn.shopify.com/shopifycloud/app-bridge.js");
    expect(layout).toContain("data-api-key");
    expect(layout).toContain("ShopifyAppBridgeNav");
  });

  it("depends on @shopify/app-bridge-react", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies["@shopify/app-bridge-react"]).toBeTruthy();
  });

  it("NavMenu registers Admin chrome links", () => {
    const nav = readFileSync(
      join(process.cwd(), "src/components/shopify/ShopifyAppBridgeNav.tsx"),
      "utf8",
    );
    expect(nav).toContain("NavMenu");
    expect(nav).toContain('rel="home"');
    expect(nav).toContain('href="/connections"');
  });

  it("middleware always sets frame-ancestors CSP", () => {
    const mw = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf8");
    expect(mw).toContain("frame-ancestors");
    expect(mw).toContain("admin.shopify.com");
    expect(mw).toContain("frame-ancestors 'none'");
    expect(mw).toContain("EMBEDDED_SHOP_COOKIE");
  });

  it("resolves shop from host for CSP continuity", () => {
    const host = Buffer.from("admin.shopify.com/store/demo-shop").toString("base64");
    expect(resolveShopFromEmbeddedRequest({ hostParam: host })).toBe("demo-shop.myshopify.com");
    expect(normalizeShopDomain("demo-shop.myshopify.com")).toBe("demo-shop.myshopify.com");
  });

  it("OAuth reconnect paths use redirectTop (leave iframe)", () => {
    const connect = readFileSync(
      join(process.cwd(), "src/components/ConnectShopifyForm.tsx"),
      "utf8",
    );
    const workspace = readFileSync(
      join(process.cwd(), "src/components/connections/ConnectionsWorkspace.tsx"),
      "utf8",
    );
    const bootstrap = readFileSync(
      join(process.cwd(), "src/components/shopify/EmbeddedShopifyBootstrap.tsx"),
      "utf8",
    );
    expect(connect).toContain("redirectTop");
    expect(connect).not.toContain("window.location.href");
    expect(workspace).toContain("redirectTop");
    expect(workspace).not.toContain("window.location.href");
    expect(bootstrap).toContain("redirectTop");
    expect(bootstrap).not.toContain("window.location.assign");
  });

  it("resolveShopifyAppBridgeApiKey reads public or server key", () => {
    const prevPublic = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
    const prevKey = process.env.SHOPIFY_API_KEY;
    delete process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
    process.env.SHOPIFY_API_KEY = "test-client-id";
    expect(resolveShopifyAppBridgeApiKey()).toBe("test-client-id");
    if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
    else process.env.NEXT_PUBLIC_SHOPIFY_API_KEY = prevPublic;
    if (prevKey === undefined) delete process.env.SHOPIFY_API_KEY;
    else process.env.SHOPIFY_API_KEY = prevKey;
  });
});

describe("embedded-navigation helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redirectTop uses window.open _top", () => {
    const open = vi.fn();
    vi.stubGlobal("window", { open });
    redirectTop("https://example.com/oauth");
    expect(open).toHaveBeenCalledWith("https://example.com/oauth", "_top");
  });
});
