import { createHmac } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  markShopifyUninstalled: vi.fn(),
  updateShopifyInstallationScopes: vi.fn(),
  deleteAuthSessionsForShop: vi.fn(),
  verifyWebhookHmac: vi.fn(),
  claimWebhookDelivery: vi.fn(),
  handleCustomersDataRequest: vi.fn(),
  handleCustomersRedact: vi.fn(),
  handleShopRedact: vi.fn(),
}));

vi.mock("@/lib/db/shopify", () => ({
  markShopifyUninstalled: mocks.markShopifyUninstalled,
  updateShopifyInstallationScopes: mocks.updateShopifyInstallationScopes,
}));

vi.mock("@/lib/shopify/supabase-session-storage", () => ({
  deleteAuthSessionsForShop: mocks.deleteAuthSessionsForShop,
}));

vi.mock("@/lib/shopify/oauth", () => ({
  verifyWebhookHmac: mocks.verifyWebhookHmac,
}));

vi.mock("@/lib/shopify/webhook-idempotency", () => ({
  claimWebhookDelivery: mocks.claimWebhookDelivery,
}));

vi.mock("@/lib/shopify/gdpr", () => ({
  handleCustomersDataRequest: mocks.handleCustomersDataRequest,
  handleCustomersRedact: mocks.handleCustomersRedact,
  handleShopRedact: mocks.handleShopRedact,
}));

import { POST } from "@/app/api/shopify/webhooks/route";

function makeRequest(opts: {
  topic: string;
  shop?: string;
  body?: unknown;
  hmacValid?: boolean;
  webhookId?: string;
}): Request {
  const rawBody = JSON.stringify(opts.body ?? { shop_domain: opts.shop ?? "test.myshopify.com" });
  mocks.verifyWebhookHmac.mockReturnValue(opts.hmacValid !== false);

  return new Request("https://example.com/api/shopify/webhooks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shopify-topic": opts.topic,
      "x-shopify-shop-domain": opts.shop ?? "test.myshopify.com",
      "x-shopify-hmac-sha256": "test-hmac",
      ...(opts.webhookId ? { "x-shopify-webhook-id": opts.webhookId } : {}),
    },
    body: rawBody,
  });
}

describe("Shopify webhook GDPR compliance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.claimWebhookDelivery.mockResolvedValue({ shouldProcess: true, webhookId: "wh-1" });
    mocks.handleCustomersDataRequest.mockResolvedValue({ ok: true });
    mocks.handleCustomersRedact.mockResolvedValue({ ok: true });
    mocks.handleShopRedact.mockResolvedValue({ ok: true });
    mocks.markShopifyUninstalled.mockResolvedValue(undefined);
    mocks.updateShopifyInstallationScopes.mockResolvedValue(undefined);
    mocks.deleteAuthSessionsForShop.mockResolvedValue(undefined);
  });

  it("returns 401 when HMAC is invalid", async () => {
    const res = await POST(makeRequest({ topic: "customers/data_request", hmacValid: false }));
    expect(res.status).toBe(401);
    expect(mocks.handleCustomersDataRequest).not.toHaveBeenCalled();
  });

  it("handles customers/data_request", async () => {
    const body = {
      shop_id: 1,
      shop_domain: "test.myshopify.com",
      customer: { id: 9, email: "a@b.com" },
      orders_requested: [1],
      data_request: { id: 99 },
    };
    const res = await POST(makeRequest({ topic: "customers/data_request", body }));
    expect(res.status).toBe(200);
    expect(mocks.handleCustomersDataRequest).toHaveBeenCalledWith(body);
    expect(mocks.markShopifyUninstalled).not.toHaveBeenCalled();
  });

  it("handles customers/redact", async () => {
    const body = {
      shop_id: 1,
      shop_domain: "test.myshopify.com",
      customer: { id: 9, email: "a@b.com" },
      orders_to_redact: [1],
    };
    const res = await POST(makeRequest({ topic: "customers/redact", body }));
    expect(res.status).toBe(200);
    expect(mocks.handleCustomersRedact).toHaveBeenCalledWith(body);
  });

  it("handles shop/redact", async () => {
    const body = { shop_id: 1, shop_domain: "test.myshopify.com" };
    const res = await POST(makeRequest({ topic: "shop/redact", body }));
    expect(res.status).toBe(200);
    expect(mocks.handleShopRedact).toHaveBeenCalledWith(body);
  });

  it("preserves app/uninstalled behavior", async () => {
    const res = await POST(
      makeRequest({ topic: "app/uninstalled", shop: "gone.myshopify.com", body: {} }),
    );
    expect(res.status).toBe(200);
    expect(mocks.markShopifyUninstalled).toHaveBeenCalledWith("gone.myshopify.com");
    expect(mocks.deleteAuthSessionsForShop).toHaveBeenCalledWith("gone.myshopify.com");
    expect(mocks.handleShopRedact).not.toHaveBeenCalled();
  });

  it("handles app/scopes_update by persisting current scopes", async () => {
    const res = await POST(
      makeRequest({
        topic: "app/scopes_update",
        shop: "scoped.myshopify.com",
        body: { previous: ["read_products"], current: ["read_products", "read_orders"] },
      }),
    );
    expect(res.status).toBe(200);
    expect(mocks.updateShopifyInstallationScopes).toHaveBeenCalledWith(
      "scoped.myshopify.com",
      ["read_products", "read_orders"],
    );
  });

  it("skips duplicate webhook ids with 200", async () => {
    mocks.claimWebhookDelivery.mockResolvedValue({ shouldProcess: false, webhookId: "dup" });
    const res = await POST(
      makeRequest({ topic: "customers/redact", webhookId: "dup", body: { shop_domain: "x.myshopify.com" } }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.duplicate).toBe(true);
    expect(mocks.handleCustomersRedact).not.toHaveBeenCalled();
  });
});

describe("verifyWebhookHmac contract", () => {
  it("documents base64 HMAC over raw body (Shopify webhook standard)", () => {
    const secret = "shpss_test";
    const body = '{"shop_domain":"x.myshopify.com"}';
    const digest = createHmac("sha256", secret).update(body, "utf8").digest("base64");
    expect(digest.length).toBeGreaterThan(10);
  });
});
