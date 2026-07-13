import { Session, type SessionParams } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import { getInstallationByShopDomain } from "@/lib/db/shopify";
import { persistInstallationFromSession } from "@/lib/shopify/persist-installation.server";
import { getSupabaseAdmin } from "@/lib/supabase/client";

type AuthSessionRow = {
  id: string;
  shop: string;
  session_json: Record<string, unknown>;
  is_online: boolean;
  expires_at: string | null;
};

const memoryAuthSessions = new Map<string, AuthSessionRow>();

function offlineSessionId(shop: string): string {
  return `offline_${shop}`;
}

function isOfflineSessionId(id: string): boolean {
  return id.startsWith("offline_");
}

function shopFromOfflineSessionId(id: string): string {
  return id.slice("offline_".length);
}

function sessionToJson(session: Session): Record<string, unknown> {
  return session.toObject() as Record<string, unknown>;
}

function sessionFromJson(value: Record<string, unknown>): Session {
  return new Session(value as SessionParams);
}

async function persistOfflineInstallation(session: Session): Promise<void> {
  await persistInstallationFromSession(session, "SupabaseSessionStorage.storeSession");
}

async function offlineSessionFromInstallation(id: string): Promise<Session | undefined> {
  const shop = shopFromOfflineSessionId(id);
  const installation = await getInstallationByShopDomain(shop);
  if (!installation) return undefined;

  return new Session({
    id,
    shop,
    state: "",
    isOnline: false,
    scope: installation.scopes.join(","),
    accessToken: installation.accessToken,
    refreshToken: installation.refreshToken ?? undefined,
    refreshTokenExpires: installation.refreshTokenExpires ?? undefined,
  });
}

export class SupabaseSessionStorage implements SessionStorage {
  async storeSession(session: Session): Promise<boolean> {
    console.log(
      "[shopify-persist]",
      JSON.stringify({
        phase: "storeSession",
        sessionId: session.id,
        shop: session.shop,
        isOnline: session.isOnline,
        hasAccessToken: Boolean(session.accessToken),
      }),
    );

    if (!session.isOnline && session.accessToken) {
      await persistOfflineInstallation(session);
      return true;
    }

    const row: AuthSessionRow = {
      id: session.id,
      shop: session.shop,
      session_json: sessionToJson(session),
      is_online: session.isOnline,
      expires_at: session.expires ? session.expires.toISOString() : null,
    };

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      memoryAuthSessions.set(session.id, row);
      return true;
    }

    const { error } = await supabase.from("shopify_auth_sessions").upsert(
      {
        id: row.id,
        shop: row.shop,
        session_json: row.session_json,
        is_online: row.is_online,
        expires_at: row.expires_at,
      } as Record<string, unknown>,
      { onConflict: "id" },
    );

    if (error) throw new Error(`shopify_auth_sessions upsert failed: ${error.message}`);
    return true;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    if (isOfflineSessionId(id)) {
      return offlineSessionFromInstallation(id);
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      const row = memoryAuthSessions.get(id);
      return row ? sessionFromJson(row.session_json) : undefined;
    }

    const { data, error } = await supabase
      .from("shopify_auth_sessions")
      .select("session_json")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`shopify_auth_sessions load failed: ${error.message}`);
    if (!data) return undefined;

    return sessionFromJson((data as { session_json: Record<string, unknown> }).session_json);
  }

  async deleteSession(id: string): Promise<boolean> {
    if (isOfflineSessionId(id)) {
      return true;
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return memoryAuthSessions.delete(id);
    }

    const { error } = await supabase.from("shopify_auth_sessions").delete().eq("id", id);
    if (error) throw new Error(`shopify_auth_sessions delete failed: ${error.message}`);
    return true;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    await Promise.all(ids.map((id) => this.deleteSession(id)));
    return true;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const sessions: Session[] = [];
    const offline = await offlineSessionFromInstallation(offlineSessionId(shop));
    if (offline) sessions.push(offline);

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      for (const row of memoryAuthSessions.values()) {
        if (row.shop === shop) {
          sessions.push(sessionFromJson(row.session_json));
        }
      }
      return sessions;
    }

    const { data, error } = await supabase
      .from("shopify_auth_sessions")
      .select("session_json")
      .eq("shop", shop);

    if (error) throw new Error(`shopify_auth_sessions find failed: ${error.message}`);

    for (const row of data ?? []) {
      sessions.push(
        sessionFromJson((row as { session_json: Record<string, unknown> }).session_json),
      );
    }

    return sessions;
  }
}

export async function deleteAuthSessionsForShop(shop: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    for (const [id, row] of memoryAuthSessions) {
      if (row.shop === shop) memoryAuthSessions.delete(id);
    }
    return;
  }

  const { error } = await supabase.from("shopify_auth_sessions").delete().eq("shop", shop);
  if (error) throw new Error(`shopify_auth_sessions shop delete failed: ${error.message}`);
}

/** @internal test helper */
export function __clearMemoryAuthSessionsForTests(): void {
  memoryAuthSessions.clear();
}
