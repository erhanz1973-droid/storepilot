import type { StoreSnapshot } from "@/lib/connectors/types";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { MetaCacheDebugInfo } from "@/lib/validation/meta/types";

const memoryCache = new Map<
  string,
  { snapshot: Partial<StoreSnapshot>; synced_at: string }
>();

const cacheStats = new Map<
  string,
  {
    createdAt: string | null;
    lastHitAt: string | null;
    lastMissAt: string | null;
    hitCount: number;
    missCount: number;
  }
>();

function cacheKey(storeId: string): string {
  return `meta_sync:${storeId}`;
}

function ensureStats(storeId: string) {
  if (!cacheStats.has(storeId)) {
    cacheStats.set(storeId, {
      createdAt: null,
      lastHitAt: null,
      lastMissAt: null,
      hitCount: 0,
      missCount: 0,
    });
  }
  return cacheStats.get(storeId)!;
}

export async function setMetaSyncCache(
  storeId: string,
  snapshot: Partial<StoreSnapshot>,
): Promise<void> {
  const now = new Date().toISOString();
  memoryCache.set(storeId, { snapshot, synced_at: now });

  const stats = ensureStats(storeId);
  stats.createdAt = now;

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase.from("meta_sync_cache").upsert(
    { store_id: storeId, snapshot, synced_at: now } as Record<string, unknown>,
    { onConflict: "store_id" },
  );
}

export async function getMetaSyncCache(
  storeId: string,
): Promise<Partial<StoreSnapshot> | null> {
  const stats = ensureStats(storeId);
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const hit = memoryCache.get(storeId)?.snapshot ?? null;
    if (hit) {
      stats.hitCount += 1;
      stats.lastHitAt = new Date().toISOString();
    } else {
      stats.missCount += 1;
      stats.lastMissAt = new Date().toISOString();
    }
    return hit;
  }

  const { data } = await supabase
    .from("meta_sync_cache")
    .select("snapshot, synced_at")
    .eq("store_id", storeId)
    .maybeSingle();

  if (data) {
    const row = data as { snapshot: Partial<StoreSnapshot>; synced_at?: string };
    const snapshot = row.snapshot ?? null;
    if (snapshot) {
      memoryCache.set(storeId, {
        snapshot,
        synced_at: row.synced_at ?? new Date().toISOString(),
      });
      if (!stats.createdAt && row.synced_at) stats.createdAt = row.synced_at;
      stats.hitCount += 1;
      stats.lastHitAt = new Date().toISOString();
    }
    return snapshot;
  }

  const mem = memoryCache.get(storeId)?.snapshot ?? null;
  if (mem) {
    stats.hitCount += 1;
    stats.lastHitAt = new Date().toISOString();
  } else {
    stats.missCount += 1;
    stats.lastMissAt = new Date().toISOString();
  }
  return mem;
}

export async function clearMetaSyncCache(storeId: string): Promise<void> {
  memoryCache.delete(storeId);
  const stats = ensureStats(storeId);
  stats.createdAt = null;

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase.from("meta_sync_cache").delete().eq("store_id", storeId);
}

export function getMetaCacheDebugInfo(storeId: string): MetaCacheDebugInfo {
  const stats = ensureStats(storeId);
  const cached = memoryCache.get(storeId);
  const campaignCount = cached?.snapshot.campaigns?.length ?? 0;

  return {
    cacheKey: cacheKey(storeId),
    createdAt: stats.createdAt ?? cached?.synced_at ?? null,
    expiresAt: null,
    lastHitAt: stats.lastHitAt,
    lastMissAt: stats.lastMissAt,
    hitCount: stats.hitCount,
    missCount: stats.missCount,
    campaignCount,
  };
}
