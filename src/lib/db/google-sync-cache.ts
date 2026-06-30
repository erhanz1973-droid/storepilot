import type { StoreSnapshot } from "@/lib/connectors/types";
import { getSupabaseAdmin } from "@/lib/supabase/client";

const memoryCache = new Map<string, { snapshot: Partial<StoreSnapshot>; synced_at: string }>();

export async function setGoogleSyncCache(
  storeId: string,
  snapshot: Partial<StoreSnapshot>,
): Promise<void> {
  const now = new Date().toISOString();
  memoryCache.set(storeId, { snapshot, synced_at: now });

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase.from("google_sync_cache").upsert(
    { store_id: storeId, snapshot, synced_at: now } as Record<string, unknown>,
    { onConflict: "store_id" },
  );
}

export async function getGoogleSyncCache(
  storeId: string,
): Promise<Partial<StoreSnapshot> | null> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return memoryCache.get(storeId)?.snapshot ?? null;
  }

  const { data } = await supabase
    .from("google_sync_cache")
    .select("snapshot")
    .eq("store_id", storeId)
    .maybeSingle();

  if (data) {
    const snapshot = (data as { snapshot: Partial<StoreSnapshot> }).snapshot ?? null;
    if (snapshot) memoryCache.set(storeId, { snapshot, synced_at: new Date().toISOString() });
    return snapshot;
  }

  return memoryCache.get(storeId)?.snapshot ?? null;
}

const cacheStats = new Map<
  string,
  { createdAt: string | null; hitCount: number; missCount: number }
>();

export function getGoogleCacheDebugInfo(storeId: string): {
  cacheKey: string;
  createdAt: string | null;
  hitCount: number;
  missCount: number;
} {
  const cached = memoryCache.get(storeId);
  const stats = cacheStats.get(storeId);
  return {
    cacheKey: `google_sync:${storeId}`,
    createdAt: stats?.createdAt ?? cached?.synced_at ?? null,
    hitCount: stats?.hitCount ?? 0,
    missCount: stats?.missCount ?? 0,
  };
}
