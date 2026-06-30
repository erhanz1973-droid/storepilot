import { decryptToken, encryptToken } from "@/lib/shopify/crypto";
import type { ShopifySyncStats } from "@/lib/shopify/sync";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { StoreSnapshot } from "@/lib/connectors/types";

export type ShopifyInstallation = {
  id: string;
  store_id: string;
  shop_domain: string;
  shop_name: string | null;
  shopify_plan: string | null;
  scopes: string[];
  status: "active" | "uninstalled" | "error";
  connection_health: "healthy" | "degraded" | "error" | "disconnected";
  error_message: string | null;
  installed_at: string;
  uninstalled_at: string | null;
  last_sync_at: string | null;
  sync_stats: ShopifySyncStats;
};

type MemoryInstallation = ShopifyInstallation & { access_token_encrypted: string };

const memoryInstallations = new Map<string, MemoryInstallation>();
const memorySyncCache = new Map<string, { snapshot: Partial<StoreSnapshot>; synced_at: string }>();

function rowToInstallation(row: Record<string, unknown>): ShopifyInstallation {
  return {
    id: row.id as string,
    store_id: row.store_id as string,
    shop_domain: row.shop_domain as string,
    shop_name: (row.shop_name as string) ?? null,
    shopify_plan: (row.shopify_plan as string) ?? null,
    scopes: (row.scopes as string[]) ?? [],
    status: row.status as ShopifyInstallation["status"],
    connection_health: row.connection_health as ShopifyInstallation["connection_health"],
    error_message: (row.error_message as string) ?? null,
    installed_at: row.installed_at as string,
    uninstalled_at: (row.uninstalled_at as string) ?? null,
    last_sync_at: (row.last_sync_at as string) ?? null,
    sync_stats: (row.sync_stats as ShopifySyncStats) ?? {
      productCount: 0,
      inventoryCount: 0,
      orderCount: 0,
      customerCount: 0,
      collectionCount: 0,
      discountCount: 0,
    },
  };
}

export async function getInstallationByShopDomain(
  shopDomain: string,
): Promise<(ShopifyInstallation & { accessToken: string }) | null> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const row = [...memoryInstallations.values()].find(
      (i) => i.shop_domain === shopDomain && i.status === "active",
    );
    if (!row) return null;
    const { access_token_encrypted, ...installation } = row;
    return { ...installation, accessToken: decryptToken(access_token_encrypted) };
  }

  const { data, error } = await supabase
    .from("shopify_installations")
    .select("*")
    .eq("shop_domain", shopDomain)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    ...rowToInstallation(row),
    accessToken: decryptToken(row.access_token_encrypted as string),
  };
}

export async function getInstallationByStoreId(
  storeId: string,
): Promise<(ShopifyInstallation & { accessToken: string }) | null> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const row = [...memoryInstallations.values()].find(
      (i) => i.store_id === storeId && i.status === "active",
    );
    if (!row) return null;
    const { access_token_encrypted, ...installation } = row;
    return { ...installation, accessToken: decryptToken(access_token_encrypted) };
  }

  const { data, error } = await supabase
    .from("shopify_installations")
    .select("*")
    .eq("store_id", storeId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    ...rowToInstallation(row),
    accessToken: decryptToken(row.access_token_encrypted as string),
  };
}

export async function getInstallationForStore(
  storeId: string,
): Promise<ShopifyInstallation | null> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const row = [...memoryInstallations.values()].find(
      (i) => i.store_id === storeId && i.status === "active",
    );
    return row ? rowToInstallation(row as unknown as Record<string, unknown>) : null;
  }

  const { data } = await supabase
    .from("shopify_installations")
    .select("*")
    .eq("store_id", storeId)
    .eq("status", "active")
    .maybeSingle();

  return data ? rowToInstallation(data as Record<string, unknown>) : null;
}

export async function getActiveShopifyInstallation(): Promise<ShopifyInstallation | null> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const row = [...memoryInstallations.values()].find((i) => i.status === "active");
    return row ? rowToInstallation(row as unknown as Record<string, unknown>) : null;
  }

  const { data } = await supabase
    .from("shopify_installations")
    .select("*")
    .eq("status", "active")
    .order("installed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? rowToInstallation(data as Record<string, unknown>) : null;
}

export async function upsertShopifyInstallation(input: {
  storeId: string;
  shopDomain: string;
  accessToken: string;
  scopes: string[];
  shopName?: string;
  shopifyPlan?: string;
}): Promise<ShopifyInstallation> {
  const encrypted = encryptToken(input.accessToken);
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const existing = [...memoryInstallations.values()].find(
      (i) => i.shop_domain === input.shopDomain,
    );
    const id = existing?.id ?? crypto.randomUUID();
    const record: MemoryInstallation = {
      id,
      store_id: input.storeId,
      shop_domain: input.shopDomain,
      access_token_encrypted: encrypted,
      shop_name: input.shopName ?? null,
      shopify_plan: input.shopifyPlan ?? null,
      scopes: input.scopes,
      status: "active",
      connection_health: "healthy",
      error_message: null,
      installed_at: existing?.installed_at ?? now,
      uninstalled_at: null,
      last_sync_at: null,
      sync_stats: existing?.sync_stats ?? {
        productCount: 0,
        inventoryCount: 0,
        orderCount: 0,
        customerCount: 0,
        collectionCount: 0,
        discountCount: 0,
      },
    };
    memoryInstallations.set(id, record);
    return rowToInstallation(record as unknown as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("shopify_installations")
    .upsert(
      {
        store_id: input.storeId,
        shop_domain: input.shopDomain,
        access_token_encrypted: encrypted,
        scopes: input.scopes,
        shop_name: input.shopName ?? null,
        shopify_plan: input.shopifyPlan ?? null,
        status: "active",
        connection_health: "healthy",
        error_message: null,
        uninstalled_at: null,
        installed_at: now,
      } as Record<string, unknown>,
      { onConflict: "shop_domain" },
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToInstallation(data as Record<string, unknown>);
}

export async function markShopifyUninstalled(shopDomain: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  if (!supabase) {
    for (const [id, row] of memoryInstallations) {
      if (row.shop_domain === shopDomain) {
        memoryInstallations.set(id, {
          ...row,
          status: "uninstalled",
          connection_health: "disconnected",
          uninstalled_at: now,
          access_token_encrypted: "",
        });
      }
    }
    return;
  }

  await supabase
    .from("shopify_installations")
    .update({
      status: "uninstalled",
      connection_health: "disconnected",
      uninstalled_at: now,
      access_token_encrypted: "",
    } as Record<string, unknown>)
    .eq("shop_domain", shopDomain);
}

export async function updateShopifySyncResult(
  storeId: string,
  stats: ShopifySyncStats,
  snapshot: Partial<StoreSnapshot>,
  meta?: { shopName?: string; shopifyPlan?: string; error?: string },
): Promise<void> {
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    for (const [id, row] of memoryInstallations) {
      if (row.store_id === storeId) {
        memoryInstallations.set(id, {
          ...row,
          last_sync_at: now,
          sync_stats: stats,
          shop_name: meta?.shopName ?? row.shop_name,
          shopify_plan: meta?.shopifyPlan ?? row.shopify_plan,
          connection_health: meta?.error ? "error" : "healthy",
          error_message: meta?.error ?? null,
        });
      }
    }
    memorySyncCache.set(storeId, { snapshot, synced_at: now });
    return;
  }

  await supabase
    .from("shopify_installations")
    .update({
      last_sync_at: now,
      sync_stats: stats,
      shop_name: meta?.shopName,
      shopify_plan: meta?.shopifyPlan,
      connection_health: meta?.error ? "error" : "healthy",
      error_message: meta?.error ?? null,
    } as Record<string, unknown>)
    .eq("store_id", storeId)
    .eq("status", "active");

  await supabase.from("shopify_sync_cache").upsert(
    { store_id: storeId, snapshot, synced_at: now } as Record<string, unknown>,
    { onConflict: "store_id" },
  );
}

export async function getCachedShopifySnapshot(
  storeId: string,
): Promise<Partial<StoreSnapshot> | null> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return memorySyncCache.get(storeId)?.snapshot ?? null;
  }

  const { data } = await supabase
    .from("shopify_sync_cache")
    .select("snapshot")
    .eq("store_id", storeId)
    .maybeSingle();

  return data ? ((data as { snapshot: Partial<StoreSnapshot> }).snapshot ?? null) : null;
}

export async function createStoreForShop(shopName: string, shopDomain: string): Promise<string> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return crypto.randomUUID();
  }

  const { data, error } = await supabase
    .from("stores")
    .insert({ name: shopName, shopify_domain: shopDomain } as Record<string, unknown>)
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function findStoreByShopDomain(shopDomain: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const inst = [...memoryInstallations.values()].find((i) => i.shop_domain === shopDomain);
    return inst?.store_id ?? null;
  }

  const { data } = await supabase
    .from("stores")
    .select("id")
    .eq("shopify_domain", shopDomain)
    .maybeSingle();

  return data ? (data as { id: string }).id : null;
}
