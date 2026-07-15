import { decryptToken, encryptToken } from "@/lib/shopify/crypto";
import { SHOPIFY_REINSTALL_REQUIRED_PREFIX } from "@/lib/shopify/auth-errors";
import {
  resolveCurrentShopifyClientId,
  resolveShopifyAccessToken,
} from "@/lib/shopify/installation-auth";
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
  refreshToken?: string | null;
  refreshTokenExpires?: Date | null;
  /** Shopify Partner app client_id (API key) that issued the stored access token. */
  clientId: string | null;
};

type MemoryInstallation = ShopifyInstallation & {
  access_token_encrypted: string;
  refresh_token_encrypted?: string | null;
  refresh_token_expires_at?: string | null;
};

const memoryInstallations = new Map<string, MemoryInstallation>();
const memorySyncCache = new Map<string, { snapshot: Partial<StoreSnapshot>; synced_at: string }>();

function rowToInstallation(row: Record<string, unknown>): ShopifyInstallation {
  const refreshEncrypted = row.refresh_token_encrypted as string | null | undefined;
  let refreshToken: string | null = null;
  if (refreshEncrypted) {
    try {
      refreshToken = decryptToken(refreshEncrypted);
    } catch {
      refreshToken = null;
    }
  }

  const refreshExpiresRaw = row.refresh_token_expires_at as string | null | undefined;

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
    refreshToken,
    refreshTokenExpires: refreshExpiresRaw ? new Date(refreshExpiresRaw) : null,
    clientId: (row.client_id as string | null | undefined) ?? null,
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
    const resolved = resolveShopifyAccessToken({
      shopDomain: installation.shop_domain,
      accessTokenEncrypted: access_token_encrypted,
      storedClientId: installation.clientId,
    });
    return { ...installation, accessToken: resolved.accessToken };
  }

  const { data, error } = await supabase
    .from("shopify_installations")
    .select("*")
    .eq("shop_domain", shopDomain)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  const installation = rowToInstallation(row);
  const resolved = resolveShopifyAccessToken({
    shopDomain: installation.shop_domain,
    accessTokenEncrypted: row.access_token_encrypted as string,
    storedClientId: installation.clientId,
  });
  return {
    ...installation,
    accessToken: resolved.accessToken,
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
    const resolved = resolveShopifyAccessToken({
      shopDomain: installation.shop_domain,
      accessTokenEncrypted: access_token_encrypted,
      storedClientId: installation.clientId,
    });
    return { ...installation, accessToken: resolved.accessToken };
  }

  const { data, error } = await supabase
    .from("shopify_installations")
    .select("*")
    .eq("store_id", storeId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) {
    console.log("[sync-trace] getInstallationByStoreId miss", {
      storeId,
      table: "shopify_installations",
      found: false,
    });
    return null;
  }
  const row = data as Record<string, unknown>;
  const installation = rowToInstallation(row);
  const resolved = resolveShopifyAccessToken({
    shopDomain: installation.shop_domain,
    accessTokenEncrypted: row.access_token_encrypted as string,
    storedClientId: installation.clientId,
  });
  return {
    ...installation,
    accessToken: resolved.accessToken,
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

/** Metadata-only lookup — does not decrypt access tokens (safe for tenant routing). */
export async function getActiveStoreIdForShopDomain(shopDomain: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const row = [...memoryInstallations.values()].find(
      (i) => i.shop_domain === shopDomain && i.status === "active",
    );
    return row?.store_id ?? null;
  }

  const { data, error } = await supabase
    .from("shopify_installations")
    .select("store_id")
    .eq("shop_domain", shopDomain)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? (data as { store_id: string }).store_id : null;
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
  refreshToken?: string;
  refreshTokenExpires?: Date;
  clientId?: string;
}): Promise<ShopifyInstallation> {
  const encrypted = encryptToken(input.accessToken);
  const clientId = input.clientId?.trim() || resolveCurrentShopifyClientId();
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();

  console.log(
    "[shopify-persist]",
    JSON.stringify({
      phase: "upsertShopifyInstallation",
      shopDomain: input.shopDomain,
      storeId: input.storeId,
      clientIdPrefix: clientId ? clientId.slice(0, 6) : null,
      hasSupabase: Boolean(supabase),
      hasRefreshToken: Boolean(input.refreshToken),
    }),
  );

  if (!supabase) {
    const existing = [...memoryInstallations.values()].find(
      (i) => i.shop_domain === input.shopDomain,
    );
    const id = existing?.id ?? crypto.randomUUID();
    const refreshEncrypted = input.refreshToken
      ? encryptToken(input.refreshToken)
      : (existing?.refresh_token_encrypted ?? null);
    const record: MemoryInstallation = {
      id,
      store_id: input.storeId,
      shop_domain: input.shopDomain,
      access_token_encrypted: encrypted,
      refresh_token_encrypted: refreshEncrypted,
      refresh_token_expires_at: input.refreshToken
        ? (input.refreshTokenExpires?.toISOString() ?? null)
        : (existing?.refresh_token_expires_at ?? null),
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
      refreshToken: input.refreshToken ?? existing?.refreshToken ?? null,
      refreshTokenExpires: input.refreshToken
        ? (input.refreshTokenExpires ?? null)
        : (existing?.refreshTokenExpires ?? null),
      clientId: clientId ?? null,
    };
    memoryInstallations.set(id, record);
    return rowToInstallation(record as unknown as Record<string, unknown>);
  }

  const upsertRow: Record<string, unknown> = {
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
    client_id: clientId,
  };
  // Never wipe an existing refresh_token when the session payload omits it.
  if (input.refreshToken) {
    upsertRow.refresh_token_encrypted = encryptToken(input.refreshToken);
    upsertRow.refresh_token_expires_at = input.refreshTokenExpires?.toISOString() ?? null;
  }

  const { data, error } = await supabase
    .from("shopify_installations")
    .upsert(upsertRow, { onConflict: "shop_domain" })
    .select()
    .single();

  if (error) {
    console.error("[shopify-persist] upsertShopifyInstallation failed", {
      shopDomain: input.shopDomain,
      message: error.message,
      code: error.code,
    });
    throw new Error(error.message);
  }

  const installation = rowToInstallation(data as Record<string, unknown>);
  console.log(
    "[shopify-persist]",
    JSON.stringify({
      phase: "upsertShopifyInstallation complete",
      shopDomain: installation.shop_domain,
      storeId: installation.store_id,
      status: installation.status,
      clientIdPrefix: installation.clientId ? installation.clientId.slice(0, 6) : null,
    }),
  );
  return installation;
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
      refresh_token_encrypted: "",
      refresh_token_expires_at: null,
      client_id: null,
    } as Record<string, unknown>)
    .eq("shop_domain", shopDomain);
}

function clearMemoryShopifyCaches(storeId?: string): void {
  if (storeId) {
    memorySyncCache.delete(storeId);
    for (const [id, row] of memoryInstallations) {
      if (row.store_id === storeId) {
        memoryInstallations.delete(id);
      }
    }
    return;
  }

  memoryInstallations.clear();
  memorySyncCache.clear();
}

/** Remove stale installation + sync cache so OAuth can store a fresh encrypted token. */
export async function purgeShopifyInstallationData(options?: {
  shopDomain?: string;
  storeId?: string;
}): Promise<{ purged: Array<{ shopDomain: string; storeId: string }> }> {
  const supabase = getSupabaseAdmin();
  const shopDomain = options?.shopDomain?.trim();
  const storeId = options?.storeId?.trim();

  if (!supabase) {
    const targets = [...memoryInstallations.values()].filter((row) => {
      if (shopDomain && row.shop_domain !== shopDomain) return false;
      if (storeId && row.store_id !== storeId) return false;
      return true;
    });
    for (const row of targets) {
      clearMemoryShopifyCaches(row.store_id);
    }
    return {
      purged: targets.map((row) => ({
        shopDomain: row.shop_domain,
        storeId: row.store_id,
      })),
    };
  }

  let query = supabase
    .from("shopify_installations")
    .select("id, store_id, shop_domain");

  if (shopDomain) query = query.eq("shop_domain", shopDomain);
  if (storeId) query = query.eq("store_id", storeId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{ id: string; store_id: string; shop_domain: string }>;
  for (const row of rows) {
    const { error: cacheError } = await supabase
      .from("shopify_sync_cache")
      .delete()
      .eq("store_id", row.store_id);
    if (cacheError) throw new Error(cacheError.message);

    const { error: installError } = await supabase
      .from("shopify_installations")
      .delete()
      .eq("id", row.id);
    if (installError) throw new Error(installError.message);

    clearMemoryShopifyCaches(row.store_id);
  }

  return {
    purged: rows.map((row) => ({
      shopDomain: row.shop_domain,
      storeId: row.store_id,
    })),
  };
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

export async function markShopifyReinstallRequired(
  shopDomain: string,
  reason: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const message = `${SHOPIFY_REINSTALL_REQUIRED_PREFIX} ${reason}`;

  console.log("[shopify-persist] markShopifyReinstallRequired", {
    shopDomain,
    reason,
    hasSupabase: Boolean(supabase),
  });

  if (!supabase) {
    for (const [id, row] of memoryInstallations) {
      if (row.shop_domain === shopDomain) {
        memoryInstallations.set(id, {
          ...row,
          connection_health: "error",
          error_message: message,
        });
      }
    }
    return;
  }

  const { error } = await supabase
    .from("shopify_installations")
    .update({
      connection_health: "error",
      error_message: message,
    } as Record<string, unknown>)
    .eq("shop_domain", shopDomain);

  if (error) {
    console.error("[shopify-persist] markShopifyReinstallRequired failed", {
      shopDomain,
      message: error.message,
    });
    throw new Error(error.message);
  }
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
