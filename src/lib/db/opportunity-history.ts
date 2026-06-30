import type {
  OpportunityHistoryRecord,
  OpportunityHistoryStatus,
} from "@/lib/opportunities/history";
import { DEMO_STORE_ID } from "@/lib/types";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/client";

type DbRow = {
  id: string;
  store_id: string;
  opportunity_key: string;
  title: string;
  category: string;
  status: OpportunityHistoryStatus;
  estimated_monthly_revenue: number;
  estimated_monthly_profit: number;
  confidence_pct: number;
  ignore_count: number;
  detected_at: string;
  viewed_at: string | null;
  resolved_at: string | null;
  expired_at: string | null;
};

const memoryHistory = new Map<string, DbRow>();

function rowToRecord(row: DbRow): OpportunityHistoryRecord {
  return {
    id: row.id,
    storeId: row.store_id,
    opportunityKey: row.opportunity_key,
    title: row.title,
    category: row.category,
    status: row.status,
    estimatedMonthlyRevenue: Number(row.estimated_monthly_revenue),
    estimatedMonthlyProfit: Number(row.estimated_monthly_profit),
    confidencePct: row.confidence_pct,
    detectedAt: row.detected_at,
    viewedAt: row.viewed_at ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    expiredAt: row.expired_at ?? undefined,
    ignoreCount: row.ignore_count,
  };
}

export async function listOpportunityHistory(
  storeId = DEMO_STORE_ID,
): Promise<OpportunityHistoryRecord[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return [...memoryHistory.values()]
      .filter((r) => r.store_id === storeId)
      .map(rowToRecord)
      .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
  }

  const { data, error } = await supabase
    .from("opportunity_history")
    .select("*")
    .eq("store_id", storeId)
    .order("detected_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data as DbRow[]).map(rowToRecord);
}

export async function upsertOpportunityDetection(input: {
  storeId: string;
  opportunityKey: string;
  title: string;
  category: string;
  estimatedMonthlyRevenue: number;
  estimatedMonthlyProfit: number;
  confidencePct: number;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  if (!supabase) {
    const existing = [...memoryHistory.values()].find(
      (r) => r.store_id === input.storeId && r.opportunity_key === input.opportunityKey,
    );
    if (existing) {
      existing.title = input.title;
      existing.estimated_monthly_revenue = input.estimatedMonthlyRevenue;
      existing.estimated_monthly_profit = input.estimatedMonthlyProfit;
      existing.confidence_pct = input.confidencePct;
      memoryHistory.set(existing.id, existing);
      return;
    }
    const id = crypto.randomUUID();
    memoryHistory.set(id, {
      id,
      store_id: input.storeId,
      opportunity_key: input.opportunityKey,
      title: input.title,
      category: input.category,
      status: "detected",
      estimated_monthly_revenue: input.estimatedMonthlyRevenue,
      estimated_monthly_profit: input.estimatedMonthlyProfit,
      confidence_pct: input.confidencePct,
      ignore_count: 0,
      detected_at: now,
      viewed_at: null,
      resolved_at: null,
      expired_at: null,
    });
    return;
  }

  const { data: existing } = await supabase
    .from("opportunity_history")
    .select("status, detected_at, ignore_count")
    .eq("store_id", input.storeId)
    .eq("opportunity_key", input.opportunityKey)
    .maybeSingle();

  const existingRow = existing as {
    status?: OpportunityHistoryStatus;
    detected_at?: string;
    ignore_count?: number;
  } | null;

  await supabase.from("opportunity_history").upsert(
    {
      store_id: input.storeId,
      opportunity_key: input.opportunityKey,
      title: input.title,
      category: input.category,
      status: existingRow?.status ?? "detected",
      estimated_monthly_revenue: input.estimatedMonthlyRevenue,
      estimated_monthly_profit: input.estimatedMonthlyProfit,
      confidence_pct: input.confidencePct,
      detected_at: existingRow?.detected_at ?? now,
      ignore_count: existingRow?.ignore_count ?? 0,
      updated_at: now,
    },
    { onConflict: "store_id,opportunity_key", ignoreDuplicates: false },
  );
}

export async function updateOpportunityStatus(
  storeId: string,
  opportunityKey: string,
  status: OpportunityHistoryStatus,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status, updated_at: now };

  if (status === "viewed") patch.viewed_at = now;
  if (status === "resolved") patch.resolved_at = now;
  if (status === "expired") patch.expired_at = now;
  if (status === "ignored") {
    patch.last_ignored_at = now;
  }

  if (!supabase) {
    let row = [...memoryHistory.values()].find(
      (r) => r.store_id === storeId && r.opportunity_key === opportunityKey,
    );
    if (!row) return;
    row.status = status;
    if (status === "viewed") row.viewed_at = now;
    if (status === "resolved") row.resolved_at = now;
    if (status === "expired") row.expired_at = now;
    if (status === "ignored") row.ignore_count += 1;
    memoryHistory.set(row.id, row);
    return;
  }

  if (status === "ignored") {
    const { data } = await supabase
      .from("opportunity_history")
      .select("ignore_count")
      .eq("store_id", storeId)
      .eq("opportunity_key", opportunityKey)
      .single();
    patch.ignore_count = ((data as { ignore_count?: number })?.ignore_count ?? 0) + 1;
  }

  await supabase
    .from("opportunity_history")
    .update(patch)
    .eq("store_id", storeId)
    .eq("opportunity_key", opportunityKey);
}

/** Upsert then update — used when user acts on a decision that may not be in history yet. */
export async function recordDecisionAction(
  storeId: string,
  opportunityKey: string,
  status: OpportunityHistoryStatus,
  meta: {
    title: string;
    category?: string;
    estimatedMonthlyRevenue?: number;
    estimatedMonthlyProfit?: number;
    confidencePct?: number;
  },
): Promise<void> {
  await upsertOpportunityDetection({
    storeId,
    opportunityKey,
    title: meta.title,
    category: meta.category ?? "decision",
    estimatedMonthlyRevenue: meta.estimatedMonthlyRevenue ?? 0,
    estimatedMonthlyProfit: meta.estimatedMonthlyProfit ?? 0,
    confidencePct: meta.confidencePct ?? 0,
  });
  await updateOpportunityStatus(storeId, opportunityKey, status);
}

export async function expireStaleOpportunities(
  storeId: string,
  maxAgeDays = 14,
): Promise<number> {
  const records = await listOpportunityHistory(storeId);
  const now = new Date().toISOString();
  let expired = 0;

  for (const rec of records) {
    if (rec.status === "resolved" || rec.status === "expired") continue;
    const age = Date.now() - new Date(rec.detectedAt).getTime();
    if (age > maxAgeDays * 86400000) {
      await updateOpportunityStatus(storeId, rec.opportunityKey, "expired");
      expired += 1;
    }
  }

  return expired;
}

export function isOpportunityHistoryConfigured(): boolean {
  return isSupabaseConfigured();
}
