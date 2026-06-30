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
