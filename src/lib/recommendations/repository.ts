import type {
  CreateRecommendationInput,
  RecommendationDomainStatus,
  RecommendationEvent,
  RecommendationEventType,
  RecommendationEvidence,
  RecommendationRecord,
} from "./types";
import {
  dbStatusToDomain,
  domainStatusToDb,
  domainStatusToLegacyDb,
} from "./types";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/client";
import { DEMO_STORE_ID } from "@/lib/types";

type DbRow = {
  id: string;
  store_id: string;
  dedupe_key: string;
  category: string;
  recommendation_type: string | null;
  title: string;
  description: string;
  reason: string | null;
  priority: string;
  expected_impact: string;
  confidence_score: number;
  validation_score: number | null;
  estimated_revenue_gain: number | null;
  estimated_cost_saving: number | null;
  evidence: unknown;
  evidence_json: RecommendationEvidence | null;
  entity_type: string | null;
  entity_id: string | null;
  status: string;
  snoozed_until: string | null;
  approved_at: string | null;
  implemented_at?: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  action_label?: string;
  actions?: { label: string; type: string }[];
  measured_at?: string | null;
  actual_impact?: string | null;
  prediction_accuracy?: number | null;
  measurement_window_days?: number;
  baseline_metrics?: unknown;
  outcome_metrics?: unknown;
  outcome_summary?: string | null;
};

type DbEventRow = {
  id: string;
  recommendation_id: string;
  event_type: RecommendationEventType;
  payload_json: Record<string, unknown>;
  created_at: string;
  user_id: string | null;
};

// ---------------------------------------------------------------------------
// In-memory fallback (dev without Supabase)
// ---------------------------------------------------------------------------
const memoryRecords = new Map<string, DbRow>();
const memoryEvents: DbEventRow[] = [];

function parseEvidence(row: DbRow): RecommendationEvidence {
  if (row.evidence_json && typeof row.evidence_json === "object") {
    const ej = row.evidence_json as RecommendationEvidence;
    if (Array.isArray(ej.supportingMetrics)) return ej;
  }
  const legacy = Array.isArray(row.evidence) ? row.evidence : [];
  return {
    supportingMetrics: legacy as RecommendationEvidence["supportingMetrics"],
    providerSources: [],
  };
}

function rowToRecord(row: DbRow): RecommendationRecord {
  const evidence = parseEvidence(row);
  return {
    id: row.id,
    storeId: row.store_id,
    recommendationType: row.recommendation_type ?? row.category,
    priority: row.priority as RecommendationRecord["priority"],
    status: dbStatusToDomain(row.status),
    confidence: Number(row.confidence_score),
    validationScore: row.validation_score != null ? Number(row.validation_score) : null,
    title: row.title,
    description: row.description,
    reason: row.reason ?? row.description,
    expectedImpact: row.expected_impact,
    estimatedRevenueGain:
      row.estimated_revenue_gain != null ? Number(row.estimated_revenue_gain) : null,
    estimatedCostSaving:
      row.estimated_cost_saving != null ? Number(row.estimated_cost_saving) : null,
    evidence,
    dedupeKey: row.dedupe_key,
    entityType: row.entity_type ?? undefined,
    entityId: row.entity_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function eventRowToEvent(row: DbEventRow): RecommendationEvent {
  return {
    id: row.id,
    recommendationId: row.recommendation_id,
    eventType: row.event_type,
    payloadJson: row.payload_json ?? {},
    createdAt: row.created_at,
    userId: row.user_id ?? undefined,
  };
}

function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  if (value > 1) return Math.min(1, value / 100);
  return Math.max(0, Math.min(1, value));
}

function inputToRow(
  input: CreateRecommendationInput,
  existing?: DbRow,
): DbRow {
  const now = new Date().toISOString();
  const status = input.status
    ? domainStatusToDb(input.status)
    : existing?.status ?? "pending";
  return {
    id: existing?.id ?? crypto.randomUUID(),
    store_id: input.storeId,
    dedupe_key: input.dedupeKey,
    category: String(input.recommendationType),
    recommendation_type: String(input.recommendationType),
    title: input.title,
    description: input.description,
    reason: input.reason,
    priority: input.priority,
    expected_impact: input.expectedImpact,
    confidence_score: normalizeConfidence(input.confidence),
    validation_score: input.validationScore ?? null,
    estimated_revenue_gain: input.estimatedRevenueGain ?? null,
    estimated_cost_saving: input.estimatedCostSaving ?? null,
    evidence: input.evidence.supportingMetrics,
    evidence_json: input.evidence,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    status,
    snoozed_until: existing?.snoozed_until ?? null,
    approved_at: existing?.approved_at ?? null,
    implemented_at: existing?.implemented_at ?? null,
    completed_at: existing?.completed_at ?? null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
}

/** Columns present in `20260616120000_initial_schema.sql` only. */
function buildLegacyUpsertPayload(row: DbRow): Record<string, unknown> {
  const description =
    row.reason && row.reason !== row.description
      ? `${row.description}\n\n${row.reason}`
      : row.description;

  const evidenceMetrics =
    row.evidence_json?.supportingMetrics?.length
      ? row.evidence_json.supportingMetrics
      : row.evidence;

  return {
    id: row.id,
    store_id: row.store_id,
    dedupe_key: row.dedupe_key,
    category: row.category,
    title: row.title,
    description,
    priority: row.priority,
    expected_impact: row.expected_impact,
    confidence_score: row.confidence_score,
    action_label: "Review",
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    evidence: evidenceMetrics,
    actions: [],
    status: domainStatusToLegacyDb(row.status),
    snoozed_until: row.snoozed_until,
    approved_at: row.approved_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function isNoRowsReturnedError(message: string): boolean {
  return /0 rows|no rows|multiple \(or no\) rows returned|PGRST116/i.test(message);
}

function buildFullUpsertPayload(row: DbRow): Record<string, unknown> {
  return {
    id: row.id,
    store_id: row.store_id,
    dedupe_key: row.dedupe_key,
    category: row.category,
    recommendation_type: row.recommendation_type,
    title: row.title,
    description: row.description,
    reason: row.reason,
    priority: row.priority,
    expected_impact: row.expected_impact,
    confidence_score: row.confidence_score,
    validation_score: row.validation_score,
    estimated_revenue_gain: row.estimated_revenue_gain,
    estimated_cost_saving: row.estimated_cost_saving,
    evidence: row.evidence,
    evidence_json: row.evidence_json,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    status: row.status,
    snoozed_until: row.snoozed_until,
    approved_at: row.approved_at,
    implemented_at: row.implemented_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    action_label: "Review",
    actions: [],
  };
}

async function readRecommendationRow(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  row: DbRow,
): Promise<DbRow | null> {
  const { data: byKey, error: keyError } = await supabase
    .from("recommendations")
    .select("*")
    .eq("store_id", row.store_id)
    .eq("dedupe_key", row.dedupe_key)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (keyError) throw new Error(keyError.message);
  if (byKey?.[0]) return byKey[0] as DbRow;

  const { data: byId, error: idError } = await supabase
    .from("recommendations")
    .select("*")
    .eq("id", row.id)
    .maybeSingle();

  if (idError) throw new Error(idError.message);
  return byId ? (byId as DbRow) : null;
}

function isMissingColumnError(message: string): boolean {
  return /could not find the .* column/i.test(message);
}

function isInvalidEnumError(message: string): boolean {
  return /invalid input value for enum/i.test(message);
}

function isMissingTableError(message: string): boolean {
  return /does not exist|schema cache/i.test(message);
}

let legacySchemaWarned = false;

async function ensureStoreExists(storeId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { data, error: readError } = await supabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (data) return;

  const { error: insertError } = await supabase.from("stores").insert({
    id: storeId,
    name: storeId === DEMO_STORE_ID ? "Demo Store" : "Store",
    shopify_domain: storeId === DEMO_STORE_ID ? "demo.storepilot.ai" : null,
  });

  if (insertError && !/duplicate key|unique/i.test(insertError.message)) {
    throw new Error(`Failed to ensure store exists: ${insertError.message}`);
  }
}

async function upsertRecommendationRow(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  row: DbRow,
): Promise<DbRow> {
  const attempt = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("recommendations")
      .upsert(payload, { onConflict: "store_id,dedupe_key" })
      .select("*")
      .single();
    return { data: data as DbRow | null, error };
  };

  let { data, error } = await attempt(buildFullUpsertPayload(row));

  if (
    error &&
    (isMissingColumnError(error.message) ||
      isInvalidEnumError(error.message))
  ) {
    if (!legacySchemaWarned && isMissingColumnError(error.message)) {
      legacySchemaWarned = true;
      console.warn(
        "[StorePilot] recommendations table is missing extended columns. " +
          "Run supabase/migrations/20260710120000_pilot_recommendations_catchup.sql. " +
          "Falling back to legacy upsert payload.",
      );
    }
    ({ data, error } = await attempt(buildLegacyUpsertPayload(row)));
  }

  if (!error && data) return data;

  if (!error || isNoRowsReturnedError(error.message)) {
    const reread = await readRecommendationRow(supabase, row);
    if (reread) return reread;
  }

  if (error) {
    throw new Error(`Failed to upsert recommendation: ${error.message}`);
  }

  console.warn(
    "[StorePilot] Recommendation upsert returned no row; using in-memory payload for",
    row.dedupe_key,
  );
  return row;
}

export function clearRecommendationMemoryForTests(): void {
  memoryRecords.clear();
  memoryEvents.length = 0;
}

export function getRecommendationMemoryRecords(): Map<string, DbRow> {
  return memoryRecords;
}

export function getRecommendationMemoryEvents(): DbEventRow[] {
  return memoryEvents;
}

export function seedMemoryRecommendationForTests(overrides: {
  id: string;
  dedupe_key: string;
  store_id?: string;
  status?: string;
  entity_id?: string;
  entity_type?: string;
  category?: string;
}): void {
  const now = new Date().toISOString();
  memoryRecords.set(overrides.id, {
    id: overrides.id,
    store_id: overrides.store_id ?? "00000000-0000-4000-8000-000000000001",
    dedupe_key: overrides.dedupe_key,
    category: overrides.category ?? "campaign_review",
    recommendation_type: overrides.category ?? "campaign_review",
    title: "Campaign Needs Review",
    description: "Test",
    reason: "Test",
    priority: "high",
    expected_impact: "$100",
    confidence_score: 0.8,
    validation_score: null,
    estimated_revenue_gain: null,
    estimated_cost_saving: null,
    evidence: [],
    evidence_json: { supportingMetrics: [], providerSources: [] },
    entity_type: overrides.entity_type ?? "campaign",
    entity_id: overrides.entity_id ?? "camp-123",
    status: overrides.status ?? "pending",
    snoozed_until: null,
    approved_at: null,
    implemented_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  });
}

export class RecommendationRepository {
  getPersistenceMode(): "supabase" | "memory" {
    return isSupabaseConfigured() ? "supabase" : "memory";
  }

  async findById(id: string): Promise<RecommendationRecord | null> {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      const row = memoryRecords.get(id);
      return row ? rowToRecord(row) : null;
    }

    const { data, error } = await supabase
      .from("recommendations")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? rowToRecord(data as DbRow) : null;
  }

  async findByStoreId(storeId: string): Promise<RecommendationRecord[]> {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return [...memoryRecords.values()]
        .filter((row) => row.store_id === storeId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(rowToRecord);
    }

    const { data, error } = await supabase
      .from("recommendations")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => rowToRecord(row as DbRow));
  }

  async findByDedupeKey(
    storeId: string,
    dedupeKey: string,
  ): Promise<RecommendationRecord | null> {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      const row = [...memoryRecords.values()].find(
        (r) => r.store_id === storeId && r.dedupe_key === dedupeKey,
      );
      return row ? rowToRecord(row) : null;
    }

    const { data, error } = await supabase
      .from("recommendations")
      .select("*")
      .eq("store_id", storeId)
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? rowToRecord(data as DbRow) : null;
  }

  async upsert(input: CreateRecommendationInput): Promise<{
    record: RecommendationRecord;
    created: boolean;
  }> {
    const existing = await this.findByDedupeKey(input.storeId, input.dedupeKey);
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      const existingRow = existing
        ? memoryRecords.get(existing.id)
        : undefined;
      const row = inputToRow(input, existingRow);
      const created = !existing;
      if (existing) {
        row.status = existingRow!.status;
        row.created_at = existingRow!.created_at;
      }
      memoryRecords.set(row.id, row);
      return { record: rowToRecord(row), created };
    }

    const existingRow = existing
      ? ({ id: existing.id, created_at: existing.createdAt, status: domainStatusToDb(existing.status) } as Pick<DbRow, "id" | "created_at" | "status">)
      : undefined;
    const row = inputToRow(input, existingRow as DbRow | undefined);
    if (existing) {
      row.status = domainStatusToDb(existing.status);
      row.created_at = existing.createdAt;
    }

    await ensureStoreExists(input.storeId);
    const data = await upsertRecommendationRow(supabase, row);
    return { record: rowToRecord(data), created: !existing };
  }

  async upsertBatch(
    inputs: CreateRecommendationInput[],
  ): Promise<{ record: RecommendationRecord; created: boolean }[]> {
    const results: { record: RecommendationRecord; created: boolean }[] = [];
    for (const input of inputs) {
      results.push(await this.upsert(input));
    }
    return results;
  }

  async updateStatus(
    id: string,
    status: RecommendationDomainStatus,
  ): Promise<RecommendationRecord> {
    return this.updateRawStatus(id, domainStatusToDb(status));
  }

  async updateRawStatus(
    id: string,
    dbStatus: string,
    extra?: Record<string, unknown>,
  ): Promise<RecommendationRecord> {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    if (!supabase) {
      const row = memoryRecords.get(id);
      if (!row) throw new Error("Recommendation not found");
      row.status = dbStatus;
      row.updated_at = now;
      if (extra) Object.assign(row, extra);
      memoryRecords.set(id, row);
      return rowToRecord(row);
    }

    let { error } = await supabase
      .from("recommendations")
      .update({ status: dbStatus, updated_at: now, ...extra })
      .eq("id", id);

    if (error && isInvalidEnumError(error.message)) {
      ({ error } = await supabase
        .from("recommendations")
        .update({
          status: domainStatusToLegacyDb(dbStatus),
          updated_at: now,
          ...extra,
        })
        .eq("id", id));
    }

    if (error) throw new Error(error.message);

    const record = await this.findById(id);
    if (!record) throw new Error("Recommendation not found after update");
    return record;
  }

  async appendEvent(params: {
    recommendationId: string;
    eventType: RecommendationEventType;
    payloadJson?: Record<string, unknown>;
    userId?: string;
  }): Promise<RecommendationEvent> {
    const supabase = getSupabaseAdmin();
    const row: DbEventRow = {
      id: crypto.randomUUID(),
      recommendation_id: params.recommendationId,
      event_type: params.eventType,
      payload_json: params.payloadJson ?? {},
      created_at: new Date().toISOString(),
      user_id: params.userId ?? null,
    };

    if (!supabase) {
      memoryEvents.push(row);
      return eventRowToEvent(row);
    }

    const { data, error } = await supabase
      .from("recommendation_events")
      .insert({
        recommendation_id: params.recommendationId,
        event_type: params.eventType,
        payload_json: params.payloadJson ?? {},
        user_id: params.userId ?? null,
      })
      .select("*")
      .single();

    if (error) {
      if (/recommendation_events/i.test(error.message) && /does not exist|schema cache/i.test(error.message)) {
        console.warn(
          "[StorePilot] recommendation_events table missing — run 20260710120000_pilot_recommendations_catchup.sql",
        );
        return eventRowToEvent(row);
      }
      throw new Error(`Failed to append event: ${error.message}`);
    }
    return eventRowToEvent(data as DbEventRow);
  }

  async listEvents(recommendationId: string): Promise<RecommendationEvent[]> {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return memoryEvents
        .filter((e) => e.recommendation_id === recommendationId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map(eventRowToEvent);
    }

    const { data, error } = await supabase
      .from("recommendation_events")
      .select("*")
      .eq("recommendation_id", recommendationId)
      .order("created_at", { ascending: true });

    if (error) {
      if (isMissingTableError(error.message)) {
        console.warn(
          "[StorePilot] recommendation_events table missing — run 20260710120000_pilot_recommendations_catchup.sql",
        );
        return memoryEvents
          .filter((e) => e.recommendation_id === recommendationId)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map(eventRowToEvent);
      }
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => eventRowToEvent(row as DbEventRow));
  }

  async listOpenByStore(storeId: string): Promise<RecommendationRecord[]> {
    const all = await this.findByStoreId(storeId);
    return all.filter((r) => r.status === "pending" || r.status === "approved");
  }
}

export const recommendationRepository = new RecommendationRepository();
