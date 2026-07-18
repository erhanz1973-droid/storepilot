import { NextResponse } from "next/server";
import { markShopifyUninstalled, updateShopifyInstallationScopes } from "@/lib/db/shopify";
import {
  handleCustomersDataRequest,
  handleCustomersRedact,
  handleShopRedact,
  type GdprCustomersRedactPayload,
  type GdprDataRequestPayload,
  type GdprShopRedactPayload,
} from "@/lib/shopify/gdpr";
import { verifyWebhookHmac } from "@/lib/shopify/oauth";
import { deleteAuthSessionsForShop } from "@/lib/shopify/supabase-session-storage";
import { claimWebhookDelivery } from "@/lib/shopify/webhook-idempotency";

function logWebhook(event: string, payload: Record<string, unknown>): void {
  console.log(
    "[shopify-webhook]",
    JSON.stringify({
      event,
      at: new Date().toISOString(),
      ...payload,
    }),
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const hmac = request.headers.get("x-shopify-hmac-sha256");

  if (!verifyWebhookHmac(rawBody, hmac)) {
    logWebhook("hmac_rejected", {
      topic: request.headers.get("x-shopify-topic"),
      shop: request.headers.get("x-shopify-shop-domain"),
    });
    return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
  }

  const topic = request.headers.get("x-shopify-topic") ?? "";
  const shop = request.headers.get("x-shopify-shop-domain");
  const webhookId = request.headers.get("x-shopify-webhook-id");

  const claim = await claimWebhookDelivery(webhookId, {
    topic,
    shopDomain: shop,
  });

  if (!claim.shouldProcess) {
    logWebhook("duplicate_skipped", { topic, shop, webhookId });
    return NextResponse.json({ ok: true, duplicate: true });
  }

  let payload: unknown = {};
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    logWebhook("invalid_json", { topic, shop, webhookId });
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    switch (topic) {
      case "app/uninstalled": {
        if (shop) {
          await markShopifyUninstalled(shop);
          await deleteAuthSessionsForShop(shop);
          logWebhook("app_uninstalled", { shop, webhookId });
        }
        break;
      }
      case "app/scopes_update": {
        const current = (payload as { current?: unknown }).current;
        const scopes = Array.isArray(current)
          ? current.filter((s): s is string => typeof s === "string")
          : [];
        if (shop && scopes.length > 0) {
          await updateShopifyInstallationScopes(shop, scopes);
        }
        logWebhook("app_scopes_update", { shop, webhookId, scopeCount: scopes.length });
        break;
      }
      case "customers/data_request": {
        await handleCustomersDataRequest(payload as GdprDataRequestPayload);
        break;
      }
      case "customers/redact": {
        await handleCustomersRedact(payload as GdprCustomersRedactPayload);
        break;
      }
      case "shop/redact": {
        await handleShopRedact(payload as GdprShopRedactPayload);
        break;
      }
      default: {
        logWebhook("topic_ignored", { topic, shop, webhookId });
        break;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWebhook("handler_error", { topic, shop, webhookId, message });
    // Non-2xx so Shopify retries; handlers are idempotent.
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
