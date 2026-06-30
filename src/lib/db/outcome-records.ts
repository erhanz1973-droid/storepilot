import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { MeasurementKpis } from "@/lib/types";
import type { KpiDelta } from "@/lib/learning/metrics";
import type {
  OutcomeMeasureStatus,
  OutcomeRating,
  OutcomeRecord,
} from "@/lib/learning/outcome-types";

type OutcomeRow = {
  id: string;
  store_id: string;
  recommendation_id: string | null;
  action_execution_id: string | null;
  opportunity_key: string | null;
  decision_id: string | null;
  title: string;
  category: string;
  action_type: string | null;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  baseline_captured_at: string;
  measure_due_at: string;
  measured_at: string | null;
  measurement_window_days: number;
  measure_status: OutcomeMeasureStatus;
  expected_monthly_impact: number;
  actual_monthly_impact: number | null;
  prediction_accuracy: number | null;
  outcome_rating: OutcomeRating | null;
  confidence_label: string | null;
  baseline_metrics: MeasurementKpis;
  outcome_metrics: MeasurementKpis | null;
  kpi_deltas: KpiDelta[] | null;
  outcome_summary: string | null;
  ai_verdict: string | null;
  score_breakdown: Record<string, unknown>;
  failure_reason: string | null;
};

const memoryRecords = new Map<string, OutcomeRow>();

function rowToRecord(row: OutcomeRow): OutcomeRecord {
  return {
    id: row.id,
    storeId: row.store_id,
    recommendationId: row.recommendation_id,
    actionExecutionId: row.action_execution_id,
    opportunityKey: row.opportunity_key,
    decisionId: row.decision_id,
    title: row.title,
    category: row.category,
    actionType: row.action_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityName: row.entity_name,
    baselineCapturedAt: row.baseline_captured_at,
    measureDueAt: row.measure_due_at,
    measuredAt: row.measured_at,
    measurementWindowDays: row.measurement_window_days,
    measureStatus: row.measure_status,
    expectedMonthlyImpact: Number(row.expected_monthly_impact),
    actualMonthlyImpact:
      row.actual_monthly_impact != null ? Number(row.actual_monthly_impact) : null,
    predictionAccuracy:
      row.prediction_accuracy != null ? Number(row.prediction_accuracy) : null,
    outcomeRating: row.outcome_rating,
    confidenceLabel: row.confidence_label,
    baselineMetrics: row.baseline_metrics ?? {},
    outcomeMetrics: row.outcome_metrics,
    kpiDeltas: row.kpi_deltas,
    outcomeSummary: row.outcome_summary,
    aiVerdict: row.ai_verdict,
    scoreBreakdown: row.score_breakdown ?? {},
    failureReason: row.failure_reason,
  };
}

export async function insertOutcomeRecord(input: {
  storeId: string;
  recommendationId?: string;
  actionExecutionId?: string;
  opportunityKey?: string;
  decisionId?: string;
  title: string;
  category: string;
  actionType?: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  baselineCapturedAt: string;
  measureDueAt: string;
  measurementWindowDays: number;
  expectedMonthlyImpact: number;
  baselineMetrics: MeasurementKpis;
}): Promise<OutcomeRecord> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const row: OutcomeRow = {
    id,
    store_id: input.storeId,
    recommendation_id: input.recommendationId ?? null,
    action_execution_id: input.actionExecutionId ?? null,
    opportunity_key: input.opportunityKey ?? null,
    decision_id: input.decisionId ?? null,
    title: input.title,
    category: input.category,
    action_type: input.actionType ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    entity_name: input.entityName ?? null,
    baseline_captured_at: input.baselineCapturedAt,
    measure_due_at: input.measureDueAt,
    measured_at: null,
    measurement_window_days: input.measurementWindowDays,
    measure_status: "scheduled",
    expected_monthly_impact: input.expectedMonthlyImpact,
    actual_monthly_impact: null,
    prediction_accuracy: null,
    outcome_rating: null,
    confidence_label: null,
    baseline_metrics: input.baselineMetrics,
    outcome_metrics: null,
    kpi_deltas: null,
    outcome_summary: null,
    ai_verdict: null,
    score_breakdown: {},
    failure_reason: null,
  };

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    memoryRecords.set(id, row);
    return rowToRecord(row);
  }

  const { data, error } = await supabase
    .from("outcome_records")
    .insert({
      id,
      store_id: input.storeId,
      recommendation_id: input.recommendationId ?? null,
      action_execution_id: input.actionExecutionId ?? null,
      opportunity_key: input.opportunityKey ?? null,
      decision_id: input.decisionId ?? null,
      title: input.title,
      category: input.category,
      action_type: input.actionType ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      entity_name: input.entityName ?? null,
      baseline_captured_at: input.baselineCapturedAt,
      measure_due_at: input.measureDueAt,
      measurement_window_days: input.measurementWindowDays,
      expected_monthly_impact: input.expectedMonthlyImpact,
      baseline_metrics: input.baselineMetrics,
      created_at: now,
      updated_at: now,
    } as Record<string, unknown>)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToRecord(data as unknown as OutcomeRow);
}

export async function updateOutcomeRecord(
  id: string,
  update: Partial<{
    measureStatus: OutcomeMeasureStatus;
    measuredAt: string;
    actualMonthlyImpact: number;
    predictionAccuracy: number;
    outcomeRating: OutcomeRating;
    confidenceLabel: string;
    outcomeMetrics: MeasurementKpis;
    kpiDeltas: KpiDelta[];
    outcomeSummary: string;
    aiVerdict: string;
    scoreBreakdown: Record<string, unknown>;
    failureReason: string;
  }>,
): Promise<OutcomeRecord | null> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  if (!supabase) {
    const row = memoryRecords.get(id);
    if (!row) return null;
    const next: OutcomeRow = {
      ...row,
      measure_status: update.measureStatus ?? row.measure_status,
      measured_at: update.measuredAt ?? row.measured_at,
      actual_monthly_impact: update.actualMonthlyImpact ?? row.actual_monthly_impact,
      prediction_accuracy: update.predictionAccuracy ?? row.prediction_accuracy,
      outcome_rating: update.outcomeRating ?? row.outcome_rating,
      confidence_label: update.confidenceLabel ?? row.confidence_label,
      outcome_metrics: update.outcomeMetrics ?? row.outcome_metrics,
      kpi_deltas: update.kpiDeltas ?? row.kpi_deltas,
      outcome_summary: update.outcomeSummary ?? row.outcome_summary,
      ai_verdict: update.aiVerdict ?? row.ai_verdict,
      score_breakdown: update.scoreBreakdown ?? row.score_breakdown,
      failure_reason: update.failureReason ?? row.failure_reason,
    };
    memoryRecords.set(id, next);
    return rowToRecord(next);
  }

  const payload: Record<string, unknown> = { updated_at: now };
  if (update.measureStatus) payload.measure_status = update.measureStatus;
  if (update.measuredAt) payload.measured_at = update.measuredAt;
  if (update.actualMonthlyImpact != null) payload.actual_monthly_impact = update.actualMonthlyImpact;
  if (update.predictionAccuracy != null) payload.prediction_accuracy = update.predictionAccuracy;
  if (update.outcomeRating) payload.outcome_rating = update.outcomeRating;
  if (update.confidenceLabel) payload.confidence_label = update.confidenceLabel;
  if (update.outcomeMetrics) payload.outcome_metrics = update.outcomeMetrics;
  if (update.kpiDeltas) payload.kpi_deltas = update.kpiDeltas;
  if (update.outcomeSummary) payload.outcome_summary = update.outcomeSummary;
  if (update.aiVerdict) payload.ai_verdict = update.aiVerdict;
  if (update.scoreBreakdown) payload.score_breakdown = update.scoreBreakdown;
  if (update.failureReason) payload.failure_reason = update.failureReason;

  const { data, error } = await supabase
    .from("outcome_records")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToRecord(data as unknown as OutcomeRow);
}

export async function listOutcomeRecords(
  storeId: string,
  limit = 50,
): Promise<OutcomeRecord[]> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return [...memoryRecords.values()]
      .filter((r) => r.store_id === storeId)
      .sort(
        (a, b) =>
          new Date(b.baseline_captured_at).getTime() -
          new Date(a.baseline_captured_at).getTime(),
      )
      .slice(0, limit)
      .map(rowToRecord);
  }

  const { data, error } = await supabase
    .from("outcome_records")
    .select("*")
    .eq("store_id", storeId)
    .order("baseline_captured_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToRecord(row as unknown as OutcomeRow));
}

export async function listScheduledOutcomeRecords(storeId: string): Promise<OutcomeRecord[]> {
  const all = await listOutcomeRecords(storeId, 200);
  return all.filter((r) => r.measureStatus === "scheduled");
}

export async function findOutcomeByOpportunityKey(
  storeId: string,
  opportunityKey: string,
): Promise<OutcomeRecord | null> {
  const all = await listOutcomeRecords(storeId, 200);
  return all.find((r) => r.opportunityKey === opportunityKey) ?? null;
}

export async function findOutcomeByDecisionId(
  storeId: string,
  decisionId: string,
): Promise<OutcomeRecord | null> {
  const all = await listOutcomeRecords(storeId, 200);
  return all.find((r) => r.decisionId === decisionId) ?? null;
}
