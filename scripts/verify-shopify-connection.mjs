#!/usr/bin/env node
/**
 * Verify Shopify token decrypts and sync works against production Supabase + Shopify API.
 * Usage: railway run node scripts/verify-shopify-connection.mjs
 *
 * Uses the same offline installation SOH as the embedded app / smoke suite:
 * shopify_installations.access_token_encrypted (+ refresh_token_encrypted when present).
 */
import { createClient } from "@supabase/supabase-js";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const encryptionSecret = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY?.trim();
const shopDomain = process.env.SHOP_DOMAIN?.trim();

if (!url || !key || !encryptionSecret || encryptionSecret.length < 32) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SHOPIFY_TOKEN_ENCRYPTION_KEY (>=32 chars)",
  );
  process.exit(1);
}

function shaKey(secret) {
  return createHash("sha256").update(secret).digest();
}

function decryptToken(payload) {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted token format");
  }
  const derivedKey = shaKey(encryptionSecret);
  const decipher = createDecipheriv("aes-256-gcm", derivedKey, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function encryptToken(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", shaKey(encryptionSecret), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function tokenFingerprint(token) {
  return token.slice(0, 12);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let query = supabase
  .from("shopify_installations")
  .select(
    "id, store_id, shop_domain, access_token_encrypted, refresh_token_encrypted, refresh_token_expires_at, connection_health, status, client_id",
  )
  .eq("status", "active")
  .order("installed_at", { ascending: false });
if (shopDomain) query = query.eq("shop_domain", shopDomain);

let { data: rows, error } = await query.limit(1);
if (error?.message?.includes("client_id") || error?.message?.includes("refresh_token")) {
  query = supabase
    .from("shopify_installations")
    .select("id, store_id, shop_domain, access_token_encrypted, connection_health, status")
    .eq("status", "active")
    .order("installed_at", { ascending: false });
  if (shopDomain) query = query.eq("shop_domain", shopDomain);
  ({ data: rows, error } = await query.limit(1));
}
if (error) {
  console.error("Supabase query failed:", error.message);
  process.exit(1);
}

const row = rows?.[0];
if (!row) {
  console.error("No active Shopify installation found. Complete OAuth first.");
  process.exit(1);
}

let accessToken;
try {
  accessToken = decryptToken(row.access_token_encrypted);
  console.log("Token decrypt: OK");
} catch (err) {
  console.error("Token decrypt: FAILED");
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

let refreshToken = null;
if (row.refresh_token_encrypted) {
  try {
    refreshToken = decryptToken(row.refresh_token_encrypted);
  } catch {
    refreshToken = null;
  }
}

const runtimeApiKey = process.env.SHOPIFY_API_KEY?.trim() ?? "";
const runtimeApiKeyPrefix = runtimeApiKey ? runtimeApiKey.slice(0, 6) : null;
const storedClientId = row.client_id?.trim() || null;
const storedClientIdPrefix = storedClientId ? storedClientId.slice(0, 6) : null;
const appMatch =
  storedClientId && runtimeApiKey ? storedClientId === runtimeApiKey : null;
const shop = row.shop_domain;
const apiVersion = process.env.SHOPIFY_API_VERSION?.trim() || "2024-10";
const endpoint = `https://${shop}/admin/api/${apiVersion}/shop.json`;

console.log(
  JSON.stringify({
    installationId: row.id ?? null,
    shopDomain: shop,
    tokenFingerprint: tokenFingerprint(accessToken),
    sessionType: "offline",
    graphqlEndpoint: endpoint,
    httpStatus: null,
    runtimeApiKeyPrefix,
    storedClientIdPrefix,
    tokenDecryptSucceeded: true,
    appMatch,
    reinstallRequired: appMatch === false,
    hasRefreshToken: Boolean(refreshToken),
    refreshTokenExpiresAt: row.refresh_token_expires_at ?? null,
    reason:
      "verify-shopify-connection local diagnostics only — not Shopify API proof until probes run",
  }),
);

if (appMatch === false) {
  console.error(
    `App mismatch: stored token belongs to ${storedClientIdPrefix}… but deployment uses ${runtimeApiKeyPrefix}…. Reinstall required.`,
  );
  process.exit(1);
}

const headers = {
  "X-Shopify-Access-Token": accessToken,
  "Content-Type": "application/json",
};

async function refreshOfflineToken() {
  const clientId = process.env.SHOPIFY_API_KEY?.trim();
  const clientSecret = process.env.SHOPIFY_API_SECRET?.trim();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Cannot refresh: missing SHOPIFY_API_KEY/SECRET or refresh_token");
  }
  const refreshEndpoint = `https://${shop}/admin/oauth/access_token`;
  const response = await fetch(refreshEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const text = await response.text();
  console.log(
    JSON.stringify({
      installationId: row.id ?? null,
      shopDomain: shop,
      sessionType: "offline",
      graphqlEndpoint: refreshEndpoint,
      httpStatus: response.status,
      tokenDecryptSucceeded: true,
      reason: response.ok
        ? "offline refresh_token grant succeeded"
        : `offline refresh_token grant failed: ${text.slice(0, 180)}`,
    }),
  );
  if (!response.ok) {
    throw new Error(`refresh HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  const json = JSON.parse(text);
  if (!json.access_token || !json.refresh_token) {
    throw new Error("refresh returned incomplete token pair");
  }
  accessToken = json.access_token;
  refreshToken = json.refresh_token;
  headers["X-Shopify-Access-Token"] = accessToken;

  if (row.id) {
    const refreshExpiresAt =
      typeof json.refresh_token_expires_in === "number"
        ? new Date(Date.now() + json.refresh_token_expires_in * 1000).toISOString()
        : null;
    const { error: persistError } = await supabase
      .from("shopify_installations")
      .update({
        access_token_encrypted: encryptToken(accessToken),
        refresh_token_encrypted: encryptToken(refreshToken),
        refresh_token_expires_at: refreshExpiresAt,
        connection_health: "healthy",
        error_message: null,
        status: "active",
      })
      .eq("id", row.id);
    if (persistError) {
      throw new Error(`persist refreshed tokens failed: ${persistError.message}`);
    }
  }
}

let shopRes = await fetch(endpoint, { headers });
console.log(
  JSON.stringify({
    installationId: row.id ?? null,
    shopDomain: shop,
    tokenFingerprint: tokenFingerprint(accessToken),
    sessionType: "offline",
    graphqlEndpoint: endpoint,
    httpStatus: shopRes.status,
    tokenDecryptSucceeded: true,
    appMatch,
    reinstallRequired: false,
    reason: `shop.json probe HTTP ${shopRes.status}`,
  }),
);

if (shopRes.status === 401 && refreshToken) {
  console.log("shop.json returned 401 — attempting offline token refresh…");
  try {
    await refreshOfflineToken();
    shopRes = await fetch(endpoint, { headers });
  } catch (refreshErr) {
    console.error("Offline refresh failed:", refreshErr instanceof Error ? refreshErr.message : refreshErr);
    console.error("Merchant reauthorization is required if refresh_token is invalid/expired.");
    process.exit(1);
  }
}

if (!shopRes.ok) {
  console.error("Shopify shop.json failed:", shopRes.status, await shopRes.text());
  if (shopRes.status === 401) {
    console.error(
      refreshToken
        ? "Token still rejected after refresh — merchant reauthorization required."
        : "Token rejected and no refresh_token stored — open embedded app once or reauthorize.",
    );
  }
  process.exit(1);
}
console.log("healthCheck equivalent: connected");

const productsRes = await fetch(
  `https://${shop}/admin/api/${apiVersion}/products/count.json`,
  { headers },
);
const ordersRes = await fetch(
  `https://${shop}/admin/api/${apiVersion}/orders/count.json?status=any`,
  { headers },
);

if (!productsRes.ok || !ordersRes.ok) {
  console.error("Product/order count failed:", productsRes.status, ordersRes.status);
  process.exit(1);
}

const products = await productsRes.json();
const orders = await ordersRes.json();
console.log("products count:", products.count);
console.log("orders count:", orders.count);
console.log("sync verification: OK");
console.log(
  JSON.stringify({
    installationId: row.id ?? null,
    shopDomain: shop,
    tokenFingerprint: tokenFingerprint(accessToken),
    sessionType: "offline",
    merchantReauthorizationRequired: false,
    reason: "verify-shopify-connection probes succeeded",
  }),
);
