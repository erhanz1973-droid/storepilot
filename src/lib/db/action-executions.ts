import type { ExecutionMode } from "@/lib/execution/config";
import type { ExecutionLogStatus } from "@/lib/execution/types";
import { DEMO_STORE_ID } from "@/lib/types";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { assertNotSimulationStore } from "@/lib/simulation-stores/safety";

export type ActionExecutionRow = {
  id: string;
  store_id: string;
  decision_id: string | null;
  recommendation_id: string | null;
  opportunity_key: string | null;
  action_type: string;
  platform: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  execution_mode: ExecutionMode;
  status: ExecutionLogStatus;
  approved_by: string;
  request_payload: Record<string, unknown>;
  response_payload: Record<string, unknown> | null;
  error_message: string | null;
  executed_at: string;
  duration_ms?: number | null;
};

const memoryLogs: ActionExecutionRow[] = [];

function rowToLog(row: ActionExecutionRow): import("@/lib/execution/types").ActionExecutionLog {
  const durationFromPayload =
    typeof row.response_payload?.durationMs === "number"
      ? row.response_payload.durationMs
      : undefined;

  return {
    id: row.id,
    storeId: row.store_id,
    decisionId: row.decision_id,
    recommendationId: row.recommendation_id,
    opportunityKey: row.opportunity_key,
    actionType: row.action_type,
    platform: row.platform,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityName: row.entity_name,
    executionMode: row.execution_mode,
    status: row.status,
    approvedBy: row.approved_by,
    requestPayload: row.request_payload,
    responsePayload: row.response_payload,
    errorMessage: row.error_message,
    executedAt: row.executed_at,
    durationMs: row.duration_ms ?? durationFromPayload,
  };
}

export async function insertActionExecution(input: {
  storeId: string;
  decisionId?: string;
  recommendationId?: string;
  opportunityKey?: string;
  actionType: string;
  platform: string;
  entityType: string;
  entityId: string;
  entityName: string;
  executionMode: ExecutionMode;
  status: ExecutionLogStatus;
  approvedBy?: string;
  requestPayload: Record<string, unknown>;
  responsePayload?: Record<string, unknown> | null;
  errorMessage?: string | null;
  durationMs?: number;
}): Promise<import("@/lib/execution/types").ActionExecutionLog> {
  await assertNotSimulationStore(input.storeId, "action execution");
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const row: ActionExecutionRow = {
      id: crypto.randomUUID(),
      store_id: input.storeId,
      decision_id: input.decisionId ?? null,
      recommendation_id: input.recommendationId ?? null,
      opportunity_key: input.opportunityKey ?? null,
      action_type: input.actionType,
      platform: input.platform,
      entity_type: input.entityType,
      entity_id: input.entityId,
      entity_name: input.entityName,
      execution_mode: input.executionMode,
      status: input.status,
      approved_by: input.approvedBy ?? "Merchant",
      request_payload: input.requestPayload,
      response_payload: input.responsePayload ?? null,
      error_message: input.errorMessage ?? null,
      executed_at: now,
      duration_ms: input.durationMs ?? null,
    };
    memoryLogs.unshift(row);
    return rowToLog(row);
  }

  const { data, error } = await supabase
    .from("action_executions")
    .insert({
      store_id: input.storeId,
      decision_id: input.decisionId ?? null,
      recommendation_id: input.recommendationId ?? null,
      opportunity_key: input.opportunityKey ?? null,
      action_type: input.actionType,
      platform: input.platform,
      entity_type: input.entityType,
      entity_id: input.entityId,
      entity_name: input.entityName,
      execution_mode: input.executionMode,
      status: input.status,
      approved_by: input.approvedBy ?? "Merchant",
      request_payload: input.requestPayload,
      response_payload: input.responsePayload ?? null,
      error_message: input.errorMessage ?? null,
      executed_at: now,
      duration_ms: input.durationMs ?? null,
    } as Record<string, unknown>)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToLog(data as ActionExecutionRow);
}

export async function listActionExecutions(
  storeId: string = DEMO_STORE_ID,
  limit = 50,
): Promise<import("@/lib/execution/types").ActionExecutionLog[]> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return memoryLogs
      .filter((r) => r.store_id === storeId)
      .slice(0, limit)
      .map(rowToLog);
  }

  const { data, error } = await supabase
    .from("action_executions")
    .select("*")
    .eq("store_id", storeId)
    .order("executed_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data as ActionExecutionRow[]).map(rowToLog);
}
