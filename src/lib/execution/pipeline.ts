import { bootstrapExecutionProviders } from "@/lib/execution/providers";
import { resolveHandler } from "@/lib/execution/registry";
import { getExecutionMode, isLiveExecutionEnabled } from "@/lib/execution/config";
import {
  auditDryRun,
  auditFailure,
  auditSuccess,
  auditValidationFailure,
  dryRunMessage,
} from "@/lib/execution/audit";
import type { ExecutionActionHandler } from "@/lib/execution/provider";
import type { ActionExecutionContext, ActionExecutionOutcome } from "@/lib/execution/types";

function withEntityName(
  ctx: ActionExecutionContext,
  entityName?: string,
): ActionExecutionContext {
  if (!entityName || entityName === ctx.entityName) return ctx;
  return { ...ctx, entityName };
}

/**
 * Provider-independent execution lifecycle:
 * validate → build request → dry run or live execute → sync local state → audit log
 */
export async function runExecutionPipeline(
  ctx: ActionExecutionContext,
  handler: ExecutionActionHandler,
): Promise<ActionExecutionOutcome> {
  const startedAt = Date.now();

  if (handler.executeLegacy) {
    const outcome = await handler.executeLegacy(ctx);
    return { ...outcome, durationMs: outcome.durationMs ?? Date.now() - startedAt };
  }

  if (!handler.validate || !handler.buildRequest || !handler.executeLive) {
    return auditValidationFailure(
      ctx,
      [`Handler "${handler.id}" is not fully implemented.`],
      Date.now() - startedAt,
    );
  }

  const validation = await handler.validate(ctx);
  const resolvedCtx = withEntityName(ctx, validation.entityName);

  if (!validation.valid) {
    return auditValidationFailure(
      resolvedCtx,
      validation.errors,
      Date.now() - startedAt,
    );
  }

  const request = await handler.buildRequest(resolvedCtx, validation);
  const requestRecord = request.payload;

  if (!isLiveExecutionEnabled()) {
    return auditDryRun(
      resolvedCtx,
      requestRecord,
      dryRunMessage(handler.platform.replace(/_/g, " "), request.label ?? handler.label),
      Date.now() - startedAt,
    );
  }

  try {
    const response = await handler.executeLive(resolvedCtx, request, validation);

    if (handler.afterSuccess) {
      try {
        await handler.afterSuccess(resolvedCtx, validation);
      } catch {
        // Non-fatal — provider mutation succeeded
      }
    }

    return auditSuccess(
      resolvedCtx,
      requestRecord,
      response.payload,
      `${handler.label} completed successfully.`,
      Date.now() - startedAt,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : `${handler.label} failed`;
    return auditFailure(resolvedCtx, requestRecord, message, Date.now() - startedAt);
  }
}

export async function executeApprovedAction(
  ctx: ActionExecutionContext,
): Promise<ActionExecutionOutcome | null> {
  await bootstrapExecutionProviders();
  const handler = resolveHandler(ctx);
  if (!handler) return null;
  return runExecutionPipeline(ctx, handler);
}
