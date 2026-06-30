import type { AnalyzerOutput } from "@/lib/types";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type {
  RecommendationAuditRecord,
  RecommendationCalculationBasis,
  ValidationEvidenceItem,
} from "./types";

const memoryAudit: RecommendationAuditRecord[] = [];
const MAX_MEMORY = 500;

function rowToRecord(row: Record<string, unknown>): RecommendationAuditRecord {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    timestamp: row.created_at as string,
    recommendationDedupeKey: row.recommendation_dedupe_key as string,
    recommendationId: (row.recommendation_id as string) ?? undefined,
    title: row.title as string,
    category: row.category as string,
    aiConfidence: Number(row.ai_confidence),
    validationConfidence: Number(row.validation_confidence),
    finalConfidence: Number(row.final_confidence),
    validationScore: row.validation_score != null ? Number(row.validation_score) : null,
    providersUsed: (row.providers_used as string[]) ?? [],
    providersBlocked: (row.providers_blocked as string[]) ?? [],
    evidence: (row.evidence as ValidationEvidenceItem[]) ?? [],
    calculationBasis: (row.calculation_basis as RecommendationCalculationBasis[]) ?? [],
    outcomeStatus: row.outcome_status as RecommendationAuditRecord["outcomeStatus"],
    outcomeSummary: (row.outcome_summary as string) ?? undefined,
    durationMs: Number(row.duration_ms ?? 0),
  };
}

export async function recordRecommendationAuditBatch(input: {
  storeId: string;
  outputs: AnalyzerOutput[];
  recommendationIds?: Map<string, string>;
  durationMs: number;
}): Promise<RecommendationAuditRecord[]> {
  const records: RecommendationAuditRecord[] = [];

  for (const output of input.outputs) {
    if (!output.validation) continue;
    const record: RecommendationAuditRecord = {
      id: crypto.randomUUID(),
      storeId: input.storeId,
      timestamp: new Date().toISOString(),
      recommendationDedupeKey: output.id,
      recommendationId: input.recommendationIds?.get(output.id),
      title: output.title,
      category: output.category,
      aiConfidence: output.validation.aiConfidence,
      validationConfidence: output.validation.validationConfidence,
      finalConfidence: output.validation.finalConfidence,
      validationScore: output.validation.validationScore,
      providersUsed: output.validation.providersUsed,
      providersBlocked: output.validation.providersBlocked,
      evidence: output.validation.evidence,
      calculationBasis: output.validation.calculationBasis,
      outcomeStatus: "pending",
      durationMs: input.durationMs,
    };
    records.push(record);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    memoryAudit.unshift(...records);
    if (memoryAudit.length > MAX_MEMORY) memoryAudit.length = MAX_MEMORY;
    return records;
  }

  if (records.length === 0) return records;

  const { error } = await supabase.from("recommendation_validation_audit").insert(
    records.map((r) => ({
      id: r.id,
      store_id: r.storeId,
      recommendation_dedupe_key: r.recommendationDedupeKey,
      recommendation_id: r.recommendationId ?? null,
      title: r.title,
      category: r.category,
      ai_confidence: r.aiConfidence,
      validation_confidence: r.validationConfidence,
      final_confidence: r.finalConfidence,
      validation_score: r.validationScore,
      providers_used: r.providersUsed,
      providers_blocked: r.providersBlocked,
      evidence: r.evidence,
      calculation_basis: r.calculationBasis,
      outcome_status: r.outcomeStatus,
      duration_ms: r.durationMs,
    })),
  );

  if (error) {
    console.warn("[audit] Failed to persist validation audit:", error.message);
    memoryAudit.unshift(...records);
  }

  return records;
}

export async function listRecommendationAudit(
  storeId: string,
  limit = 50,
): Promise<RecommendationAuditRecord[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return memoryAudit.filter((r) => r.storeId === storeId).slice(0, limit);
  }

  const { data } = await supabase
    .from("recommendation_validation_audit")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as Record<string, unknown>[]).map(rowToRecord);
}

export async function updateAuditOutcome(
  auditId: string,
  input: {
    outcomeStatus: RecommendationAuditRecord["outcomeStatus"];
    outcomeSummary?: string;
    outcomeMetrics?: Record<string, unknown>;
  },
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const row = memoryAudit.find((r) => r.id === auditId);
    if (row) {
      row.outcomeStatus = input.outcomeStatus;
      row.outcomeSummary = input.outcomeSummary;
    }
    return;
  }

  await supabase
    .from("recommendation_validation_audit")
    .update({
      outcome_status: input.outcomeStatus,
      outcome_summary: input.outcomeSummary ?? null,
      outcome_metrics: input.outcomeMetrics ?? null,
    })
    .eq("id", auditId);
}

export async function getLatestAuditByRecommendationId(
  storeId: string,
  recommendationId: string,
): Promise<RecommendationAuditRecord | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return (
      memoryAudit.find(
        (r) => r.storeId === storeId && r.recommendationId === recommendationId,
      ) ?? null
    );
  }

  const { data } = await supabase
    .from("recommendation_validation_audit")
    .select("*")
    .eq("store_id", storeId)
    .eq("recommendation_id", recommendationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? rowToRecord(data as Record<string, unknown>) : null;
}

export async function getLatestAuditForRecommendation(
  storeId: string,
  dedupeKey: string,
): Promise<RecommendationAuditRecord | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return memoryAudit.find((r) => r.storeId === storeId && r.recommendationDedupeKey === dedupeKey) ?? null;
  }

  const { data } = await supabase
    .from("recommendation_validation_audit")
    .select("*")
    .eq("store_id", storeId)
    .eq("recommendation_dedupe_key", dedupeKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? rowToRecord(data as Record<string, unknown>) : null;
}
