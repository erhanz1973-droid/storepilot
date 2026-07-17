import { decryptMetaToken, encryptMetaToken } from "@/lib/meta/crypto";
import type { MetaCampaignSyncStats } from "@/lib/meta/campaign-stats";
import { emptyCampaignSyncStats } from "@/lib/meta/campaign-stats";
import { getSupabaseAdmin } from "@/lib/supabase/client";

export type MetaAdsInstallStatus = "active" | "disconnected" | "error";

export type MetaAdsInstallation = {
  id: string;
  store_id: string;
  meta_user_id: string;
  meta_user_name: string | null;
  business_id: string;
  business_name: string | null;
  ad_account_id: string;
  ad_account_name: string | null;
  scopes: string[];
  status: MetaAdsInstallStatus;
  connection_health: "healthy" | "degraded" | "error" | "disconnected";
  error_message: string | null;
  installed_at: string;
  disconnected_at: string | null;
  last_sync_at: string | null;
  token_expires_at: string | null;
  sync_stats: MetaCampaignSyncStats;
};

export type MetaOAuthPending = {
  id: string;
  store_id: string;
  meta_user_id: string;
  meta_user_name: string | null;
  scopes: string[];
  expires_at: string;
  token_expires_at: string | null;
};

type MemoryInstallation = MetaAdsInstallation & { access_token_encrypted: string };
type MemoryPending = MetaOAuthPending & { access_token_encrypted: string };

const memoryInstallations = new Map<string, MemoryInstallation>();
const memoryPending = new Map<string, MemoryPending>();

function rowToInstallation(row: Record<string, unknown>): MetaAdsInstallation {
  return {
    id: row.id as string,
    store_id: row.store_id as string,
    meta_user_id: row.meta_user_id as string,
    meta_user_name: (row.meta_user_name as string) ?? null,
    business_id: row.business_id as string,
    business_name: (row.business_name as string) ?? null,
    ad_account_id: row.ad_account_id as string,
    ad_account_name: (row.ad_account_name as string) ?? null,
    scopes: (row.scopes as string[]) ?? [],
    status: row.status as MetaAdsInstallStatus,
    connection_health: row.connection_health as MetaAdsInstallation["connection_health"],
    error_message: (row.error_message as string) ?? null,
    installed_at: row.installed_at as string,
    disconnected_at: (row.disconnected_at as string) ?? null,
    last_sync_at: (row.last_sync_at as string) ?? null,
    token_expires_at: (row.token_expires_at as string) ?? null,
    sync_stats: (row.sync_stats as MetaCampaignSyncStats) ?? emptyCampaignSyncStats(),
  };
}

export async function createMetaOAuthPending(input: {
  storeId: string;
  metaUserId: string;
  metaUserName?: string;
  accessToken: string;
  scopes: string[];
  tokenExpiresAt?: string;
}): Promise<MetaOAuthPending> {
  const encrypted = encryptMetaToken(input.accessToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const id = crypto.randomUUID();
    const record: MemoryPending = {
      id,
      store_id: input.storeId,
      meta_user_id: input.metaUserId,
      meta_user_name: input.metaUserName ?? null,
      access_token_encrypted: encrypted,
      scopes: input.scopes,
      expires_at: expiresAt,
      token_expires_at: input.tokenExpiresAt ?? null,
    };
    memoryPending.set(id, record);
    const { access_token_encrypted: _, ...pending } = record;
    return pending;
  }

  const { data, error } = await supabase
    .from("meta_oauth_pending")
    .insert({
      store_id: input.storeId,
      meta_user_id: input.metaUserId,
      meta_user_name: input.metaUserName ?? null,
      access_token_encrypted: encrypted,
      token_expires_at: input.tokenExpiresAt ?? null,
      scopes: input.scopes,
      expires_at: expiresAt,
    } as Record<string, unknown>)
    .select("id, store_id, meta_user_id, meta_user_name, scopes, expires_at, token_expires_at")
    .single();

  if (error) throw new Error(error.message);
  return data as MetaOAuthPending;
}

export async function getMetaOAuthPending(
  sessionId: string,
): Promise<(MetaOAuthPending & { accessToken: string }) | null> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const row = memoryPending.get(sessionId);
    if (!row) return null;
    if (new Date(row.expires_at) < new Date()) {
      memoryPending.delete(sessionId);
      return null;
    }
    const { access_token_encrypted, ...pending } = row;
    return { ...pending, accessToken: decryptMetaToken(access_token_encrypted) };
  }

  const { data, error } = await supabase
    .from("meta_oauth_pending")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  if (new Date(row.expires_at as string) < new Date()) {
    await supabase.from("meta_oauth_pending").delete().eq("id", sessionId);
    return null;
  }

  return {
    id: row.id as string,
    store_id: row.store_id as string,
    meta_user_id: row.meta_user_id as string,
    meta_user_name: (row.meta_user_name as string) ?? null,
    scopes: (row.scopes as string[]) ?? [],
    expires_at: row.expires_at as string,
    token_expires_at: (row.token_expires_at as string) ?? null,
    accessToken: decryptMetaToken(row.access_token_encrypted as string),
  };
}

export async function deleteMetaOAuthPending(sessionId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    memoryPending.delete(sessionId);
    return;
  }
  await supabase.from("meta_oauth_pending").delete().eq("id", sessionId);
}

export async function listMetaAdsInstallationsForStore(
  storeId: string,
): Promise<MetaAdsInstallation[]> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return [...memoryInstallations.values()]
      .filter((i) => i.store_id === storeId && i.status === "active")
      .map((i) => rowToInstallation(i as unknown as Record<string, unknown>));
  }

  const { data, error } = await supabase
    .from("meta_ads_installations")
    .select("*")
    .eq("store_id", storeId)
    .eq("status", "active")
    .order("installed_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToInstallation(r as Record<string, unknown>));
}

export async function listMetaAdsInstallationsWithTokens(
  storeId: string,
): Promise<(MetaAdsInstallation & { accessToken: string })[]> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return [...memoryInstallations.values()]
      .filter((i) => i.store_id === storeId && i.status === "active")
      .map((i) => {
        const { access_token_encrypted, ...installation } = i;
        return {
          ...installation,
          accessToken: decryptMetaToken(access_token_encrypted),
        };
      });
  }

  const { data, error } = await supabase
    .from("meta_ads_installations")
    .select("*")
    .eq("store_id", storeId)
    .eq("status", "active");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      ...rowToInstallation(r),
      accessToken: decryptMetaToken(r.access_token_encrypted as string),
    };
  });
}

export async function upsertMetaAdsInstallations(input: {
  storeId: string;
  metaUserId: string;
  metaUserName?: string;
  businessId: string;
  businessName?: string;
  accessToken: string;
  scopes: string[];
  tokenExpiresAt?: string;
  adAccounts: { id: string; name: string }[];
}): Promise<MetaAdsInstallation[]> {
  const encrypted = encryptMetaToken(input.accessToken);
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  const results: MetaAdsInstallation[] = [];

  for (const account of input.adAccounts) {
    const adAccountId = account.id.startsWith("act_") ? account.id : `act_${account.id}`;

    if (!supabase) {
      const existing = [...memoryInstallations.values()].find(
        (i) => i.store_id === input.storeId && i.ad_account_id === adAccountId,
      );
      const id = existing?.id ?? crypto.randomUUID();
      const record: MemoryInstallation = {
        id,
        store_id: input.storeId,
        meta_user_id: input.metaUserId,
        meta_user_name: input.metaUserName ?? null,
        business_id: input.businessId,
        business_name: input.businessName ?? null,
        ad_account_id: adAccountId,
        ad_account_name: account.name,
        access_token_encrypted: encrypted,
        scopes: input.scopes,
        status: "active",
        connection_health: "healthy",
        error_message: null,
        installed_at: existing?.installed_at ?? now,
        disconnected_at: null,
        last_sync_at: null,
        token_expires_at: input.tokenExpiresAt ?? null,
        sync_stats: existing?.sync_stats ?? emptyCampaignSyncStats(),
      };
      memoryInstallations.set(id, record);
      results.push(rowToInstallation(record as unknown as Record<string, unknown>));
      continue;
    }

    const { data, error } = await supabase
      .from("meta_ads_installations")
      .upsert(
        {
          store_id: input.storeId,
          meta_user_id: input.metaUserId,
          meta_user_name: input.metaUserName ?? null,
          business_id: input.businessId,
          business_name: input.businessName ?? null,
          ad_account_id: adAccountId,
          ad_account_name: account.name,
          access_token_encrypted: encrypted,
          token_expires_at: input.tokenExpiresAt ?? null,
          scopes: input.scopes,
          status: "active",
          connection_health: "healthy",
          error_message: null,
          disconnected_at: null,
          installed_at: now,
        } as Record<string, unknown>,
        { onConflict: "store_id,ad_account_id" },
      )
      .select()
      .single();

    if (error) throw new Error(error.message);
    results.push(rowToInstallation(data as Record<string, unknown>));
  }

  return results;
}

/** Keep one active Meta ad account per store — disconnect all others. */
export async function disconnectOtherMetaInstallations(
  storeId: string,
  keepAdAccountId: string,
): Promise<void> {
  const normalizedKeep = keepAdAccountId.startsWith("act_")
    ? keepAdAccountId
    : `act_${keepAdAccountId}`;
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    for (const [id, row] of memoryInstallations) {
      if (row.store_id !== storeId || row.status !== "active") continue;
      if (row.ad_account_id === normalizedKeep) continue;
      memoryInstallations.set(id, {
        ...row,
        status: "disconnected",
        connection_health: "disconnected",
        disconnected_at: now,
        access_token_encrypted: "",
      });
    }
    return;
  }

  const { data } = await supabase
    .from("meta_ads_installations")
    .select("id, ad_account_id")
    .eq("store_id", storeId)
    .eq("status", "active");

  for (const row of data ?? []) {
    const r = row as { id: string; ad_account_id: string };
    if (r.ad_account_id === normalizedKeep) continue;
    await disconnectMetaAdsInstallation(storeId, r.id);
  }
}

export async function getSelectedMetaAdsInstallation(
  storeId: string,
): Promise<MetaAdsInstallation | null> {
  const installations = await listMetaAdsInstallationsForStore(storeId);
  if (installations.length === 0) return null;
  return installations.sort(
    (a, b) => new Date(b.installed_at).getTime() - new Date(a.installed_at).getTime(),
  )[0];
}

export async function getSelectedMetaAdsInstallationWithToken(
  storeId: string,
): Promise<(MetaAdsInstallation & { accessToken: string }) | null> {
  const selected = await getSelectedMetaAdsInstallation(storeId);
  if (!selected) return null;

  const withTokens = await listMetaAdsInstallationsWithTokens(storeId);
  return withTokens.find((i) => i.id === selected.id) ?? null;
}

export async function disconnectMetaAdsInstallation(
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
      });
    }
    return;
  }

  await supabase
    .from("meta_ads_installations")
    .update({
      status: "disconnected",
      connection_health: "disconnected",
      disconnected_at: now,
      access_token_encrypted: "",
    } as Record<string, unknown>)
    .eq("id", installationId)
    .eq("store_id", storeId);
}

export async function updateMetaAdsSyncResult(
  installationId: string,
  stats: MetaCampaignSyncStats,
  meta?: {
    error?: string;
    connectionHealth?: MetaAdsInstallation["connection_health"];
  },
): Promise<void> {
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  const health: MetaAdsInstallation["connection_health"] = meta?.error
    ? (meta.connectionHealth ?? "error")
    : "healthy";

  if (!supabase) {
    const row = memoryInstallations.get(installationId);
    if (row) {
      memoryInstallations.set(installationId, {
        ...row,
        last_sync_at: now,
        sync_stats: stats,
        connection_health: health,
        error_message: meta?.error ?? null,
      });
    }
    return;
  }

  await supabase
    .from("meta_ads_installations")
    .update({
      last_sync_at: now,
      sync_stats: stats,
      connection_health: health,
      error_message: meta?.error ?? null,
    } as Record<string, unknown>)
    .eq("id", installationId);
}

/** Persist a rotated long-lived Meta access token after successful fb_exchange_token. */
export async function rotateMetaAccessToken(
  installationId: string,
  accessToken: string,
  tokenExpiresAt: string | null,
): Promise<void> {
  const encrypted = encryptMetaToken(accessToken);
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const row = memoryInstallations.get(installationId);
    if (row) {
      memoryInstallations.set(installationId, {
        ...row,
        access_token_encrypted: encrypted,
        token_expires_at: tokenExpiresAt,
        connection_health: "healthy",
        error_message: null,
      });
    }
    return;
  }

  const { error } = await supabase
    .from("meta_ads_installations")
    .update({
      access_token_encrypted: encrypted,
      token_expires_at: tokenExpiresAt,
      connection_health: "healthy",
      error_message: null,
    } as Record<string, unknown>)
    .eq("id", installationId);

  if (error) throw new Error(`Meta token rotation failed: ${error.message}`);
}

/** Mark installation as needing merchant reconnect (expired/revoked token). */
export async function markMetaAdsReconnectRequired(
  installationId: string,
  errorMessage: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const row = memoryInstallations.get(installationId);
    if (row) {
      memoryInstallations.set(installationId, {
        ...row,
        connection_health: "error",
        error_message: errorMessage,
        status: "error",
      });
    }
    return;
  }

  await supabase
    .from("meta_ads_installations")
    .update({
      connection_health: "error",
      error_message: errorMessage,
      status: "error",
    } as Record<string, unknown>)
    .eq("id", installationId);
}

export async function hasActiveMetaAdsInstallations(storeId: string): Promise<boolean> {
  const installations = await listMetaAdsInstallationsForStore(storeId);
  return installations.length > 0;
}

/** Distinct store IDs with at least one active Meta Ads installation (for cron). */
export async function listStoresWithActiveMetaAds(): Promise<{ storeId: string }[]> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data } = await supabase
      .from("meta_ads_installations")
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
