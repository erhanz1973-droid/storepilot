#!/usr/bin/env node
/**
 * Verify Shopify token decrypts and sync works against production Supabase + Shopify API.
 * Usage: railway run node scripts/verify-shopify-connection.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { createDecipheriv, createHash } from "crypto";

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

function decryptToken(payload) {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted token format");
  }
  const derivedKey = createHash("sha256").update(encryptionSecret).digest();
  const decipher = createDecipheriv("aes-256-gcm", derivedKey, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let query = supabase
  .from("shopify_installations")
  .select("store_id, shop_domain, access_token_encrypted, connection_health, status")
  .eq("status", "active");
if (shopDomain) query = query.eq("shop_domain", shopDomain);

let { data: rows, error } = await query.limit(1);
if (error?.message?.includes("client_id")) {
  query = supabase
    .from("shopify_installations")
    .select("store_id, shop_domain, access_token_encrypted, connection_health, status")
    .eq("status", "active");
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

const runtimeApiKey = process.env.SHOPIFY_API_KEY?.trim() ?? "";
const runtimeApiKeyPrefix = runtimeApiKey ? runtimeApiKey.slice(0, 6) : null;
const storedClientId = row.client_id?.trim() || null;
const storedClientIdPrefix = storedClientId ? storedClientId.slice(0, 6) : null;
const appMatch =
  storedClientId && runtimeApiKey ? storedClientId === runtimeApiKey : null;

console.log(
  JSON.stringify({
    shopDomain: row.shop_domain,
    runtimeApiKeyPrefix,
    storedClientIdPrefix,
    tokenDecryptSucceeded: true,
    appMatch,
    reinstallRequired: appMatch === false,
  }),
);

if (appMatch === false) {
  console.error(
    `App mismatch: stored token belongs to ${storedClientIdPrefix}… but deployment uses ${runtimeApiKeyPrefix}…. Reinstall required.`,
  );
  process.exit(1);
}

const shop = row.shop_domain;
const apiVersion = process.env.SHOPIFY_API_VERSION?.trim() || "2024-10";
const headers = {
  "X-Shopify-Access-Token": accessToken,
  "Content-Type": "application/json",
};

const shopRes = await fetch(`https://${shop}/admin/api/${apiVersion}/shop.json`, { headers });
if (!shopRes.ok) {
  console.error("Shopify shop.json failed:", shopRes.status, await shopRes.text());
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
