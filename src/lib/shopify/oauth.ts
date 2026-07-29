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

/**
 * Shopify authorization-code exchange result.
 *
 * When the app has expiring offline access tokens enabled, Shopify also returns
 * `refresh_token` / `expires_in` / `refresh_token_expires_in`. These must be
 * persisted — without the refresh token the first access-token expiry forces the
 * merchant to reauthorize.
 */
export type ShopifyTokenExchangeResult = {
  access_token: string;
  scope: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
};

/** Convert a Shopify `*_expires_in` seconds value into an absolute expiry. */
export function tokenExpiryFromSeconds(
  expiresInSeconds: number | null | undefined,
): Date | undefined {
  if (typeof expiresInSeconds !== "number" || !Number.isFinite(expiresInSeconds)) {
    return undefined;
  }
  return new Date(Date.now() + expiresInSeconds * 1000);
}

export async function exchangeCodeForToken(
  shop: string,
  code: string,
): Promise<ShopifyTokenExchangeResult> {
  const config = getShopifyConfig();
  if (!config) throw new Error("Shopify OAuth is not configured");

  // Shopify defaults authorization-code exchanges to a non-expiring offline
  // token. `expiring=1` is required to receive expires_in, refresh_token, and
  // refresh_token_expires_in.
  const body = new URLSearchParams({
    client_id: config.apiKey,
    client_secret: config.apiSecret,
    code,
    expiring: "1",
  });

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${text}`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  const accessToken = typeof json.access_token === "string" ? json.access_token : "";
  if (!accessToken) {
    throw new Error("Token exchange returned no access_token");
  }

  return {
    access_token: accessToken,
    scope: typeof json.scope === "string" ? json.scope : "",
    refresh_token:
      typeof json.refresh_token === "string" && json.refresh_token
        ? json.refresh_token
        : undefined,
    expires_in: typeof json.expires_in === "number" ? json.expires_in : undefined,
    refresh_token_expires_in:
      typeof json.refresh_token_expires_in === "number"
        ? json.refresh_token_expires_in
        : undefined,
  };
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
  // Commerce topics keep shopify_sync_cache fresh when merchants place orders or
  // change inventory after the initial post-install sync.
  const topics = [
    "app/uninstalled",
    "orders/create",
    "orders/updated",
    "orders/paid",
    "products/update",
    "inventory_levels/update",
  ];

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
