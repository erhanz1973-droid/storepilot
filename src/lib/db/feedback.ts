import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/client";
import { resolveActiveStoreId } from "@/lib/store/context";

export type RecommendationFeedback = {
  id: string;
  recommendationId: string;
  storeId: string;
  helpful: boolean;
  reason?: string;
  createdAt: string;
};

export type FeedbackSummary = {
  helpful: number;
  notHelpful: number;
  total: number;
  helpfulRatePct: number;
};

const memoryFeedback: RecommendationFeedback[] = [];

function isMissingTableError(message: string): boolean {
  return (
    message.includes("Could not find the table") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

const emptySummary = (): FeedbackSummary => ({
  helpful: 0,
  notHelpful: 0,
  total: 0,
  helpfulRatePct: 0,
});

export async function saveRecommendationFeedback(input: {
  recommendationId: string;
  helpful: boolean;
  reason?: string;
  storeId?: string;
}): Promise<RecommendationFeedback> {
  const storeId = input.storeId ?? (await resolveActiveStoreId());
  const row: RecommendationFeedback = {
    id: crypto.randomUUID(),
    recommendationId: input.recommendationId,
    storeId,
    helpful: input.helpful,
    reason: input.reason?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("recommendation_feedback").insert({
      id: row.id,
      recommendation_id: row.recommendationId,
      store_id: row.storeId,
      helpful: row.helpful,
      reason: row.reason ?? null,
      created_at: row.createdAt,
    });
    if (error) throw new Error(error.message);
    return row;
  }

  memoryFeedback.push(row);
  return row;
}

export async function getFeedbackSummary(storeId?: string): Promise<FeedbackSummary> {
  const activeStoreId = storeId ?? (await resolveActiveStoreId());
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { data, error } = await supabase
      .from("recommendation_feedback")
      .select("helpful")
      .eq("store_id", activeStoreId);
    if (error) {
      if (isMissingTableError(error.message)) return emptySummary();
      throw new Error(error.message);
    }
    const helpful = (data ?? []).filter((r) => r.helpful).length;
    const notHelpful = (data ?? []).length - helpful;
    const total = helpful + notHelpful;
    return {
      helpful,
      notHelpful,
      total,
      helpfulRatePct: total > 0 ? Math.round((helpful / total) * 1000) / 10 : 0,
    };
  }

  const rows = memoryFeedback.filter((f) => f.storeId === activeStoreId);
  const helpful = rows.filter((f) => f.helpful).length;
  const notHelpful = rows.length - helpful;
  const total = rows.length;
  return {
    helpful,
    notHelpful,
    total,
    helpfulRatePct: total > 0 ? Math.round((helpful / total) * 1000) / 10 : 0,
  };
}

export async function listRecentFeedback(limit = 20): Promise<RecommendationFeedback[]> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("recommendation_feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      if (isMissingTableError(error.message)) return [];
      throw new Error(error.message);
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      recommendationId: r.recommendation_id,
      storeId: r.store_id,
      helpful: r.helpful,
      reason: r.reason ?? undefined,
      createdAt: r.created_at,
    }));
  }
  return [...memoryFeedback].reverse().slice(0, limit);
}

export type FeedbackLearningRow = RecommendationFeedback & {
  category: string | null;
  entityId: string | null;
  title: string | null;
};

/**
 * Feedback joined with recommendation pattern fields for the learning engine.
 */
export async function listFeedbackForLearning(
  storeId: string,
  limit = 500,
): Promise<FeedbackLearningRow[]> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("recommendation_feedback")
      .select(
        "id, recommendation_id, store_id, helpful, reason, created_at, recommendations(category, entity_id, title)",
      )
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingTableError(error.message)) return [];
      // Join may fail on older schemas — fall back to feedback-only + memory lookup.
      const { data: plain, error: plainError } = await supabase
        .from("recommendation_feedback")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (plainError) {
        if (isMissingTableError(plainError.message)) return [];
        throw new Error(plainError.message);
      }
      const rows: FeedbackLearningRow[] = [];
      for (const r of plain ?? []) {
        const { getRecommendationById } = await import("@/lib/db/recommendations");
        const rec = await getRecommendationById(r.recommendation_id as string);
        rows.push({
          id: r.id as string,
          recommendationId: r.recommendation_id as string,
          storeId: r.store_id as string,
          helpful: Boolean(r.helpful),
          reason: (r.reason as string | null) ?? undefined,
          createdAt: r.created_at as string,
          category: rec?.category ?? null,
          entityId: rec?.entityId ?? null,
          title: rec?.title ?? null,
        });
      }
      return rows;
    }

    return (data ?? []).map((r) => {
      const rec = r.recommendations as
        | { category?: string; entity_id?: string | null; title?: string }
        | { category?: string; entity_id?: string | null; title?: string }[]
        | null;
      const joined = Array.isArray(rec) ? rec[0] : rec;
      return {
        id: r.id as string,
        recommendationId: r.recommendation_id as string,
        storeId: r.store_id as string,
        helpful: Boolean(r.helpful),
        reason: (r.reason as string | null) ?? undefined,
        createdAt: r.created_at as string,
        category: joined?.category ?? null,
        entityId: joined?.entity_id ?? null,
        title: joined?.title ?? null,
      };
    });
  }

  const rows: FeedbackLearningRow[] = [];
  for (const f of memoryFeedback.filter((x) => x.storeId === storeId).slice(-limit)) {
    const { getRecommendationById } = await import("@/lib/db/recommendations");
    const rec = await getRecommendationById(f.recommendationId);
    rows.push({
      ...f,
      category: rec?.category ?? null,
      entityId: rec?.entityId ?? null,
      title: rec?.title ?? null,
    });
  }
  return rows;
}
