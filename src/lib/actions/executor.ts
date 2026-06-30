import { executeApprovedAction } from "@/lib/execution/pipeline";
import { getActionCapability, type FutureActionType } from "@/lib/insights/actions";
import type { ExecutionEntityType, ExecutionPlatform } from "@/lib/execution/types";

export type ActionExecutionRequest = {
  actionType: FutureActionType;
  entityType: ExecutionEntityType;
  entityId: string;
  entityName: string;
  storeId: string;
  recommendationId?: string;
  params?: Record<string, string | number>;
  platform?: ExecutionPlatform;
};

export type ActionExecutionResult = {
  success: boolean;
  actionType: FutureActionType;
  message: string;
  requiresApproval: boolean;
  executed: boolean;
  auditId?: string;
};

export type ActionExecutor = {
  canExecute(actionType: FutureActionType): boolean;
  execute(request: ActionExecutionRequest): Promise<ActionExecutionResult>;
};

function defaultPlatform(actionType: FutureActionType): ExecutionPlatform {
  const cap = getActionCapability(actionType);
  if (cap?.platforms.includes("shopify")) return "shopify";
  if (cap?.platforms.includes("meta_ads")) return "meta_ads";
  if (cap?.platforms.includes("google_ads")) return "google_ads";
  return "shopify";
}

/** Routes approved actions through the unified execution pipeline. */
export class PipelineActionExecutor implements ActionExecutor {
  canExecute(actionType: FutureActionType): boolean {
    const cap = getActionCapability(actionType);
    return cap?.available === true;
  }

  async execute(request: ActionExecutionRequest): Promise<ActionExecutionResult> {
    const cap = getActionCapability(request.actionType);
    if (!cap) {
      return {
        success: false,
        actionType: request.actionType,
        message: `Unknown action type: ${request.actionType}`,
        requiresApproval: true,
        executed: false,
      };
    }

    if (!cap.available) {
      return {
        success: false,
        actionType: request.actionType,
        message: `${cap.label} is not yet enabled.`,
        requiresApproval: true,
        executed: false,
      };
    }

    const outcome = await executeApprovedAction({
      storeId: request.storeId,
      actionType: request.actionType,
      platform: request.platform ?? defaultPlatform(request.actionType),
      entityType: request.entityType,
      entityId: request.entityId,
      entityName: request.entityName,
      recommendationId: request.recommendationId,
    });

    if (!outcome) {
      return {
        success: false,
        actionType: request.actionType,
        message: `No execution handler registered for ${request.actionType}.`,
        requiresApproval: true,
        executed: false,
      };
    }

    return {
      success: outcome.success,
      actionType: request.actionType,
      message: outcome.message,
      requiresApproval: false,
      executed: outcome.executed,
      auditId: outcome.logId,
    };
  }
}

export const defaultExecutor = new PipelineActionExecutor();

export async function requestActionExecution(
  request: ActionExecutionRequest,
  executor: ActionExecutor = defaultExecutor,
): Promise<ActionExecutionResult> {
  return executor.execute(request);
}
