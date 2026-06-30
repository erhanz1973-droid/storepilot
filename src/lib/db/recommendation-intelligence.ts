import type { AnalyzerOutput } from "@/lib/types";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { parseRevenueImpact } from "@/lib/approvals/presenter";
import type {
  IntelligenceDashboard,
  LearningRecord,
  LifecycleEvent,
  LifecycleStage,
  OutcomeMetricsRecord,
  RecommendationActionRecord,
  RecommendationActionStatus,
  RecommendationTypeStats,
} from "@/lib/recommendations/intelligence/types";

// In-memory fallbacks
const memoryLifecycle: LifecycleEvent[] = [];
const memoryActions: RecommendationActionRecord[] = [];
const memoryOutcomes: OutcomeMetricsRecord[] = [];
const memoryLearning: LearningRecord[] = [];
const memoryTypeStats = new Map<string, RecommendationTypeStats>();

function pct(n: number, d: number): number {
  if (d === 0) return 0;
  return Math.round((n / d) * 1000) / 10;
}

function deltaPct(before: number, after: number): number {
  if (before === 0) return after > 0 ? 100 : 0;
  return Math.round(((after - before) / Math.abs(before)) * 1000) / 10;
}

export async function persistRecommendationIntelligenceFields(
  storeId: string,
  outputs: AnalyzerOutput[],
  idByDedupe: Map<string, string>,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  for (const output of outputs) {
    const recId = idByDedupe.get(output.id);
    if (!recId) continue;

    const validation = output.validation;
    const revenueGain = parseRevenueImpact(output.expectedImpact);

    const { error } = await supabase
      .from("recommendations")
      .update({
        validation_score: validation?.validationScore ?? null,
        ai_confidence: validation?.aiConfidence ?? output.confidence,
        validation_confidence: validation?.validationConfidence ?? null,
        estimated_revenue_gain: revenueGain > 0 ? revenueGain : null,
        reason_detail: output.description,
        validation_evidence: validation?.evidence ?? [],
        lifecycle_stage: "created",
      } as Record<string, unknown>)
      .eq("id", recId)
      .eq("store_id", storeId);

    if (error && !/could not find the .* column/i.test(error.message)) {
      console.warn("[StorePilot] intelligence field update skipped:", error.message);
    }
  }
}

export async function updateRecommendationLifecycle(
  recommendationId: string,
  stage: LifecycleStage,
  extra?: Record<string, unknown>,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { lifecycle_stage: stage, ...extra };

  if (stage === "displayed") updates.displayed_at = now;
  if (stage === "rejected") updates.rejected_at = now;
  if (stage === "executed") updates.executed_at = now;
  if (stage === "closed" || stage === "measured") updates.closed_at = now;

  if (!supabase) return;
  const { error } = await supabase.from("recommendations").update(updates).eq("id", recommendationId);
  if (error && !/could not find the .* column/i.test(error.message)) {
    console.warn("[StorePilot] lifecycle stage update skipped:", error.message);
  }
}

export async function insertLifecycleEvent(input: {
  recommendationId: string;
  storeId: string;
  eventType: LifecycleEvent["eventType"];
  label: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}): Promise<LifecycleEvent> {
  const row: LifecycleEvent = {
    id: crypto.randomUUID(),
    recommendationId: input.recommendationId,
    storeId: input.storeId,
    eventType: input.eventType,
    label: input.label,
    detail: input.detail,
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
  };

  memoryLifecycle.unshift(row);
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("recommendation_lifecycle_events").insert({
      id: row.id,
      recommendation_id: row.recommendationId,
      store_id: row.storeId,
      event_type: row.eventType,
      label: row.label,
      detail: row.detail ?? null,
      metadata: row.metadata ?? {},
    });
    if (error) {
      console.warn("[StorePilot] lifecycle event skipped:", error.message);
    }
  }
  return row;
}

export async function recordMerchantAction(input: {
  storeId: string;
  recommendationId: string;
  action: "approve" | "reject" | "later";
  userLabel?: string;
  note?: string;
  snoozeDays?: number;
}): Promise<RecommendationActionRecord> {
  const now = new Date().toISOString();
  const status: RecommendationActionStatus =
    input.action === "approve"
      ? "approved"
      : input.action === "reject"
        ? "rejected"
        : "snoozed";

  const record: RecommendationActionRecord = {
    id: crypto.randomUUID(),
    recommendationId: input.recommendationId,
    storeId: input.storeId,
    status,
    userLabel: input.userLabel ?? "Merchant",
    note: input.note,
    approvedAt: input.action === "approve" ? now : undefined,
    rejectedAt: input.action === "reject" ? now : undefined,
    snoozedUntil:
      input.action === "later"
        ? new Date(Date.now() + (input.snoozeDays ?? 7) * 86400000).toISOString()
        : undefined,
    createdAt: now,
  };

  memoryActions.unshift(record);
  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase.from("recommendation_actions").insert({
      id: record.id,
      recommendation_id: record.recommendationId,
      store_id: record.storeId,
      status: record.status,
      user_label: record.userLabel,
      note: record.note ?? null,
      approved_at: record.approvedAt ?? null,
      rejected_at: record.rejectedAt ?? null,
      snoozed_until: record.snoozedUntil ?? null,
    });
  }
  return record;
}

export async function listLifecycleEvents(
  recommendationId: string,
): Promise<LifecycleEvent[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return memoryLifecycle
      .filter((e) => e.recommendationId === recommendationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  const { data } = await supabase
    .from("recommendation_lifecycle_events")
    .select("*")
    .eq("recommendation_id", recommendationId)
    .order("created_at", { ascending: true });

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    recommendationId: r.recommendation_id as string,
    storeId: r.store_id as string,
    eventType: r.event_type as LifecycleEvent["eventType"],
    label: r.label as string,
    detail: (r.detail as string) ?? undefined,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: r.created_at as string,
  }));
}

export async function saveOutcomeMetrics(input: {
  storeId: string;
  recommendationId: string;
  outcomeRecordId?: string;
  measurementStart: string;
  measurementEnd: string;
  observationDays: number;
  revenueBefore?: number;
  revenueAfter?: number;
  profitBefore?: number;
  profitAfter?: number;
  roasBefore?: number;
  roasAfter?: number;
  conversionBefore?: number;
  conversionAfter?: number;
  aovBefore?: number;
  aovAfter?: number;
  success?: boolean;
  notes?: string;
}): Promise<OutcomeMetricsRecord> {
  const revenueDeltaPct =
    input.revenueBefore != null && input.revenueAfter != null
      ? deltaPct(input.revenueBefore, input.revenueAfter)
      : undefined;
  const roasDeltaPct =
    input.roasBefore != null && input.roasAfter != null
      ? deltaPct(input.roasBefore, input.roasAfter)
      : undefined;

  const record: OutcomeMetricsRecord = {
    id: crypto.randomUUID(),
    recommendationId: input.recommendationId,
    storeId: input.storeId,
    measurementStart: input.measurementStart,
    measurementEnd: input.measurementEnd,
    observationDays: input.observationDays,
    revenueBefore: input.revenueBefore,
    revenueAfter: input.revenueAfter,
    profitBefore: input.profitBefore,
    profitAfter: input.profitAfter,
    roasBefore: input.roasBefore,
    roasAfter: input.roasAfter,
    conversionBefore: input.conversionBefore,
    conversionAfter: input.conversionAfter,
    aovBefore: input.aovBefore,
    aovAfter: input.aovAfter,
    success: input.success,
    revenueDeltaPct,
    roasDeltaPct,
    notes: input.notes,
  };

  memoryOutcomes.unshift(record);
  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase.from("recommendation_outcome_metrics").insert({
      id: record.id,
      recommendation_id: record.recommendationId,
      store_id: record.storeId,
      outcome_record_id: input.outcomeRecordId ?? null,
      measurement_start: record.measurementStart,
      measurement_end: record.measurementEnd,
      observation_days: record.observationDays,
      revenue_before: record.revenueBefore ?? null,
      revenue_after: record.revenueAfter ?? null,
      profit_before: record.profitBefore ?? null,
      profit_after: record.profitAfter ?? null,
      roas_before: record.roasBefore ?? null,
      roas_after: record.roasAfter ?? null,
      conversion_before: record.conversionBefore ?? null,
      conversion_after: record.conversionAfter ?? null,
      aov_before: record.aovBefore ?? null,
      aov_after: record.aovAfter ?? null,
      success: record.success ?? null,
      revenue_delta_pct: record.revenueDeltaPct ?? null,
      roas_delta_pct: record.roasDeltaPct ?? null,
      notes: record.notes ?? null,
    });
  }

  await upsertTypeStats(input.storeId, input.recommendationId, record);
  return record;
}

async function upsertTypeStats(
  storeId: string,
  recommendationId: string,
  outcome: OutcomeMetricsRecord,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  let category = "unknown";

  if (supabase) {
    const { data } = await supabase
      .from("recommendations")
      .select("category")
      .eq("id", recommendationId)
      .maybeSingle();
    category = (data as { category?: string })?.category ?? "unknown";
  }

  const key = `${storeId}:${category}`;
  const prev = memoryTypeStats.get(key) ?? {
    category,
    successRatePct: 0,
    avgRevenueImprovementPct: 0,
    avgRoasImprovementPct: 0,
    evaluatedCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    executedCount: 0,
  };

  const n = prev.evaluatedCount + 1;
  const successCount =
    (prev.successRatePct / 100) * prev.evaluatedCount + (outcome.success ? 1 : 0);
  const updated: RecommendationTypeStats = {
    ...prev,
    evaluatedCount: n,
    successRatePct: pct(successCount, n),
    avgRevenueImprovementPct:
      Math.round(
        ((prev.avgRevenueImprovementPct * prev.evaluatedCount +
          (outcome.revenueDeltaPct ?? 0)) /
          n) *
          10,
      ) / 10,
    avgRoasImprovementPct:
      Math.round(
        ((prev.avgRoasImprovementPct * prev.evaluatedCount + (outcome.roasDeltaPct ?? 0)) / n) *
          10,
      ) / 10,
  };

  memoryTypeStats.set(key, updated);

  if (supabase) {
    await supabase.from("recommendation_type_stats").upsert(
      {
        store_id: storeId,
        category,
        success_rate_pct: updated.successRatePct,
        avg_revenue_improvement_pct: updated.avgRevenueImprovementPct,
        avg_roas_improvement_pct: updated.avgRoasImprovementPct,
        evaluated_count: updated.evaluatedCount,
        approved_count: updated.approvedCount,
        rejected_count: updated.rejectedCount,
        executed_count: updated.executedCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "store_id,category" },
    );
  }
}

export async function insertLearningRecord(input: {
  storeId: string;
  recommendationId?: string;
  category: string;
  confidence?: number;
  validationScore?: number;
  approved: boolean;
  successful?: boolean;
  revenueImpactPct?: number;
  roasImpactPct?: number;
  profitImpactPct?: number;
  observationDays?: number;
  evidence?: unknown[];
  industry?: string;
  storeSize?: string;
}): Promise<LearningRecord> {
  const record: LearningRecord = {
    id: crypto.randomUUID(),
    storeId: input.storeId,
    recommendationId: input.recommendationId,
    category: input.category,
    industry: input.industry ?? "general",
    storeSize: input.storeSize ?? "medium",
    confidence: input.confidence,
    validationScore: input.validationScore,
    approved: input.approved,
    successful: input.successful,
    revenueImpactPct: input.revenueImpactPct,
    roasImpactPct: input.roasImpactPct,
    profitImpactPct: input.profitImpactPct,
    observationDays: input.observationDays,
    evidence: input.evidence ?? [],
    createdAt: new Date().toISOString(),
  };

  memoryLearning.unshift(record);
  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase.from("recommendation_learning_records").insert({
      id: record.id,
      store_id: record.storeId,
      recommendation_id: record.recommendationId ?? null,
      category: record.category,
      industry: record.industry,
      store_size: record.storeSize,
      confidence: record.confidence ?? null,
      validation_score: record.validationScore ?? null,
      approved: record.approved,
      successful: record.successful ?? null,
      revenue_impact_pct: record.revenueImpactPct ?? null,
      roas_impact_pct: record.roasImpactPct ?? null,
      profit_impact_pct: record.profitImpactPct ?? null,
      observation_days: record.observationDays ?? null,
      evidence: record.evidence,
    });
  }
  return record;
}

export async function listTypeStats(storeId: string): Promise<RecommendationTypeStats[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return [...memoryTypeStats.values()].filter((s) =>
      [...memoryTypeStats.keys()].some((k) => k.startsWith(`${storeId}:`)),
    );
  }

  const { data } = await supabase
    .from("recommendation_type_stats")
    .select("*")
    .eq("store_id", storeId)
    .order("evaluated_count", { ascending: false });

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    category: r.category as string,
    successRatePct: Number(r.success_rate_pct),
    avgRevenueImprovementPct: Number(r.avg_revenue_improvement_pct),
    avgRoasImprovementPct: Number(r.avg_roas_improvement_pct),
    evaluatedCount: Number(r.evaluated_count),
    approvedCount: Number(r.approved_count),
    rejectedCount: Number(r.rejected_count),
    executedCount: Number(r.executed_count),
  }));
}

export async function buildIntelligenceDashboard(storeId: string): Promise<IntelligenceDashboard> {
  const supabase = getSupabaseAdmin();
  const typeStats = await listTypeStats(storeId);

  let generated = 0;
  let approved = 0;
  let rejected = 0;
  let executed = 0;
  let measured = 0;
  let successful = 0;
  let avgConfidence = 0;
  let avgValidation = 0;
  let revenueRecovered = 0;
  let revenueGenerated = 0;

  if (supabase) {
    const { count: genCount, error: genError } = await supabase
      .from("recommendations")
      .select("*", { count: "exact", head: true })
      .eq("store_id", storeId);
    if (!genError) generated = genCount ?? 0;

    const { data: recs, error: recsError } = await supabase
      .from("recommendations")
      .select("confidence_score, validation_score, status, estimated_revenue_gain")
      .eq("store_id", storeId);

    if (!recsError) {
      const rows = (recs ?? []) as {
        confidence_score: number;
        validation_score: number | null;
        status: string;
        estimated_revenue_gain: number | null;
      }[];

      if (rows.length > 0) {
        avgConfidence =
          Math.round(
            (rows.reduce((s, r) => s + Number(r.confidence_score), 0) / rows.length) * 1000,
          ) / 10;
        const withVal = rows.filter((r) => r.validation_score != null);
        if (withVal.length > 0) {
          avgValidation =
            Math.round(
              (withVal.reduce((s, r) => s + Number(r.validation_score), 0) / withVal.length) * 10,
            ) / 10;
        }
      }
    } else {
      const { data: basicRecs } = await supabase
        .from("recommendations")
        .select("confidence_score, status")
        .eq("store_id", storeId);
      const rows = (basicRecs ?? []) as { confidence_score: number }[];
      if (rows.length > 0) {
        avgConfidence =
          Math.round(
            (rows.reduce((s, r) => s + Number(r.confidence_score), 0) / rows.length) * 1000,
          ) / 10;
      }
    }

    const { data: actions } = await supabase
      .from("recommendation_actions")
      .select("status")
      .eq("store_id", storeId);

    for (const a of (actions ?? []) as { status: string }[]) {
      if (a.status === "approved") approved += 1;
      if (a.status === "rejected") rejected += 1;
      if (a.status === "executed") executed += 1;
    }

    const { data: outcomes } = await supabase
      .from("recommendation_outcome_metrics")
      .select("success, revenue_delta_pct, revenue_after, revenue_before")
      .eq("store_id", storeId);

    for (const o of (outcomes ?? []) as {
      success: boolean;
      revenue_delta_pct: number;
      revenue_after: number;
      revenue_before: number;
    }[]) {
      measured += 1;
      if (o.success) successful += 1;
      const delta = Number(o.revenue_after ?? 0) - Number(o.revenue_before ?? 0);
      if (delta >= 0) revenueGenerated += delta;
      else revenueRecovered += Math.abs(delta);
    }
  } else {
    generated = memoryLifecycle.length;
    approved = memoryActions.filter((a) => a.status === "approved").length;
    rejected = memoryActions.filter((a) => a.status === "rejected").length;
    executed = memoryActions.filter((a) => a.status === "executed").length;
    measured = memoryOutcomes.length;
    successful = memoryOutcomes.filter((o) => o.success).length;
  }

  const totalDecisions = approved + rejected || 1;
  const sorted = [...typeStats].sort((a, b) => b.successRatePct - a.successRatePct);

  const recentTimeline = memoryLifecycle.slice(0, 15);
  if (supabase) {
    const { data, error } = await supabase
      .from("recommendation_lifecycle_events")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(15);
    if (!error) {
      recentTimeline.length = 0;
      recentTimeline.push(
        ...((data ?? []) as Record<string, unknown>[]).map((r) => ({
          id: r.id as string,
          recommendationId: r.recommendation_id as string,
          storeId: r.store_id as string,
          eventType: r.event_type as LifecycleEvent["eventType"],
          label: r.label as string,
          detail: (r.detail as string) ?? undefined,
          createdAt: r.created_at as string,
        })),
      );
    }
  }

  return {
    generated,
    approvedPct: pct(approved, totalDecisions),
    rejectedPct: pct(rejected, totalDecisions),
    executionRatePct: pct(executed, approved || 1),
    successRatePct: pct(successful, measured || 1),
    revenueRecovered: Math.round(revenueRecovered),
    revenueGenerated: Math.round(revenueGenerated),
    costSaved: 0,
    avgConfidence,
    avgValidationScore: avgValidation,
    topPerforming: sorted.slice(0, 5),
    worstPerforming: [...sorted].reverse().slice(0, 5),
    recentTimeline,
  };
}
