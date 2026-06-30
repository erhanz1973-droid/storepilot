import type { DecisionRejectionReason } from "@/lib/decisions/engine/types";
import { getSupabaseAdmin } from "@/lib/supabase/client";

export type RejectionFeedbackInput = {
  storeId: string;
  reason: DecisionRejectionReason;
  note?: string;
  recommendationId?: string;
  decisionId?: string;
  opportunityKey?: string;
  userId?: string;
};

const memoryFeedback: {
  id: string;
  store_id: string;
  reason: DecisionRejectionReason;
  note: string | null;
  recommendation_id: string | null;
  decision_id: string | null;
  opportunity_key: string | null;
  created_at: string;
}[] = [];

function isMissingRejectionFeedbackTable(error: { message?: string; code?: string }): boolean {
  const msg = error.message ?? "";
  return (
    error.code === "PGRST205" ||
    (msg.includes("decision_rejection_feedback") &&
      (msg.includes("schema cache") || msg.includes("does not exist")))
  );
}

export function clearRejectionFeedbackMemory(): void {
  memoryFeedback.length = 0;
}

export async function recordDecisionRejectionFeedback(
  input: RejectionFeedbackInput,
): Promise<{ id: string }> {
  const supabase = getSupabaseAdmin();
  const row = {
    store_id: input.storeId,
    recommendation_id: input.recommendationId ?? null,
    decision_id: input.decisionId ?? null,
    opportunity_key: input.opportunityKey ?? null,
    reason: input.reason,
    note: input.note ?? null,
    user_id: input.userId ?? null,
  };

  if (!supabase) {
    const id = crypto.randomUUID();
    memoryFeedback.push({
      id,
      store_id: input.storeId,
      reason: input.reason,
      note: input.note ?? null,
      recommendation_id: input.recommendationId ?? null,
      decision_id: input.decisionId ?? null,
      opportunity_key: input.opportunityKey ?? null,
      created_at: new Date().toISOString(),
    });
    return { id };
  }

  const { data, error } = await supabase
    .from("decision_rejection_feedback")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    if (isMissingRejectionFeedbackTable(error)) {
      console.warn(
        "[decision-feedback] decision_rejection_feedback table missing — apply migration 20260702120000_decision_engine.sql",
      );
      return { id: crypto.randomUUID() };
    }
    throw new Error(`Failed to record rejection feedback: ${error.message}`);
  }
  return { id: (data as { id: string }).id };
}

export async function listRejectionFeedback(
  storeId: string,
  limit = 50,
): Promise<
  {
    id: string;
    reason: DecisionRejectionReason;
    note?: string;
    recommendationId?: string;
    decisionId?: string;
    createdAt: string;
  }[]
> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return memoryFeedback
      .filter((r) => r.store_id === storeId)
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        reason: r.reason,
        note: r.note ?? undefined,
        recommendationId: r.recommendation_id ?? undefined,
        decisionId: r.decision_id ?? undefined,
        createdAt: r.created_at,
      }));
  }

  const { data, error } = await supabase
    .from("decision_rejection_feedback")
    .select("id, reason, note, recommendation_id, decision_id, created_at")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingRejectionFeedbackTable(error)) {
      console.warn(
        "[decision-feedback] decision_rejection_feedback table missing — apply migration 20260702120000_decision_engine.sql",
      );
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const r = row as {
      id: string;
      reason: DecisionRejectionReason;
      note: string | null;
      recommendation_id: string | null;
      decision_id: string | null;
      created_at: string;
    };
    return {
      id: r.id,
      reason: r.reason,
      note: r.note ?? undefined,
      recommendationId: r.recommendation_id ?? undefined,
      decisionId: r.decision_id ?? undefined,
      createdAt: r.created_at,
    };
  });
}
