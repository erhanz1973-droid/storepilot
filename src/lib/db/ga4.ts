import { decryptGoogleToken, encryptGoogleToken } from "@/lib/google-ads/crypto";
import { refreshGa4AccessToken } from "@/lib/ga4/oauth";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { GA4Snapshot } from "@/lib/integrations/types";

export type Ga4InstallStatus = "active" | "disconnected" | "error";

export type Ga4Installation = {
  id: string;
  store_id: string;
  google_user_id: string;
  google_user_email: string | null;
  account_id: string;
  account_name: string | null;
  property_id: string;
  property_name: string | null;
  data_stream_id: string | null;
  data_stream_name: string | null;
  measurement_id: string | null;
  scopes: string[];
  status: Ga4InstallStatus;
  connection_health: "healthy" | "degraded" | "error" | "disconnected";
  error_message: string | null;
  installed_at: string;
  disconnected_at: string | null;
  last_sync_at: string | null;
  token_expires_at: string | null;
};

export type Ga4OAuthPending = {
  id: string;
  store_id: string;
  google_user_id: string;
  google_user_email: string | null;
  scopes: string[];
  expires_at: string;
  token_expires_at: string | null;
};

type MemoryInstall = Ga4Installation & {
  access_token_encrypted: string;
  refresh_token_encrypted: string;
};
type MemoryPending = Ga4OAuthPending & {
  access_token_encrypted: string;
  refresh_token_encrypted: string;
};

const memoryInstalls = new Map<string, MemoryInstall>();
const memoryPending = new Map<string, MemoryPending>();
const memoryCache = new Map<string, { snapshot: GA4Snapshot; synced_at: string }>();

function pendingFromMemory(record: MemoryPending): Ga4OAuthPending {
  const { access_token_encrypted: _a, refresh_token_encrypted: _r, ...pending } = record;
  return pending;
}

function supabaseErrorMessage(error: { message?: string; code?: string; details?: string }): string {
  const parts = [error.message, error.details, error.code].filter(Boolean);
  return parts.join(" — ") || "Database error";
}

function isGa4SchemaMissing(error: { message?: string; code?: string }): boolean {
  const msg = error.message ?? "";
  return (
    error.code === "42P01" ||
    /ga4_oauth_pending|ga4_installations|ga4_sync_cache|relation.*does not exist/i.test(msg)
  );
}

function memoryToInstall(record: MemoryInstall): Ga4Installation {
  const { access_token_encrypted: _a, refresh_token_encrypted: _r, ...install } = record;
  return install;
}

function rowToInstall(row: Record<string, unknown>): Ga4Installation {
  return {
    id: row.id as string,
    store_id: row.store_id as string,
    google_user_id: row.google_user_id as string,
    google_user_email: (row.google_user_email as string) ?? null,
    account_id: row.account_id as string,
    account_name: (row.account_name as string) ?? null,
    property_id: row.property_id as string,
    property_name: (row.property_name as string) ?? null,
    data_stream_id: (row.data_stream_id as string) ?? null,
    data_stream_name: (row.data_stream_name as string) ?? null,
    measurement_id: (row.measurement_id as string) ?? null,
    scopes: (row.scopes as string[]) ?? [],
    status: row.status as Ga4InstallStatus,
    connection_health: row.connection_health as Ga4Installation["connection_health"],
    error_message: (row.error_message as string) ?? null,
    installed_at: row.installed_at as string,
    disconnected_at: (row.disconnected_at as string) ?? null,
    last_sync_at: (row.last_sync_at as string) ?? null,
    token_expires_at: (row.token_expires_at as string) ?? null,
  };
}

export async function createGa4OAuthPending(input: {
  storeId: string;
  googleUserId: string;
  googleUserEmail?: string;
  accessToken: string;
  refreshToken: string;
  scopes: string[];
  tokenExpiresAt?: string;
}): Promise<Ga4OAuthPending> {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
  const accessEncrypted = encryptGoogleToken(input.accessToken);
  const refreshEncrypted = encryptGoogleToken(input.refreshToken);

  const memoryRecord: MemoryPending = {
    id,
    store_id: input.storeId,
    google_user_id: input.googleUserId,
    google_user_email: input.googleUserEmail ?? null,
    scopes: input.scopes,
    expires_at: expiresAt,
    token_expires_at: input.tokenExpiresAt ?? null,
    access_token_encrypted: accessEncrypted,
    refresh_token_encrypted: refreshEncrypted,
  };

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    memoryPending.set(id, memoryRecord);
    return pendingFromMemory(memoryRecord);
  }

  const { data, error } = await supabase
    .from("ga4_oauth_pending")
    .insert({
      id,
      store_id: input.storeId,
      google_user_id: input.googleUserId,
      google_user_email: input.googleUserEmail,
      access_token_encrypted: accessEncrypted,
      refresh_token_encrypted: refreshEncrypted,
      token_expires_at: input.tokenExpiresAt,
      scopes: input.scopes,
      expires_at: expiresAt,
    })
    .select("id, store_id, google_user_id, google_user_email, scopes, expires_at, token_expires_at")
    .single();

  if (error) {
    const msg = supabaseErrorMessage(error);
    if (isGa4SchemaMissing(error)) {
      console.warn(
        "[ga4] ga4_oauth_pending table missing — run migration 20260711120000_ga4_oauth.sql. Using in-memory OAuth session.",
      );
    } else {
      console.warn("[ga4] ga4_oauth_pending insert failed, using in-memory session:", msg);
    }
    memoryPending.set(id, memoryRecord);
    return pendingFromMemory(memoryRecord);
  }

  if (!data) {
    memoryPending.set(id, memoryRecord);
    return pendingFromMemory(memoryRecord);
  }

  return rowToPending(data);
}

function rowToPending(row: Record<string, unknown>): Ga4OAuthPending {
  return {
    id: row.id as string,
    store_id: row.store_id as string,
    google_user_id: row.google_user_id as string,
    google_user_email: (row.google_user_email as string) ?? null,
    scopes: (row.scopes as string[]) ?? [],
    expires_at: row.expires_at as string,
    token_expires_at: (row.token_expires_at as string) ?? null,
  };
}

export async function getGa4OAuthPending(sessionId: string): Promise<
  (Ga4OAuthPending & { accessToken: string; refreshToken: string }) | null
> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data } = await supabase
      .from("ga4_oauth_pending")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();
    if (data) {
      if (new Date(data.expires_at as string) < new Date()) return null;
      return {
        ...rowToPending(data),
        accessToken: decryptGoogleToken(data.access_token_encrypted as string),
        refreshToken: decryptGoogleToken(data.refresh_token_encrypted as string),
      };
    }
  }

  const row = memoryPending.get(sessionId);
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    memoryPending.delete(sessionId);
    return null;
  }
  return {
    ...row,
    accessToken: decryptGoogleToken(row.access_token_encrypted),
    refreshToken: decryptGoogleToken(row.refresh_token_encrypted),
  };
}

export async function upsertGa4Installation(input: {
  storeId: string;
  googleUserId: string;
  googleUserEmail?: string;
  accountId: string;
  accountName?: string;
  propertyId: string;
  propertyName?: string;
  dataStreamId?: string;
  dataStreamName?: string;
  measurementId?: string;
  accessToken: string;
  refreshToken: string;
  scopes: string[];
  tokenExpiresAt?: string;
}): Promise<Ga4Installation> {
  const accessEnc = encryptGoogleToken(input.accessToken);
  const refreshEnc = encryptGoogleToken(input.refreshToken);

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("ga4_installations")
      .upsert(
        {
          store_id: input.storeId,
          google_user_id: input.googleUserId,
          google_user_email: input.googleUserEmail,
          account_id: input.accountId,
          account_name: input.accountName,
          property_id: input.propertyId,
          property_name: input.propertyName,
          data_stream_id: input.dataStreamId,
          data_stream_name: input.dataStreamName,
          measurement_id: input.measurementId,
          access_token_encrypted: accessEnc,
          refresh_token_encrypted: refreshEnc,
          token_expires_at: input.tokenExpiresAt,
          scopes: input.scopes,
          status: "active",
          connection_health: "healthy",
        },
        { onConflict: "store_id,property_id" },
      )
      .select()
      .single();
    if (error) {
      const msg = supabaseErrorMessage(error);
      if (isGa4SchemaMissing(error) || error.code === "23503") {
        console.warn(
          "[ga4] ga4_installations persist failed — run migration 20260711120000_ga4_oauth.sql or connect Shopify first. Using in-memory install.",
          msg,
        );
      } else {
        throw new Error(msg);
      }
    } else if (data) {
      return rowToInstall(data);
    }
  }

  const id = crypto.randomUUID();
  const install: MemoryInstall = {
    id,
    store_id: input.storeId,
    google_user_id: input.googleUserId,
    google_user_email: input.googleUserEmail ?? null,
    account_id: input.accountId,
    account_name: input.accountName ?? null,
    property_id: input.propertyId,
    property_name: input.propertyName ?? null,
    data_stream_id: input.dataStreamId ?? null,
    data_stream_name: input.dataStreamName ?? null,
    measurement_id: input.measurementId ?? null,
    scopes: input.scopes,
    status: "active",
    connection_health: "healthy",
    error_message: null,
    installed_at: new Date().toISOString(),
    disconnected_at: null,
    last_sync_at: null,
    token_expires_at: input.tokenExpiresAt ?? null,
    access_token_encrypted: accessEnc,
    refresh_token_encrypted: refreshEnc,
  };
  memoryInstalls.set(`${input.storeId}:${input.propertyId}`, install);
  return install;
}

export async function hasActiveGa4Installation(storeId: string): Promise<boolean> {
  const list = await listGa4Installations(storeId);
  return list.some((i) => i.status === "active");
}

export async function listGa4Installations(storeId: string): Promise<Ga4Installation[]> {
  const memory = [...memoryInstalls.values()]
    .filter((i) => i.store_id === storeId && i.status === "active")
    .map(memoryToInstall);

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("ga4_installations")
      .select("*")
      .eq("store_id", storeId)
      .eq("status", "active");
    if (!error && data?.length) {
      return data.map((r) => rowToInstall(r));
    }
  }
  return memory;
}

export async function getGa4AccessToken(install: Ga4Installation & {
  access_token_encrypted?: string;
  refresh_token_encrypted?: string;
}): Promise<string> {
  let accessEnc = install.access_token_encrypted;
  let refreshEnc = install.refresh_token_encrypted;

  if (!accessEnc || !refreshEnc) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data } = await supabase
        .from("ga4_installations")
        .select("access_token_encrypted, refresh_token_encrypted, token_expires_at")
        .eq("id", install.id)
        .single();
      accessEnc = data?.access_token_encrypted as string;
      refreshEnc = data?.refresh_token_encrypted as string;
    } else {
      const mem = [...memoryInstalls.values()].find((m) => m.id === install.id);
      accessEnc = mem?.access_token_encrypted;
      refreshEnc = mem?.refresh_token_encrypted;
    }
  }

  if (!accessEnc || !refreshEnc) throw new Error("GA4 tokens not found");

  const expires = install.token_expires_at ? new Date(install.token_expires_at).getTime() : 0;
  if (expires > Date.now() + 60_000) {
    return decryptGoogleToken(accessEnc);
  }

  const refreshed = await refreshGa4AccessToken(decryptGoogleToken(refreshEnc));
  const newAccessEnc = encryptGoogleToken(refreshed.access_token);
  const tokenExpiresAt = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : undefined;

  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase
      .from("ga4_installations")
      .update({ access_token_encrypted: newAccessEnc, token_expires_at: tokenExpiresAt })
      .eq("id", install.id);
  } else {
    const mem = [...memoryInstalls.values()].find((m) => m.id === install.id);
    if (mem) {
      mem.access_token_encrypted = newAccessEnc;
      mem.token_expires_at = tokenExpiresAt ?? null;
    }
  }

  return refreshed.access_token;
}

export async function saveGa4SyncCache(storeId: string, snapshot: GA4Snapshot): Promise<void> {
  const syncedAt = new Date().toISOString();
  memoryCache.set(storeId, { snapshot, synced_at: syncedAt });

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { error } = await supabase.from("ga4_sync_cache").upsert({
    store_id: storeId,
    snapshot,
    synced_at: syncedAt,
    sync_window_days: snapshot.syncWindowDays ?? 30,
  });
  if (error && isGa4SchemaMissing(error)) {
    console.warn("[ga4] ga4_sync_cache missing — using in-memory cache only.");
  }
}

export async function getGa4SyncCache(storeId: string): Promise<GA4Snapshot | null> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data } = await supabase
      .from("ga4_sync_cache")
      .select("snapshot")
      .eq("store_id", storeId)
      .maybeSingle();
    if (data?.snapshot) return data.snapshot as GA4Snapshot;
  }
  return memoryCache.get(storeId)?.snapshot ?? null;
}

export async function deleteGa4OAuthPending(sessionId: string): Promise<void> {
  memoryPending.delete(sessionId);
  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase.from("ga4_oauth_pending").delete().eq("id", sessionId);
  }
}

export async function disconnectGa4Installation(
  storeId: string,
  installationId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase
      .from("ga4_installations")
      .update({
        status: "disconnected",
        connection_health: "disconnected",
        disconnected_at: now,
      })
      .eq("id", installationId)
      .eq("store_id", storeId);
    return;
  }

  for (const [key, install] of memoryInstalls.entries()) {
    if (install.id === installationId && install.store_id === storeId) {
      memoryInstalls.set(key, {
        ...install,
        status: "disconnected",
        connection_health: "disconnected",
        disconnected_at: now,
      });
    }
  }
}

export async function listStoresWithActiveGa4(): Promise<
  { storeId: string; installationId: string }[]
> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data } = await supabase
      .from("ga4_installations")
      .select("store_id, id")
      .eq("status", "active");
    return (data ?? []).map((r) => ({
      storeId: r.store_id as string,
      installationId: r.id as string,
    }));
  }
  return [...memoryInstalls.values()]
    .filter((i) => i.status === "active")
    .map((i) => ({ storeId: i.store_id, installationId: i.id }));
}

export async function markGa4InstallationSyncHealthy(
  installationId: string,
  stats: { sessions30d: number; funnelVerified: boolean },
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const patch = {
    connection_health: "healthy",
    error_message: null,
    sync_stats: stats,
  };
  if (supabase) {
    await supabase.from("ga4_installations").update(patch).eq("id", installationId);
    return;
  }
  for (const install of memoryInstalls.values()) {
    if (install.id === installationId) {
      install.connection_health = "healthy";
      install.error_message = null;
    }
  }
}

export async function markGa4InstallationSyncError(
  installationId: string,
  message: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const patch = {
    connection_health: "error",
    error_message: message.slice(0, 500),
  };
  if (supabase) {
    await supabase.from("ga4_installations").update(patch).eq("id", installationId);
    return;
  }
  for (const install of memoryInstalls.values()) {
    if (install.id === installationId) {
      install.connection_health = "error";
      install.error_message = message.slice(0, 500);
    }
  }
}

export async function touchGa4Sync(installId: string): Promise<void> {
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase.from("ga4_installations").update({ last_sync_at: now }).eq("id", installId);
  }
}
