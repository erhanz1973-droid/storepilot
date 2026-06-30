import { insertActionExecution } from "@/lib/db/action-executions";
import { getExecutionMode } from "@/lib/execution/config";
import type {
  ActionExecutionContext,
  ActionExecutionOutcome,
  ExecutionLogStatus,
} from "@/lib/execution/types";

type AuditInput = {
  ctx: ActionExecutionContext;
  status: ExecutionLogStatus;
  requestPayload: Record<string, unknown>;
  responsePayload?: Record<string, unknown> | null;
  errorMessage?: string | null;
  durationMs?: number;
};

function enrichResponse(
  response: Record<string, unknown> | null | undefined,
  durationMs?: number,
): Record<string, unknown> | null {
  if (durationMs == null) return response ?? null;
  return { ...(response ?? {}), durationMs };
}

async function writeAudit(input: AuditInput): Promise<string> {
  const mode = getExecutionMode();
  const log = await insertActionExecution({
    storeId: input.ctx.storeId,
    decisionId: input.ctx.decisionId,
    recommendationId: input.ctx.recommendationId,
    opportunityKey: input.ctx.opportunityKey,
    actionType: input.ctx.actionType,
    platform: input.ctx.platform,
    entityType: input.ctx.entityType,
    entityId: input.ctx.entityId,
    entityName: input.ctx.entityName,
    executionMode: mode,
    status: input.status,
    approvedBy: input.ctx.approvedBy,
    requestPayload: input.requestPayload,
    responsePayload: enrichResponse(input.responsePayload, input.durationMs),
    errorMessage: input.errorMessage ?? null,
    durationMs: input.durationMs,
  });
  return log.id;
}

export async function auditValidationFailure(
  ctx: ActionExecutionContext,
  errors: string[],
  durationMs?: number,
): Promise<ActionExecutionOutcome> {
  const mode = getExecutionMode();
  const logId = await writeAudit({
    ctx,
    status: "failed",
    requestPayload: { validationErrors: errors },
    errorMessage: errors.join(" "),
    durationMs,
  });

  return {
    success: false,
    mode,
    status: "failed",
    message: errors.join(" "),
    executed: false,
    logId,
    validationErrors: errors,
    durationMs,
  };
}

export async function auditDryRun(
  ctx: ActionExecutionContext,
  request: Record<string, unknown>,
  message: string,
  durationMs?: number,
): Promise<ActionExecutionOutcome> {
  const mode = getExecutionMode();
  const logId = await writeAudit({
    ctx,
    status: "ready",
    requestPayload: request,
    responsePayload: {
      dryRun: true,
      message: "This action is ready to be executed.",
    },
    durationMs,
  });

  return {
    success: true,
    mode,
    status: "ready",
    message,
    executed: false,
    logId,
    request,
    durationMs,
  };
}

export async function auditSuccess(
  ctx: ActionExecutionContext,
  request: Record<string, unknown>,
  response: Record<string, unknown>,
  message: string,
  durationMs?: number,
): Promise<ActionExecutionOutcome> {
  const mode = getExecutionMode();
  const logId = await writeAudit({
    ctx,
    status: "success",
    requestPayload: request,
    responsePayload: response,
    durationMs,
  });

  return {
    success: true,
    mode,
    status: "success",
    message,
    executed: true,
    logId,
    request,
    providerResponse: response,
    durationMs,
  };
}

export async function auditFailure(
  ctx: ActionExecutionContext,
  request: Record<string, unknown> | { validationErrors: string[] },
  message: string,
  durationMs?: number,
): Promise<ActionExecutionOutcome> {
  const mode = getExecutionMode();
  const logId = await writeAudit({
    ctx,
    status: "failed",
    requestPayload: request as Record<string, unknown>,
    errorMessage: message,
    durationMs,
  });

  return {
    success: false,
    mode,
    status: "failed",
    message,
    executed: false,
    logId,
    validationErrors:
      "validationErrors" in request && Array.isArray(request.validationErrors)
        ? request.validationErrors
        : undefined,
    durationMs,
  };
}

export function dryRunMessage(providerLabel: string, actionLabel: string): string {
  return `This action is ready to be executed. Dry Run mode is on — the exact ${providerLabel} API request for "${actionLabel}" was validated and logged, but not sent.`;
}
