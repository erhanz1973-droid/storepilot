import { getSupabaseAdmin } from "@/lib/supabase/client";

export type ShopifyConnectionAudit = {
  storeId: string;
  shopifyInstallation: {
    found: boolean;
    shopDomain: string | null;
    status: string | null;
  };
  shopsRow: {
    found: boolean;
    shopDomain: string | null;
    storeId: string | null;
  };
  storesRow: {
    found: boolean;
    shopifyDomain: string | null;
  };
  connectedVia: "shopify_installations" | "shops" | "stores_only" | "none";
  likelyCause: string | null;
};

/** Non-secret audit for Shopify connection resolution (embedded vs web OAuth). */
export async function auditShopifyConnection(
  storeId: string,
): Promise<ShopifyConnectionAudit> {
  const supabase = getSupabaseAdmin();

  const audit: ShopifyConnectionAudit = {
    storeId,
    shopifyInstallation: { found: false, shopDomain: null, status: null },
    shopsRow: { found: false, shopDomain: null, storeId: null },
    storesRow: { found: false, shopifyDomain: null },
    connectedVia: "none",
    likelyCause: null,
  };

  if (!supabase) {
    audit.likelyCause = "Supabase admin client not configured";
    return audit;
  }

  const [installationRes, shopsRes, storesRes] = await Promise.all([
    supabase
      .from("shopify_installations")
      .select("shop_domain, status")
      .eq("store_id", storeId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("shops")
      .select("shop_domain, store_id")
      .eq("store_id", storeId)
      .maybeSingle(),
    supabase
      .from("stores")
      .select("shopify_domain")
      .eq("id", storeId)
      .maybeSingle(),
  ]);

  if (installationRes.data) {
    audit.shopifyInstallation = {
      found: true,
      shopDomain: installationRes.data.shop_domain as string,
      status: installationRes.data.status as string,
    };
    audit.connectedVia = "shopify_installations";
  }

  if (shopsRes.data) {
    audit.shopsRow = {
      found: true,
      shopDomain: shopsRes.data.shop_domain as string,
      storeId: (shopsRes.data.store_id as string | null) ?? null,
    };
    if (audit.connectedVia === "none") audit.connectedVia = "shops";
  }

  if (storesRes.data) {
    audit.storesRow = {
      found: true,
      shopifyDomain: (storesRes.data.shopify_domain as string | null) ?? null,
    };
    if (audit.connectedVia === "none") audit.connectedVia = "stores_only";
  }

  if (!audit.shopifyInstallation.found) {
    if (audit.shopsRow.found) {
      audit.likelyCause =
        "Embedded app synced to shops but shopify_installations is empty — re-run Shopify sync from the embedded app (needs SHOPIFY_TOKEN_ENCRYPTION_KEY) or complete web app Shopify OAuth.";
    } else if (audit.storesRow.found) {
      audit.likelyCause =
        "stores row exists but no shops or shopify_installations link — complete Shopify OAuth or embedded app sync.";
    } else {
      audit.likelyCause = "No store linkage found for this storeId in Supabase.";
    }
  }

  return audit;
}

export function logShopifyConnectionAudit(
  context: string,
  audit: ShopifyConnectionAudit,
): void {
  console.log(`[sync-trace] ${context} shopify connection audit`, {
    storeId: audit.storeId,
    connectedVia: audit.connectedVia,
    shopifyInstallationFound: audit.shopifyInstallation.found,
    shopifyInstallationDomain: audit.shopifyInstallation.shopDomain,
    shopsRowFound: audit.shopsRow.found,
    shopsRowDomain: audit.shopsRow.shopDomain,
    storesRowFound: audit.storesRow.found,
    storesShopifyDomain: audit.storesRow.shopifyDomain,
    likelyCause: audit.likelyCause,
  });
}
