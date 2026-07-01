#!/usr/bin/env node
/**
 * Purge Shopify installation rows encrypted with a stale key.
 * Usage (production): railway run node scripts/purge-shopify-installation.mjs
 * Optional: SHOP_DOMAIN=your-store.myshopify.com node scripts/purge-shopify-installation.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const shopDomain = process.env.SHOP_DOMAIN?.trim();

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let query = supabase.from("shopify_installations").select("id, store_id, shop_domain");
if (shopDomain) query = query.eq("shop_domain", shopDomain);

const { data: rows, error } = await query;
if (error) {
  console.error("Failed to list installations:", error.message);
  process.exit(1);
}

if (!rows?.length) {
  console.log("No Shopify installations found to purge.");
  process.exit(0);
}

for (const row of rows) {
  const { error: cacheError } = await supabase
    .from("shopify_sync_cache")
    .delete()
    .eq("store_id", row.store_id);
  if (cacheError) {
    console.error(`Failed to delete sync cache for ${row.shop_domain}:`, cacheError.message);
    process.exit(1);
  }

  const { error: installError } = await supabase
    .from("shopify_installations")
    .delete()
    .eq("id", row.id);
  if (installError) {
    console.error(`Failed to delete installation ${row.shop_domain}:`, installError.message);
    process.exit(1);
  }

  console.log(`Purged installation and sync cache: ${row.shop_domain} (${row.store_id})`);
}

const appUrl =
  process.env.SHOPIFY_APP_URL?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  "https://storepilot-production-d591.up.railway.app";

const shop = shopDomain ?? rows[0].shop_domain;
console.log("");
console.log("Re-install Shopify OAuth:");
console.log(`${appUrl}/api/shopify/auth?shop=${encodeURIComponent(shop)}`);
