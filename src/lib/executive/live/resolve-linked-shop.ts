import { cache } from "react";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { resolveActiveStoreId } from "@/lib/store/context";
import { isSimulationStoreId } from "@/lib/simulation-lab/store-ids";
import { DEMO_STORE_ID } from "@/lib/types";

export type LinkedShopContext = {
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

const SHOP_SELECT =
  "id, shop_domain, shop_name, currency_code, store_id, last_incremental_sync_at, last_full_sync_at";

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


function toLinkedShopContext(shop: ShopRow, storeId: string): LinkedShopContext {
  return {
    shopId: shop.id,
    shopDomain: shop.shop_domain,
    shopName: shop.shop_name ?? shop.shop_domain,
    currencyCode: shop.currency_code ?? "USD",
    storeId: shop.store_id ?? storeId,
  };
}

/** Resolve the linked Shopify shop for the active store only — never cross stores. */
export const resolveLinkedShopForExecutive = cache(async (): Promise<LinkedShopContext | null> => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const resolvedStoreId = await resolveActiveStoreId();
  if (isSimulationStoreId(resolvedStoreId) || resolvedStoreId === DEMO_STORE_ID) {
    return null;
  }

  const shopByStore = await loadShopByStoreId(resolvedStoreId);
  if (shopByStore?.id) {
    return toLinkedShopContext(shopByStore, resolvedStoreId);
  }

  return null;
});
