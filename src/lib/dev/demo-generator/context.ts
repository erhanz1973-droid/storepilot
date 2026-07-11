import { getSupabaseAdmin } from "@/lib/supabase/client";
import { getActiveShopifyInstallation } from "@/lib/db/shopify";
import { resolveActiveStoreId } from "@/lib/store/context";

export type DemoShopContext = {
  shopId: string;
  shopDomain: string;
  shopName: string;
  currencyCode: string;
  storeId: string;
};

type ShopRow = {
  id: string;
  shop_domain: string;
  shop_name: string | null;
  currency_code: string | null;
  store_id: string | null;
};

const SHOP_SELECT = "id, shop_domain, shop_name, currency_code, store_id";

function toDemoShopContext(shop: ShopRow, storeId: string): DemoShopContext {
  return {
    shopId: shop.id,
    shopDomain: shop.shop_domain,
    shopName: shop.shop_name ?? shop.shop_domain,
    currencyCode: shop.currency_code ?? "USD",
    storeId: shop.store_id ?? storeId,
  };
}

async function loadShopByStoreId(storeId: string): Promise<ShopRow | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("shops")
    .select(SHOP_SELECT)
    .eq("store_id", storeId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? (data as ShopRow) : null;
}

/** Same shops lookup the embedded Executive Dashboard uses (by shop_domain). */
async function loadShopByDomain(shopDomain: string): Promise<ShopRow | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("shops")
    .select(SHOP_SELECT)
    .eq("shop_domain", shopDomain)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? (data as ShopRow) : null;
}

export async function resolveDemoShopContext(): Promise<DemoShopContext> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const resolvedStoreId = await resolveActiveStoreId();
  const shopByStore = await loadShopByStoreId(resolvedStoreId);

  if (shopByStore) {
    return toDemoShopContext(shopByStore, resolvedStoreId);
  }

  const installation = await getActiveShopifyInstallation();
  if (installation?.shop_domain) {
    const shopByDomain = await loadShopByDomain(installation.shop_domain);
    if (shopByDomain) {
      console.log("[demo-generator] cookie store has no shops row; using linked shop", {
        cookieStoreId: resolvedStoreId,
        installationStoreId: installation.store_id,
        shopDomain: installation.shop_domain,
        shopId: shopByDomain.id,
        shopsStoreId: shopByDomain.store_id,
      });
      return toDemoShopContext(shopByDomain, installation.store_id);
    }
  }

  console.log("[demo-generator] shop lookup failed", {
    cookieStoreId: resolvedStoreId,
    installationStoreId: installation?.store_id ?? null,
    installationShopDomain: installation?.shop_domain ?? null,
  });

  throw new Error(
    "No linked Shopify shop found in Supabase. Run a Shopify sync from the embedded app first.",
  );
}

export function isDemoGid(gid: string): boolean {
  return gid.startsWith("gid://storepilot-demo/");
}
