import { getSupabaseAdmin } from "@/lib/supabase/client";

export type AlphaFunnelEvent =
  | "installation_completed"
  | "shopify_connected"
  | "first_run_opened"
  | "first_recommendation_shown"
  | "see_why_clicked"
  | "recommendation_approved"
  | "recommendation_rejected"
  | "first_run_completed"
  | "ttv_recommendation_ms"
  | "ttv_approval_ms";

export type AlphaFunnelRow = {
  id: string;
  storeId: string;
  event: string;
  props: Record<string, unknown>;
  occurredAt: string;
};

const memoryEvents: AlphaFunnelRow[] = [];

export async function trackAlphaEvent(
  storeId: string,
  event: AlphaFunnelEvent | string,
  props: Record<string, unknown> = {},
): Promise<void> {
  if (!storeId) return;
  const row: AlphaFunnelRow = {
    id: crypto.randomUUID(),
    storeId,
    event,
    props,
    occurredAt: new Date().toISOString(),
  };

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("alpha_funnel_events").insert({
      id: row.id,
      store_id: row.storeId,
      event: row.event,
      props: row.props,
      occurred_at: row.occurredAt,
    });
    if (error) {
      console.warn("[alpha-funnel] persist failed:", error.message);
      memoryEvents.push(row);
      return;
    }
    return;
  }

  memoryEvents.push(row);
}

export async function hasAlphaEvent(
  storeId: string,
  event: AlphaFunnelEvent | string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("alpha_funnel_events")
      .select("id")
      .eq("store_id", storeId)
      .eq("event", event)
      .limit(1);
    if (!error && (data?.length ?? 0) > 0) return true;
  }
  return memoryEvents.some((e) => e.storeId === storeId && e.event === event);
}

export async function latestAlphaEventAt(
  storeId: string,
  event: AlphaFunnelEvent | string,
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("alpha_funnel_events")
      .select("occurred_at")
      .eq("store_id", storeId)
      .eq("event", event)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data?.occurred_at) return data.occurred_at as string;
  }
  const mem = memoryEvents
    .filter((e) => e.storeId === storeId && e.event === event)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  return mem?.occurredAt ?? null;
}

export async function listAlphaFunnelEvents(limit = 5000): Promise<AlphaFunnelRow[]> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("alpha_funnel_events")
      .select("id, store_id, event, props, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (!error && data) {
      return data.map((r) => ({
        id: r.id as string,
        storeId: r.store_id as string,
        event: r.event as string,
        props: (r.props as Record<string, unknown>) ?? {},
        occurredAt: r.occurred_at as string,
      }));
    }
    console.warn("[alpha-funnel] list failed:", error?.message);
  }
  return [...memoryEvents].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

/** Record TTV when first recommendation is shown (relative to shopify_connected). */
export async function trackTtvRecommendation(storeId: string): Promise<void> {
  const connectedAt = await latestAlphaEventAt(storeId, "shopify_connected");
  if (!connectedAt) return;
  const ms = Date.now() - new Date(connectedAt).getTime();
  if (ms < 0 || ms > 1000 * 60 * 60 * 24) return;
  await trackAlphaEvent(storeId, "ttv_recommendation_ms", { ms });
}

export async function trackTtvApproval(storeId: string): Promise<void> {
  const connectedAt = await latestAlphaEventAt(storeId, "shopify_connected");
  if (!connectedAt) return;
  const ms = Date.now() - new Date(connectedAt).getTime();
  if (ms < 0 || ms > 1000 * 60 * 60 * 24) return;
  await trackAlphaEvent(storeId, "ttv_approval_ms", { ms });
}
