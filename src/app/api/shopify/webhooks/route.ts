import { NextResponse } from "next/server";
import { markShopifyUninstalled } from "@/lib/db/shopify";
import { verifyWebhookHmac } from "@/lib/shopify/oauth";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const hmac = request.headers.get("x-shopify-hmac-sha256");

  if (!verifyWebhookHmac(rawBody, hmac)) {
    return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
  }

  const topic = request.headers.get("x-shopify-topic");
  const shop = request.headers.get("x-shopify-shop-domain");

  if (topic === "app/uninstalled" && shop) {
    await markShopifyUninstalled(shop);
  }

  return NextResponse.json({ ok: true });
}
