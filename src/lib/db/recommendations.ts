import type {
  AnalyzerOutput,
  MeasurementKpis,
  Recommendation,
  RecommendationApproval,
  RecommendationCategory,
  RecommendationHistoryEntry,
  RecommendationStatus,
  SupportingMetric,
} from "@/lib/types";
import { DEMO_STORE_ID } from "@/lib/types";
import { analyzerOutputToRecommendation } from "@/lib/recommendations/registry";
import {
  clearRecommendationMemoryForTests,
  getRecommendationMemoryRecords,
  recommendationRepository,
  seedMemoryRecommendationForTests,
} from "@/lib/recommendations/repository";
import { recommendationService } from "@/lib/recommendations/service";
import { recordToLegacyRecommendation } from "@/lib/recommendations/types";
import { eventTypeForStatus } from "@/lib/recommendations/validators";
import { dbStatusToDomain } from "@/lib/recommendations/types";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/client";

type DbRecommendation = {
  id: string;
  store_id: string;
  dedupe_key: string;
  category: string;
  title: string;
  description: string;
  priority: string;
  expected_impact: string;
  confidence_score: number;
  action_label: string;
  entity_type: string | null;
  entity_id: string | null;
  evidence: SupportingMetric[];
  actions: { label: string; type: string }[];
  status: RecommendationStatus;
  snoozed_until: string | null;
  created_at: string;
  approved_at: string | null;
  implemented_at?: string | null;
  completed_at: string | null;
  measured_at?: string | null;
  actual_impact?: string | null;
  prediction_accuracy?: number | null;
  measurement_window_days?: number;
  baseline_metrics?: MeasurementKpis;
  outcome_metrics?: MeasurementKpis;
  outcome_summary?: string | null;
};

// ---------------------------------------------------------------------------
// In-memory fallback (dev without Supabase) — backed by recommendation repository
// ---------------------------------------------------------------------------
export const memoryRecommendations = getRecommendationMemoryRecords();

export function seedMemoryRecommendation(overrides: {
  id: string;
  dedupe_key: string;
  status?: RecommendationStatus;
  entity_id?: string;
  entity_type?: string;
}) {
  seedMemoryRecommendationForTests({
    ...overrides,
    store_id: DEMO_STORE_ID,
    status: overrides.status,
  });
}

export { clearRecommendationMemoryForTests as clearMemoryRecommendations };

const memoryApprovals = new Map<string, RecommendationApproval>();

async function appendDomainEventForLegacyStatus(
  recommendationId: string,
  status: RecommendationStatus,
  fromStatus: RecommendationStatus,
  note?: string,
): Promise<void> {
  const domain = dbStatusToDomain(status);
  const eventType = eventTypeForStatus(domain);
  if (!eventType) return;
  await recommendationRepository.appendEvent({
    recommendationId,
    eventType,
    payloadJson: { fromStatus, toStatus: status, note },
  });
}

function rowToRecommendation(row: DbRecommendation): Recommendation {
  return {
    id: row.id,
    category: row.category as Recommendation["category"],
    title: row.title,
    severity: row.priority as Recommendation["severity"],
    reason: row.description,
    expectedImpact: row.expected_impact,
    confidenceScore: Number(row.confidence_score),
    actionLabel: row.action_label,
    supportingMetrics: row.evidence ?? [],
    entityType: row.entity_type ?? undefined,
    entityId: row.entity_id ?? undefined,
    createdAt: row.created_at,
    status: row.status,
    approvedAt: row.approved_at ?? undefined,
    implementedAt: row.implemented_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    measuredAt: row.measured_at ?? undefined,
    snoozedUntil: row.snoozed_until ?? undefined,
    actualImpact: row.actual_impact ?? undefined,
    predictionAccuracy: row.prediction_accuracy
      ? Number(row.prediction_accuracy)
      : undefined,
    measurementWindowDays: row.measurement_window_days,
    baselineMetrics: row.baseline_metrics,
    outcomeMetrics: row.outcome_metrics,
    outcomeSummary: row.outcome_summary ?? undefined,
  };
}

function outputToRow(
  output: AnalyzerOutput,
  storeId: string,
  existing?: DbRecommendation,
): DbRecommendation {
  const now = new Date().toISOString();
  return {
    id: existing?.id ?? crypto.randomUUID(),
    store_id: storeId,
    dedupe_key: output.id,
    category: output.category,
    title: output.title,
    description: output.description,
    priority: output.priority,
    expected_impact: output.expectedImpact,
    confidence_score: output.confidence,
    action_label: output.actions[0]?.label ?? "Review",
    entity_type: output.entityType ?? null,
    entity_id: output.entityId ?? null,
    evidence: output.evidence,
    actions: output.actions,
    status: existing?.status ?? "pending",
    snoozed_until: existing?.snoozed_until ?? null,
    created_at: existing?.created_at ?? now,
    approved_at: existing?.approved_at ?? null,
    implemented_at: existing?.implemented_at ?? null,
    completed_at: existing?.completed_at ?? null,
    measured_at: existing?.measured_at ?? null,
    actual_impact: existing?.actual_impact ?? null,
    prediction_accuracy: existing?.prediction_accuracy ?? null,
    measurement_window_days: existing?.measurement_window_days ?? 7,
    baseline_metrics: existing?.baseline_metrics,
    outcome_metrics: existing?.outcome_metrics,
    outcome_summary: existing?.outcome_summary ?? null,
  };
}

// ---------------------------------------------------------------------------
// Sync analyzer outputs → persistence
// ---------------------------------------------------------------------------
export async function syncRecommendations(
  outputs: AnalyzerOutput[],
  storeId = DEMO_STORE_ID,
): Promise<Recommendation[]> {
  const records = await recommendationService.syncFromAnalyzerOutputs(outputs, storeId);
  return records.map(recordToLegacyRecommendation);
}

export async function reconcileStaleRecommendations(
  storeId: string,
  currentDedupeKeys: Set<string>,
): Promise<number> {
  return recommendationService.reconcileStale(storeId, currentDedupeKeys);
}

export async function mirrorDecisionToRecommendations(
  storeId: string,
  action: "approve" | "later" | "reject",
  keys: {
    entityId?: string;
    entityType?: string;
    opportunityKey?: string;
  },
): Promise<void> {
  const status: RecommendationStatus =
    action === "approve" ? "approved" : action === "reject" ? "ignored" : "snoozed";
  const dedupeKeys = new Set<string>();

  if (keys.opportunityKey?.startsWith("camp-")) {
    dedupeKeys.add(keys.opportunityKey);
  }
  if (keys.entityType === "campaign" && keys.entityId) {
    dedupeKeys.add(`camp-${keys.entityId}`);
  }

  if (dedupeKeys.size === 0 && !keys.entityId) return;

  const supabase = getSupabaseAdmin();
  type MatchRow = Pick<DbRecommendation, "id" | "dedupe_key" | "entity_id" | "entity_type" | "status">;
  let rows: MatchRow[] = [];

  if (!supabase) {
    rows = [...memoryRecommendations.values()]
      .filter((row) => row.store_id === storeId)
      .map((row) => ({
        id: row.id,
        dedupe_key: row.dedupe_key,
        entity_id: row.entity_id,
        entity_type: row.entity_type,
        status: row.status as RecommendationStatus,
      }));
  } else {
    const { data, error } = await supabase
      .from("recommendations")
      .select("id, dedupe_key, entity_id, entity_type, status")
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    rows = (data ?? []) as MatchRow[];
  }

  for (const row of rows) {
    if (row.status === "measured") continue;

    const matchesDedupe = dedupeKeys.has(row.dedupe_key);
    const matchesEntity =
      keys.entityType === "campaign" &&
      keys.entityId &&
      row.entity_type === "campaign" &&
      campaignEntityIdsMatch(row.entity_id ?? "", keys.entityId);

    if (!matchesDedupe && !matchesEntity) continue;

    await updateRecommendationStatus(row.id, status, {
      snoozeDays: action === "later" ? 7 : undefined,
      note:
        action === "approve"
          ? "Resolved via decision center"
          : action === "reject"
            ? "Rejected via decision center"
            : "Deferred via decision center",
    }, storeId);
  }
}

function campaignEntityIdsMatch(storedEntityId: string, keyEntityId: string): boolean {
  if (!storedEntityId || !keyEntityId) return false;
  if (storedEntityId === keyEntityId) return true;

  const normalize = (id: string) => (id.startsWith("camp-") ? id.slice(5) : id);
  const a = normalize(storedEntityId);
  const b = normalize(keyEntityId);
  if (a === b) return true;

  const suffix = (id: string) => (id.includes(":") ? id.split(":").pop()! : id);
  return suffix(a) === suffix(b);
}

/** Remove pending recommendations for disconnected connector categories */
export async function purgeRecommendationsByCategories(
  storeId: string,
  categories: RecommendationCategory[],
): Promise<void> {
  if (categories.length === 0) return;

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    for (const [id, row] of memoryRecommendations) {
      if (
        row.store_id === storeId &&
        categories.includes(row.category as RecommendationCategory) &&
        row.status === "pending"
      ) {
        memoryRecommendations.delete(id);
      }
    }
    return;
  }

  const { error } = await supabase
    .from("recommendations")
    .delete()
    .eq("store_id", storeId)
    .eq("status", "pending")
    .in("category", categories);

  if (error) throw new Error(`Failed to purge recommendations: ${error.message}`);
}

export async function listStoredRecommendations(
  storeId = DEMO_STORE_ID,
): Promise<Recommendation[]> {
  return recommendationService.listAsLegacy(storeId);
}

export async function getRecommendationById(
  id: string,
): Promise<Recommendation | null> {
  const record = await recommendationService.getById(id);
  return record ? recordToLegacyRecommendation(record) : null;
}

export async function updateRecommendationStatus(
  recommendationId: string,
  status: RecommendationStatus,
  options?: { note?: string; snoozeDays?: number; baselineMetrics?: MeasurementKpis },
  storeId = DEMO_STORE_ID,
): Promise<RecommendationApproval> {
  const now = new Date();
  const snoozedUntil =
    status === "snoozed"
      ? new Date(now.getTime() + (options?.snoozeDays ?? 7) * 86400000).toISOString()
      : undefined;

  const supabase = getSupabaseAdmin();
  const approval: RecommendationApproval = {
    recommendationId,
    status,
    note: options?.note,
    updatedAt: now.toISOString(),
    snoozedUntil,
  };

  if (!supabase) {
    const row = memoryRecommendations.get(recommendationId);
    if (row) {
      const fromStatus = row.status as RecommendationStatus;
      const updates: Record<string, unknown> = {
        snoozed_until: snoozedUntil ?? null,
      };
      if (status === "approved") updates.approved_at = now.toISOString();
      if (status === "implemented") {
        updates.implemented_at = now.toISOString();
        updates.measurement_window_days = Number(process.env.MEASUREMENT_WINDOW_DAYS ?? 7);
      }
      if (status === "completed") updates.completed_at = now.toISOString();
      await recommendationRepository.updateRawStatus(recommendationId, status, updates);
      await appendDomainEventForLegacyStatus(
        recommendationId,
        status,
        fromStatus,
        options?.note,
      );
    }
    memoryApprovals.set(recommendationId, approval);
    return approval;
  }

  const { data: existing, error: existingError } = await supabase
    .from("recommendations")
    .select("status")
    .eq("id", recommendationId)
    .single();

  if (existingError) throw new Error(existingError.message);

  const fromStatus = ((existing as { status: RecommendationStatus })?.status) ?? "pending";

  const updates: Record<string, unknown> = {
    status,
    snoozed_until: snoozedUntil ?? null,
  };
  if (status === "approved") updates.approved_at = now.toISOString();
  if (status === "implemented") {
    updates.implemented_at = now.toISOString();
    updates.baseline_metrics = options?.baselineMetrics ?? null;
    updates.measurement_window_days = Number(process.env.MEASUREMENT_WINDOW_DAYS ?? 7);
  }
  if (status === "completed") updates.completed_at = now.toISOString();

  const { error: updateError } = await supabase
    .from("recommendations")
    .update(updates as Record<string, string | null>)
    .eq("id", recommendationId);

  if (updateError) throw new Error(updateError.message);

  await supabase.from("approvals").insert({
    recommendation_id: recommendationId,
    store_id: storeId,
    status,
    note: options?.note ?? null,
    snoozed_until: snoozedUntil ?? null,
  } as Record<string, unknown>);

  await supabase.from("recommendation_history").insert({
    recommendation_id: recommendationId,
    store_id: storeId,
    from_status: fromStatus,
    to_status: status,
    note: options?.note ?? null,
  } as Record<string, unknown>);

  await appendDomainEventForLegacyStatus(
    recommendationId,
    status,
    fromStatus,
    options?.note,
  );

  return approval;
}

export async function getAllApprovals(): Promise<RecommendationApproval[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return Array.from(memoryApprovals.values());

  const { data, error } = await supabase
    .from("approvals")
    .select("recommendation_id, status, note, snoozed_until, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const latest = new Map<string, RecommendationApproval>();
  for (const row of (data ?? []) as {
    recommendation_id: string;
    status: string;
    note: string | null;
    snoozed_until: string | null;
    created_at: string;
  }[]) {
    if (!latest.has(row.recommendation_id)) {
      latest.set(row.recommendation_id, {
        recommendationId: row.recommendation_id,
        status: row.status as RecommendationStatus,
        note: row.note ?? undefined,
        updatedAt: row.created_at,
        snoozedUntil: row.snoozed_until ?? undefined,
      });
    }
  }
  return Array.from(latest.values());
}

export async function listRecommendationHistory(
  storeId = DEMO_STORE_ID,
  filters?: {
    status?: RecommendationStatus;
    priority?: string;
    category?: string;
  },
): Promise<RecommendationHistoryEntry[]> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const recs = [...memoryRecommendations.values()].filter((r) => r.store_id === storeId);
    return recs
      .filter((r) => !filters?.status || r.status === filters.status)
      .filter((r) => !filters?.priority || r.priority === filters.priority)
      .filter((r) => !filters?.category || r.category === filters.category)
      .map((r) => ({
        id: r.id,
        recommendationId: r.id,
        recommendation: rowToRecommendation(r as unknown as DbRecommendation),
        status: r.status as RecommendationStatus,
        expectedImpact: r.expected_impact,
        confidenceScore: Number(r.confidence_score),
        createdAt: r.created_at,
        approvedAt: r.approved_at ?? undefined,
        completedAt: r.completed_at ?? undefined,
      }));
  }

  let query = supabase
    .from("recommendations")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.priority) query = query.eq("priority", filters.priority);
  if (filters?.category) query = query.eq("category", filters.category);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => {
    const rec = rowToRecommendation(r as DbRecommendation);
    return {
      id: rec.id,
      recommendationId: rec.id,
      recommendation: rec,
      status: rec.status ?? "pending",
      expectedImpact: rec.expectedImpact,
      confidenceScore: rec.confidenceScore,
      createdAt: rec.createdAt,
      approvedAt: rec.approvedAt,
      completedAt: rec.completedAt,
    };
  });
}

export async function saveDailySnapshot(
  storeId: string,
  healthScore: number,
  healthBreakdown: Record<string, number>,
  briefSummary: unknown,
  snapshotData: unknown,
  factorScores?: Record<string, number>,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const today = new Date().toISOString().slice(0, 10);
  await supabase.from("daily_snapshots").upsert(
    {
      store_id: storeId,
      snapshot_date: today,
      health_score: healthScore,
      health_breakdown: healthBreakdown,
      brief_summary: briefSummary,
      snapshot_data: snapshotData,
      factor_scores: factorScores ?? {},
    } as Record<string, unknown>,
    { onConflict: "store_id,snapshot_date" },
  );
}

export async function getPreviousDailySnapshot(
  storeId: string,
): Promise<{
  healthScore: number;
  factorScores: Record<string, number>;
} | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const { data } = await supabase
    .from("daily_snapshots")
    .select("health_score, factor_scores, snapshot_date")
    .eq("store_id", storeId)
    .lt("snapshot_date", today)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const row = data as {
    health_score: number;
    factor_scores?: Record<string, number>;
    snapshot_date: string;
  };

  if (row.snapshot_date === yesterday || row.snapshot_date < yesterday) {
    return {
      healthScore: row.health_score,
      factorScores: row.factor_scores ?? {},
    };
  }

  return null;
}

export async function syncConnectorStatuses(
  storeId: string,
  statuses: { connector_type: string; label: string; status: string; last_sync_at?: string }[],
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase.from("connectors").upsert(
    statuses.map((s) => ({
      store_id: storeId,
      connector_type: s.connector_type,
      label: s.label,
      status: s.status,
      last_sync_at: s.last_sync_at ?? null,
    })) as Record<string, unknown>[],
    { onConflict: "store_id,connector_type" },
  );
}

export function getPersistenceMode(): "supabase" | "memory" {
  return isSupabaseConfigured() ? "supabase" : "memory";
}

/** Map analyzer output for API compatibility */
export { analyzerOutputToRecommendation };

export async function applyRecommendationOutcome(
  recommendationId: string,
  update: {
    status: RecommendationStatus;
    actualImpact: string;
    predictionAccuracy: number;
    measuredAt: string;
    outcomeMetrics: MeasurementKpis;
    outcomeSummary: string;
    measurementWindowDays: number;
  },
): Promise<Recommendation> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const row = memoryRecommendations.get(recommendationId);
    if (!row) throw new Error("Recommendation not found");
    row.status = update.status;
    row.actual_impact = update.actualImpact;
    row.prediction_accuracy = update.predictionAccuracy;
    row.measured_at = update.measuredAt;
    row.outcome_metrics = update.outcomeMetrics;
    row.outcome_summary = update.outcomeSummary;
    row.measurement_window_days = update.measurementWindowDays;
    row.completed_at = row.completed_at ?? update.measuredAt;
    memoryRecommendations.set(recommendationId, row);
    return rowToRecommendation(row as unknown as DbRecommendation);
  }

  const { data, error } = await supabase
    .from("recommendations")
    .update({
      status: update.status,
      actual_impact: update.actualImpact,
      prediction_accuracy: update.predictionAccuracy,
      measured_at: update.measuredAt,
      outcome_metrics: update.outcomeMetrics,
      outcome_summary: update.outcomeSummary,
      measurement_window_days: update.measurementWindowDays,
      completed_at: update.measuredAt,
    })
    .eq("id", recommendationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return rowToRecommendation(data as DbRecommendation);
}
