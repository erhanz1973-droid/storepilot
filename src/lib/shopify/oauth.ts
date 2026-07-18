import { createHmac, timingSafeEqual } from "crypto";

/**
 * Single Admin API version for the whole project. Must match:
 * - shopify.app.toml `[webhooks] api_version`
 * - shopify-app.server.ts `ApiVersion.October25`
 */
export const SHOPIFY_API_VERSION = "2025-10";

export const DEFAULT_SHOPIFY_SCOPES = [
  "read_products",
  "read_inventory",
  "read_orders",
  "read_customers",
  "read_discounts",
  "read_content",
  "write_products",
  "write_discounts",
].join(",");

export function getShopifyConfig() {
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  const appUrl = process.env.SHOPIFY_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  if (!apiKey || !apiSecret || !appUrl) {
    return null;
  }

  return {
    apiKey,
    apiSecret,
    appUrl: appUrl.replace(/\/$/, ""),
    scopes: process.env.SHOPIFY_SCOPES ?? DEFAULT_SHOPIFY_SCOPES,
  };
}

export function isShopifyOAuthConfigured(): boolean {
  return getShopifyConfig() !== null;
}

export function normalizeShopDomain(shop: string): string {
  let domain = shop.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, "");
  domain = domain.split("/")[0] ?? domain;
  if (!domain.includes(".")) {
    domain = `${domain}.myshopify.com`;
  }
  if (!domain.endsWith(".myshopify.com")) {
    throw new Error("Invalid Shopify shop domain");
  }
  return domain;
}

export function buildOAuthUrl(shop: string, state: string): string {
  const config = getShopifyConfig();
  if (!config) throw new Error("Shopify OAuth is not configured");

  const redirectUri = `${config.appUrl}/api/shopify/callback`;
  const params = new URLSearchParams({
    client_id: config.apiKey,
    scope: config.scopes,
    redirect_uri: redirectUri,
    state,
  });

  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

export function verifyOAuthHmac(query: URLSearchParams): boolean {
  const config = getShopifyConfig();
  if (!config) return false;

  const hmac = query.get("hmac");
  if (!hmac) return false;

  const entries = [...query.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const digest = createHmac("sha256", config.apiSecret).update(entries).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(hmac, "utf8"));
  } catch {
    return false;
  }
}

export function verifyWebhookHmac(rawBody: string, hmacHeader: string | null): boolean {
  const config = getShopifyConfig();
  if (!config || !hmacHeader) return false;

  const digest = createHmac("sha256", config.apiSecret)
    .update(rawBody, "utf8")
    .digest("base64");

  try {
    return timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(hmacHeader, "utf8"));
  } catch {
    return false;
  }
}

export async function exchangeCodeForToken(
  shop: string,
  code: string,
): Promise<{ access_token: string; scope: string }> {
  const config = getShopifyConfig();
  if (!config) throw new Error("Shopify OAuth is not configured");

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.apiKey,
      client_secret: config.apiSecret,
      code,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${text}`);
  }

  return response.json() as Promise<{ access_token: string; scope: string }>;
}

/**
 * Registers operational webhooks (app/uninstalled) via Admin API after install.
 *
 * Mandatory GDPR compliance webhooks (customers/data_request, customers/redact,
 * shop/redact) cannot be created through the Admin API — they are subscribed in
 * `shopify.app.toml` under `compliance_topics` and deployed with Shopify CLI.
 * Both paths deliver to `${appUrl}/api/shopify/webhooks`.
 */
export async function registerAppWebhooks(shop: string, accessToken: string): Promise<void> {
  const config = getShopifyConfig();
  if (!config) return;

  const address = `${config.appUrl}/api/shopify/webhooks`;
  const topics = ["app/uninstalled"];

  console.log(
    "[shopify-webhook]",
    JSON.stringify({
      event: "register_operational_webhooks",
      shop,
      address,
      topics,
      complianceTopicsNote:
        "GDPR compliance topics are registered via shopify.app.toml compliance_topics",
    }),
  );

  for (const topic of topics) {
    const response = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          webhook: { topic, address, format: "json" },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.warn(
        "[shopify-webhook]",
        JSON.stringify({
          event: "register_webhook_failed",
          shop,
          topic,
          status: response.status,
          body: text.slice(0, 500),
        }),
      );
    }
  }
}
