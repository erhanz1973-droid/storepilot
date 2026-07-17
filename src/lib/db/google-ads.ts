import { decryptGoogleToken, encryptGoogleToken } from "@/lib/google-ads/crypto";
import {
  emptyGoogleCampaignSyncStats,
  type GoogleCampaignSyncStats,
} from "@/lib/google-ads/campaign-stats";
import { refreshGoogleAccessToken } from "@/lib/google-ads/oauth";
import { getSupabaseAdmin } from "@/lib/supabase/client";

export type GoogleAdsInstallStatus = "active" | "disconnected" | "error";

export type GoogleAdsInstallation = {
  id: string;
  store_id: string;
  google_user_id: string;
  google_user_email: string | null;
  customer_id: string;
  customer_name: string | null;
  scopes: string[];
  status: GoogleAdsInstallStatus;
  connection_health: "healthy" | "degraded" | "error" | "disconnected";
  error_message: string | null;
  installed_at: string;
  disconnected_at: string | null;
  last_sync_at: string | null;
  token_expires_at: string | null;
  sync_stats: GoogleCampaignSyncStats;
};

export type GoogleOAuthPending = {
  id: string;
  store_id: string;
  google_user_id: string;
  google_user_email: string | null;
  scopes: string[];
  expires_at: string;
  token_expires_at: string | null;
};

type MemoryInstallation = GoogleAdsInstallation & {
  access_token_encrypted: string;
  refresh_token_encrypted: string;
};
type MemoryPending = GoogleOAuthPending & {
  access_token_encrypted: string;
  refresh_token_encrypted: string;
};

const memoryInstallations = new Map<string, MemoryInstallation>();
const memoryPending = new Map<string, MemoryPending>();

function rowToInstallation(row: Record<string, unknown>): GoogleAdsInstallation {
  return {
    id: row.id as string,
    store_id: row.store_id as string,
    google_user_id: row.google_user_id as string,
    google_user_email: (row.google_user_email as string) ?? null,
    customer_id: row.customer_id as string,
    customer_name: (row.customer_name as string) ?? null,
    scopes: (row.scopes as string[]) ?? [],
    status: row.status as GoogleAdsInstallStatus,
    connection_health: row.connection_health as GoogleAdsInstallation["connection_health"],
    error_message: (row.error_message as string) ?? null,
    installed_at: row.installed_at as string,
    disconnected_at: (row.disconnected_at as string) ?? null,
    last_sync_at: (row.last_sync_at as string) ?? null,
    token_expires_at: (row.token_expires_at as string) ?? null,
    sync_stats: (row.sync_stats as GoogleCampaignSyncStats) ?? emptyGoogleCampaignSyncStats(),
  };
}

export async function createGoogleOAuthPending(input: {
  storeId: string;
  googleUserId: string;
  googleUserEmail?: string;
  accessToken: string;
  refreshToken: string;
  scopes: string[];
  tokenExpiresAt?: string;
}): Promise<GoogleOAuthPending> {
  const accessEncrypted = encryptGoogleToken(input.accessToken);
  const refreshEncrypted = encryptGoogleToken(input.refreshToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const id = crypto.randomUUID();
    const record: MemoryPending = {
      id,
      store_id: input.storeId,
      google_user_id: input.googleUserId,
      google_user_email: input.googleUserEmail ?? null,
      access_token_encrypted: accessEncrypted,
      refresh_token_encrypted: refreshEncrypted,
      scopes: input.scopes,
      expires_at: expiresAt,
      token_expires_at: input.tokenExpiresAt ?? null,
    };
    memoryPending.set(id, record);
    const { access_token_encrypted: _a, refresh_token_encrypted: _r, ...pending } = record;
    return pending;
  }

  const { data, error } = await supabase
    .from("google_oauth_pending")
    .insert({
      store_id: input.storeId,
      google_user_id: input.googleUserId,
      google_user_email: input.googleUserEmail ?? null,
      access_token_encrypted: accessEncrypted,
      refresh_token_encrypted: refreshEncrypted,
      token_expires_at: input.tokenExpiresAt ?? null,
      scopes: input.scopes,
      expires_at: expiresAt,
    } as Record<string, unknown>)
    .select("id, store_id, google_user_id, google_user_email, scopes, expires_at, token_expires_at")
    .single();

  if (error) throw new Error(error.message);
  return data as GoogleOAuthPending;
}

export async function getGoogleOAuthPending(
  sessionId: string,
): Promise<
  (GoogleOAuthPending & { accessToken: string; refreshToken: string }) | null
> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
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

  const { data, error } = await supabase
    .from("google_oauth_pending")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  if (new Date(row.expires_at as string) < new Date()) {
    await supabase.from("google_oauth_pending").delete().eq("id", sessionId);
    return null;
  }

  return {
    id: row.id as string,
    store_id: row.store_id as string,
    google_user_id: row.google_user_id as string,
    google_user_email: (row.google_user_email as string) ?? null,
    scopes: (row.scopes as string[]) ?? [],
    expires_at: row.expires_at as string,
    token_expires_at: (row.token_expires_at as string) ?? null,
    accessToken: decryptGoogleToken(row.access_token_encrypted as string),
    refreshToken: decryptGoogleToken(row.refresh_token_encrypted as string),
  };
}

export async function deleteGoogleOAuthPending(sessionId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    memoryPending.delete(sessionId);
    return;
  }
  await supabase.from("google_oauth_pending").delete().eq("id", sessionId);
}

export async function listGoogleAdsInstallationsForStore(
  storeId: string,
): Promise<GoogleAdsInstallation[]> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return [...memoryInstallations.values()]
      .filter((i) => i.store_id === storeId && i.status === "active")
      .map((i) => rowToInstallation(i as unknown as Record<string, unknown>));
  }

  const { data, error } = await supabase
    .from("google_ads_installations")
    .select("*")
    .eq("store_id", storeId)
    .eq("status", "active")
    .order("installed_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToInstallation(r as Record<string, unknown>));
}

export async function listGoogleAdsInstallationsWithTokens(
  storeId: string,
): Promise<(GoogleAdsInstallation & { accessToken: string; refreshToken: string })[]> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return [...memoryInstallations.values()]
      .filter((i) => i.store_id === storeId && i.status === "active")
      .map((i) => ({
        ...rowToInstallation(i as unknown as Record<string, unknown>),
        accessToken: decryptGoogleToken(i.access_token_encrypted),
        refreshToken: decryptGoogleToken(i.refresh_token_encrypted),
      }));
  }

  const { data, error } = await supabase
    .from("google_ads_installations")
    .select("*")
    .eq("store_id", storeId)
    .eq("status", "active");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      ...rowToInstallation(r),
      accessToken: decryptGoogleToken(r.access_token_encrypted as string),
      refreshToken: decryptGoogleToken(r.refresh_token_encrypted as string),
    };
  });
}

export async function upsertGoogleAdsInstallations(input: {
  storeId: string;
  googleUserId: string;
  googleUserEmail?: string;
  accessToken: string;
  refreshToken: string;
  scopes: string[];
  tokenExpiresAt?: string;
  customers: { id: string; name: string }[];
}): Promise<GoogleAdsInstallation[]> {
  const accessEncrypted = encryptGoogleToken(input.accessToken);
  const refreshEncrypted = encryptGoogleToken(input.refreshToken);
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  const results: GoogleAdsInstallation[] = [];

  for (const customer of input.customers) {
    const customerId = customer.id.replace(/-/g, "");

    if (!supabase) {
      const existing = [...memoryInstallations.values()].find(
        (i) => i.store_id === input.storeId && i.customer_id === customerId,
      );
      const id = existing?.id ?? crypto.randomUUID();
      const record: MemoryInstallation = {
        id,
        store_id: input.storeId,
        google_user_id: input.googleUserId,
        google_user_email: input.googleUserEmail ?? null,
        customer_id: customerId,
        customer_name: customer.name,
        access_token_encrypted: accessEncrypted,
        refresh_token_encrypted: refreshEncrypted,
        scopes: input.scopes,
        status: "active",
        connection_health: "healthy",
        error_message: null,
        installed_at: existing?.installed_at ?? now,
        disconnected_at: null,
        last_sync_at: null,
        token_expires_at: input.tokenExpiresAt ?? null,
        sync_stats: existing?.sync_stats ?? emptyGoogleCampaignSyncStats(),
      };
      memoryInstallations.set(id, record);
      results.push(rowToInstallation(record as unknown as Record<string, unknown>));
      continue;
    }

    const { data, error } = await supabase
      .from("google_ads_installations")
      .upsert(
        {
          store_id: input.storeId,
          google_user_id: input.googleUserId,
          google_user_email: input.googleUserEmail ?? null,
          customer_id: customerId,
          customer_name: customer.name,
          access_token_encrypted: accessEncrypted,
          refresh_token_encrypted: refreshEncrypted,
          token_expires_at: input.tokenExpiresAt ?? null,
          scopes: input.scopes,
          status: "active",
          connection_health: "healthy",
          error_message: null,
          disconnected_at: null,
          installed_at: now,
        } as Record<string, unknown>,
        { onConflict: "store_id,customer_id" },
      )
      .select()
      .single();

    if (error) throw new Error(error.message);
    results.push(rowToInstallation(data as Record<string, unknown>));
  }

  return results;
}

export async function updateGoogleAdsTokens(
  installationId: string,
  accessToken: string,
  tokenExpiresAt?: string,
  refreshToken?: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const accessEncrypted = encryptGoogleToken(accessToken);
  const patch: Record<string, unknown> = {
    access_token_encrypted: accessEncrypted,
    token_expires_at: tokenExpiresAt ?? null,
  };
  if (refreshToken) {
    patch.refresh_token_encrypted = encryptGoogleToken(refreshToken);
  }

  if (!supabase) {
    const row = memoryInstallations.get(installationId);
    if (row) {
      memoryInstallations.set(installationId, {
        ...row,
        access_token_encrypted: accessEncrypted,
        refresh_token_encrypted: refreshToken
          ? encryptGoogleToken(refreshToken)
          : row.refresh_token_encrypted,
        token_expires_at: tokenExpiresAt ?? null,
      });
    }
    return;
  }

  await supabase.from("google_ads_installations").update(patch).eq("id", installationId);
}

export async function ensureGoogleAccessToken(
  installation: GoogleAdsInstallation & { accessToken: string; refreshToken: string },
): Promise<string> {
  if (!installation.token_expires_at) return installation.accessToken;
  const expiresAt = new Date(installation.token_expires_at).getTime();
  if (expiresAt > Date.now() + 5 * 60 * 1000) return installation.accessToken;

  const refreshed = await refreshGoogleAccessToken(installation.refreshToken);
  const tokenExpiresAt = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : undefined;
  await updateGoogleAdsTokens(
    installation.id,
    refreshed.access_token,
    tokenExpiresAt,
    refreshed.refresh_token,
  );
  return refreshed.access_token;
}

export async function updateGoogleAdsSyncResult(
  installationId: string,
  stats: GoogleCampaignSyncStats,
  options?: {
    error?: string;
    connectionHealth?: GoogleAdsInstallation["connection_health"];
  },
): Promise<void> {
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  const failed = Boolean(options?.error?.trim());
  const patch = failed
    ? {
        sync_stats: stats,
        connection_health: options?.connectionHealth ?? ("degraded" as const),
        error_message: options!.error!.trim(),
      }
    : {
        last_sync_at: now,
        sync_stats: stats,
        connection_health: "healthy" as const,
        error_message: null,
      };

  if (!supabase) {
    const row = memoryInstallations.get(installationId);
    if (row) {
      memoryInstallations.set(installationId, {
        ...row,
        ...patch,
      });
    }
    return;
  }

  await supabase.from("google_ads_installations").update(patch).eq("id", installationId);
}

export async function disconnectGoogleAdsInstallation(
  storeId: string,
  installationId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const row = memoryInstallations.get(installationId);
    if (row && row.store_id === storeId) {
      memoryInstallations.set(installationId, {
        ...row,
        status: "disconnected",
        connection_health: "disconnected",
        disconnected_at: now,
        access_token_encrypted: "",
        refresh_token_encrypted: "",
      });
    }
    return;
  }

  await supabase
    .from("google_ads_installations")
    .update({
      status: "disconnected",
      connection_health: "disconnected",
      disconnected_at: now,
      access_token_encrypted: "",
      refresh_token_encrypted: "",
    } as Record<string, unknown>)
    .eq("id", installationId)
    .eq("store_id", storeId);
}

export async function hasActiveGoogleAdsInstallations(storeId: string): Promise<boolean> {
  const list = await listGoogleAdsInstallationsForStore(storeId);
  return list.length > 0;
}

/** Distinct store IDs with at least one active Google Ads installation (for cron). */
export async function listStoresWithActiveGoogleAds(): Promise<{ storeId: string }[]> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data } = await supabase
      .from("google_ads_installations")
      .select("store_id")
      .eq("status", "active");
    const seen = new Set<string>();
    for (const row of data ?? []) {
      seen.add(row.store_id as string);
    }
    return [...seen].map((storeId) => ({ storeId }));
  }
  const seen = new Set<string>();
  for (const row of memoryInstallations.values()) {
    if (row.status === "active") seen.add(row.store_id);
  }
  return [...seen].map((storeId) => ({ storeId }));
}
