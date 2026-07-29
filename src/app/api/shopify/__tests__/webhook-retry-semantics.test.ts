import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Retry semantics for the Shopify webhook endpoint.
 *
 * A delivery may only be marked completed after successful processing. Any
 * processing failure must release the delivery and answer with a retryable
 * status, so Shopify redelivers instead of the event being silently dropped.
 */

type ClaimResult = {
  shouldProcess: boolean;
  webhookId: string | null;
  reason: string;
  degraded: boolean;
};

type SyncResult = {
  synced: boolean;
  skipped: boolean;
  reason: string;
  products?: number;
  orders30d?: number;
};

const mocks = vi.hoisted(() => ({
  verifyWebhookHmac: vi.fn<(body: string, hmac: string | null) => boolean>(),
  claimWebhookDelivery:
    vi.fn<
      (
        webhookId: string | null,
        meta: { topic: string; shopDomain: string | null },
      ) => Promise<ClaimResult>
    >(),
  completeWebhookDelivery: vi.fn<(webhookId: string | null) => Promise<void>>(),
  releaseWebhookDelivery: vi.fn<(webhookId: string | null) => Promise<void>>(),
  markShopifyUninstalled: vi.fn<(shop: string) => Promise<void>>(),
  updateShopifyInstallationScopes: vi.fn<(shop: string, scopes: string[]) => Promise<void>>(),
  deleteAuthSessionsForShop: vi.fn<(shop: string) => Promise<void>>(),
  handleCustomersDataRequest: vi.fn<(payload: unknown) => Promise<unknown>>(),
  handleCustomersRedact: vi.fn<(payload: unknown) => Promise<unknown>>(),
  handleShopRedact: vi.fn<(payload: unknown) => Promise<unknown>>(),
  resyncShopifyCommerce: vi.fn<(input: Record<string, unknown>) => Promise<SyncResult>>(),
}));

vi.mock("@/lib/shopify/oauth", () => ({
  verifyWebhookHmac: mocks.verifyWebhookHmac,
}));

vi.mock("@/lib/shopify/webhook-idempotency", () => ({
  claimWebhookDelivery: mocks.claimWebhookDelivery,
  completeWebhookDelivery: mocks.completeWebhookDelivery,
  releaseWebhookDelivery: mocks.releaseWebhookDelivery,
}));

vi.mock("@/lib/db/shopify", () => ({
  markShopifyUninstalled: mocks.markShopifyUninstalled,
  updateShopifyInstallationScopes: mocks.updateShopifyInstallationScopes,
}));

vi.mock("@/lib/shopify/supabase-session-storage", () => ({
  deleteAuthSessionsForShop: mocks.deleteAuthSessionsForShop,
}));

vi.mock("@/lib/shopify/gdpr", () => ({
  handleCustomersDataRequest: mocks.handleCustomersDataRequest,
  handleCustomersRedact: mocks.handleCustomersRedact,
  handleShopRedact: mocks.handleShopRedact,
}));

vi.mock("@/lib/shopify/resync-commerce.server", () => ({
  resyncShopifyCommerce: mocks.resyncShopifyCommerce,
}));

import { POST } from "@/app/api/shopify/webhooks/route";

const SYNCED: SyncResult = {
  synced: true,
  skipped: false,
  reason: "synced",
  products: 3,
  orders30d: 7,
};

function webhookRequest(opts: {
  topic: string;
  shop?: string | null;
  body?: unknown;
  webhookId?: string;
  rawBody?: string;
}): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-shopify-topic": opts.topic,
    "x-shopify-hmac-sha256": "test-hmac",
  };
  if (opts.shop !== null) {
    headers["x-shopify-shop-domain"] = opts.shop ?? "test.myshopify.com";
  }
  if (opts.webhookId) {
    headers["x-shopify-webhook-id"] = opts.webhookId;
  }

  return new Request("https://example.com/api/shopify/webhooks", {
    method: "POST",
    headers,
    body: opts.rawBody ?? JSON.stringify(opts.body ?? { id: 1234 }),
  });
}

describe("Shopify webhook retry semantics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.verifyWebhookHmac.mockReturnValue(true);
    mocks.claimWebhookDelivery.mockResolvedValue({
      shouldProcess: true,
      webhookId: "wh-1",
      reason: "claimed",
      degraded: false,
    });
    mocks.completeWebhookDelivery.mockResolvedValue(undefined);
    mocks.releaseWebhookDelivery.mockResolvedValue(undefined);
    mocks.markShopifyUninstalled.mockResolvedValue(undefined);
    mocks.updateShopifyInstallationScopes.mockResolvedValue(undefined);
    mocks.deleteAuthSessionsForShop.mockResolvedValue(undefined);
    mocks.handleCustomersDataRequest.mockResolvedValue({ ok: true });
    mocks.handleCustomersRedact.mockResolvedValue({ ok: true });
    mocks.handleShopRedact.mockResolvedValue({ ok: true });
    mocks.resyncShopifyCommerce.mockResolvedValue(SYNCED);
  });

  describe("commerce sync failures are retryable", () => {
    // orders/create, inventory_levels/update and products/update all funnel into
    // the same resync, so each topic is asserted independently.
    for (const topic of [
      "orders/create",
      "orders/updated",
      "orders/paid",
      "inventory_levels/update",
      "products/update",
    ]) {
      it(`returns 500 and releases the delivery when ${topic} sync fails`, async () => {
        mocks.resyncShopifyCommerce.mockResolvedValue({
          synced: false,
          skipped: false,
          reason: "failed:Shopify GraphQL HTTP 503",
        });

        const res = await POST(webhookRequest({ topic, webhookId: "wh-fail" }));

        expect(res.status).toBe(500);
        expect(mocks.releaseWebhookDelivery).toHaveBeenCalledWith("wh-1");
        expect(mocks.completeWebhookDelivery).not.toHaveBeenCalled();
      });

      it(`returns 200 and completes the delivery when ${topic} sync succeeds`, async () => {
        const res = await POST(webhookRequest({ topic, webhookId: "wh-ok" }));

        expect(res.status).toBe(200);
        expect(mocks.completeWebhookDelivery).toHaveBeenCalledWith("wh-1");
        expect(mocks.releaseWebhookDelivery).not.toHaveBeenCalled();
      });
    }

    it("returns 500 when the sync throws a network error", async () => {
      mocks.resyncShopifyCommerce.mockRejectedValue(new Error("fetch failed: ECONNRESET"));

      const res = await POST(webhookRequest({ topic: "orders/create", webhookId: "wh-net" }));

      expect(res.status).toBe(500);
      expect(mocks.releaseWebhookDelivery).toHaveBeenCalledWith("wh-1");
      expect(mocks.completeWebhookDelivery).not.toHaveBeenCalled();
    });

    it("returns 500 when the database rejects the sync persistence", async () => {
      mocks.resyncShopifyCommerce.mockRejectedValue(
        new Error('relation "shopify_sync_cache" does not exist'),
      );

      const res = await POST(webhookRequest({ topic: "products/update", webhookId: "wh-db" }));

      expect(res.status).toBe(500);
      expect(mocks.releaseWebhookDelivery).toHaveBeenCalledWith("wh-1");
    });

    it("returns 200 for a confirmed missing installation", async () => {
      mocks.resyncShopifyCommerce.mockResolvedValue({
        synced: false,
        skipped: true,
        reason: "installation_not_found",
      });

      const res = await POST(webhookRequest({ topic: "orders/create", webhookId: "wh-noinst" }));

      expect(res.status).toBe(200);
      expect(mocks.completeWebhookDelivery).toHaveBeenCalledWith("wh-1");
    });

    it("returns 500 when installation lookup fails", async () => {
      mocks.resyncShopifyCommerce.mockResolvedValue({
        synced: false,
        skipped: false,
        reason: "installation_lookup_failed",
      });

      const res = await POST(webhookRequest({ topic: "orders/create", webhookId: "wh-lookup" }));

      expect(res.status).toBe(500);
      expect(mocks.releaseWebhookDelivery).toHaveBeenCalledWith("wh-1");
      expect(mocks.completeWebhookDelivery).not.toHaveBeenCalled();
    });

    it("returns 500 when the merchant must reauthorize", async () => {
      mocks.resyncShopifyCommerce.mockResolvedValue({
        synced: false,
        skipped: false,
        reason: "reinstall_required:missing_refresh_token",
      });

      const res = await POST(webhookRequest({ topic: "orders/create", webhookId: "wh-reauth" }));

      expect(res.status).toBe(500);
      expect(mocks.releaseWebhookDelivery).toHaveBeenCalledWith("wh-1");
      expect(mocks.completeWebhookDelivery).not.toHaveBeenCalled();
    });

    it("returns 200 for a fresh cache if that outcome is ever reachable", async () => {
      mocks.resyncShopifyCommerce.mockResolvedValue({
        synced: false,
        skipped: true,
        reason: "fresh_cache",
      });

      const res = await POST(webhookRequest({ topic: "orders/create", webhookId: "wh-fresh" }));

      expect(res.status).toBe(200);
      expect(mocks.completeWebhookDelivery).toHaveBeenCalledWith("wh-1");
      expect(mocks.releaseWebhookDelivery).not.toHaveBeenCalled();
    });
  });

  describe("duplicate delivery", () => {
    it("skips processing and answers 200 for an already completed delivery", async () => {
      mocks.claimWebhookDelivery.mockResolvedValue({
        shouldProcess: false,
        webhookId: "wh-dup",
        reason: "already_completed",
        degraded: false,
      });

      const res = await POST(webhookRequest({ topic: "orders/create", webhookId: "wh-dup" }));

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ duplicate: true });
      expect(mocks.resyncShopifyCommerce).not.toHaveBeenCalled();
      expect(mocks.completeWebhookDelivery).not.toHaveBeenCalled();
      expect(mocks.releaseWebhookDelivery).not.toHaveBeenCalled();
    });
  });

  describe("failure then successful retry", () => {
    it("processes the redelivered webhook after the first attempt failed", async () => {
      mocks.resyncShopifyCommerce.mockResolvedValueOnce({
        synced: false,
        skipped: false,
        reason: "failed:Shopify GraphQL HTTP 500",
      });

      const first = await POST(webhookRequest({ topic: "orders/create", webhookId: "wh-retry" }));
      expect(first.status).toBe(500);
      expect(mocks.releaseWebhookDelivery).toHaveBeenCalledWith("wh-1");

      // The release above is what lets the retry claim the same id again.
      mocks.resyncShopifyCommerce.mockResolvedValue(SYNCED);
      const retry = await POST(webhookRequest({ topic: "orders/create", webhookId: "wh-retry" }));

      expect(retry.status).toBe(200);
      expect(mocks.completeWebhookDelivery).toHaveBeenCalledWith("wh-1");
      expect(mocks.resyncShopifyCommerce).toHaveBeenCalledTimes(2);
    });
  });

  describe("uninstall webhook", () => {
    it("completes the delivery after marking the shop uninstalled", async () => {
      const res = await POST(
        webhookRequest({ topic: "app/uninstalled", shop: "gone.myshopify.com", body: {} }),
      );

      expect(res.status).toBe(200);
      expect(mocks.markShopifyUninstalled).toHaveBeenCalledWith("gone.myshopify.com");
      expect(mocks.deleteAuthSessionsForShop).toHaveBeenCalledWith("gone.myshopify.com");
      expect(mocks.completeWebhookDelivery).toHaveBeenCalled();
    });

    it("returns 500 and releases when the uninstall write fails", async () => {
      mocks.markShopifyUninstalled.mockRejectedValue(new Error("db unavailable"));

      const res = await POST(
        webhookRequest({
          topic: "app/uninstalled",
          shop: "gone.myshopify.com",
          body: {},
          webhookId: "wh-uninstall",
        }),
      );

      expect(res.status).toBe(500);
      expect(mocks.releaseWebhookDelivery).toHaveBeenCalledWith("wh-1");
      expect(mocks.completeWebhookDelivery).not.toHaveBeenCalled();
    });

    it("returns 500 when clearing auth sessions fails", async () => {
      mocks.deleteAuthSessionsForShop.mockRejectedValue(new Error("network unreachable"));

      const res = await POST(
        webhookRequest({ topic: "app/uninstalled", shop: "gone.myshopify.com", body: {} }),
      );

      expect(res.status).toBe(500);
      expect(mocks.releaseWebhookDelivery).toHaveBeenCalled();
    });
  });

  describe("GDPR webhooks", () => {
    it("completes customers/data_request on success", async () => {
      const res = await POST(
        webhookRequest({ topic: "customers/data_request", body: { shop_domain: "a.myshopify.com" } }),
      );

      expect(res.status).toBe(200);
      expect(mocks.completeWebhookDelivery).toHaveBeenCalled();
    });

    it("returns 500 and releases when customers/redact fails", async () => {
      mocks.handleCustomersRedact.mockRejectedValue(new Error("redaction write failed"));

      const res = await POST(
        webhookRequest({
          topic: "customers/redact",
          body: { shop_domain: "a.myshopify.com" },
          webhookId: "wh-redact",
        }),
      );

      expect(res.status).toBe(500);
      expect(mocks.releaseWebhookDelivery).toHaveBeenCalledWith("wh-1");
      expect(mocks.completeWebhookDelivery).not.toHaveBeenCalled();
    });

    it("returns 500 and releases when shop/redact fails", async () => {
      mocks.handleShopRedact.mockRejectedValue(new Error("purge failed"));

      const res = await POST(
        webhookRequest({ topic: "shop/redact", body: { shop_domain: "a.myshopify.com" } }),
      );

      expect(res.status).toBe(500);
      expect(mocks.releaseWebhookDelivery).toHaveBeenCalled();
    });

    it("recovers on the retry after a transient GDPR failure", async () => {
      mocks.handleShopRedact.mockRejectedValueOnce(new Error("transient timeout"));

      const first = await POST(
        webhookRequest({ topic: "shop/redact", body: { shop_domain: "a.myshopify.com" } }),
      );
      expect(first.status).toBe(500);

      const retry = await POST(
        webhookRequest({ topic: "shop/redact", body: { shop_domain: "a.myshopify.com" } }),
      );
      expect(retry.status).toBe(200);
      expect(mocks.completeWebhookDelivery).toHaveBeenCalled();
    });
  });

  describe("scope updates", () => {
    it("returns 500 and releases when persisting scopes fails", async () => {
      mocks.updateShopifyInstallationScopes.mockRejectedValue(new Error("db down"));

      const res = await POST(
        webhookRequest({
          topic: "app/scopes_update",
          body: { current: ["read_products"] },
          webhookId: "wh-scopes",
        }),
      );

      expect(res.status).toBe(500);
      expect(mocks.releaseWebhookDelivery).toHaveBeenCalledWith("wh-1");
    });
  });

  describe("non-retryable rejections", () => {
    it("rejects an invalid HMAC before claiming a delivery", async () => {
      mocks.verifyWebhookHmac.mockReturnValue(false);

      const res = await POST(webhookRequest({ topic: "orders/create", webhookId: "wh-hmac" }));

      expect(res.status).toBe(401);
      expect(mocks.claimWebhookDelivery).not.toHaveBeenCalled();
      expect(mocks.resyncShopifyCommerce).not.toHaveBeenCalled();
    });

    it("consumes a malformed body instead of retrying it forever", async () => {
      const res = await POST(
        webhookRequest({ topic: "orders/create", rawBody: "{not-json", webhookId: "wh-bad" }),
      );

      expect(res.status).toBe(400);
      expect(mocks.completeWebhookDelivery).toHaveBeenCalledWith("wh-1");
      expect(mocks.releaseWebhookDelivery).not.toHaveBeenCalled();
    });

    it("completes an unrecognised topic without touching commerce sync", async () => {
      const res = await POST(webhookRequest({ topic: "carts/update", webhookId: "wh-ignored" }));

      expect(res.status).toBe(200);
      expect(mocks.resyncShopifyCommerce).not.toHaveBeenCalled();
      expect(mocks.completeWebhookDelivery).toHaveBeenCalledWith("wh-1");
    });
  });
});
