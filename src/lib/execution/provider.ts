import type { FutureActionType } from "@/lib/insights/actions";
import type {
  ActionExecutionContext,
  ActionExecutionOutcome,
  ExecutionEntityType,
  ExecutionPlatform,
} from "./types";

/** Result of the validation layer — connection, scopes, target existence, action allowance. */
export type ValidationResult = {
  valid: boolean;
  errors: string[];
  entityName?: string;
  /** Opaque provider context passed validate → build → execute → afterSuccess */
  context?: Record<string, unknown>;
};

/** Exact provider API request stored in the audit log. */
export type ProviderRequest = {
  payload: Record<string, unknown>;
  label?: string;
};

export type ProviderResponse = {
  payload: Record<string, unknown>;
};

/**
 * One executable action on a provider (e.g. Meta pause_campaign, Shopify create_discount).
 * Implement validate → buildRequest → executeLive for full pipeline integration,
 * or supply executeLegacy while migrating existing handlers.
 */
export interface ExecutionActionHandler {
  readonly id: string;
  readonly platform: ExecutionPlatform;
  readonly actionType: FutureActionType;
  readonly entityTypes?: ExecutionEntityType[];
  readonly label: string;
  validate?(ctx: ActionExecutionContext): Promise<ValidationResult>;
  buildRequest?(
    ctx: ActionExecutionContext,
    validation: ValidationResult,
  ): Promise<ProviderRequest>;
  executeLive?(
    ctx: ActionExecutionContext,
    request: ProviderRequest,
    validation: ValidationResult,
  ): Promise<ProviderResponse>;
  afterSuccess?(ctx: ActionExecutionContext, validation: ValidationResult): Promise<void>;
  /** Bypasses the generic pipeline — used while migrating Shopify handlers. */
  executeLegacy?(ctx: ActionExecutionContext): Promise<ActionExecutionOutcome>;
}

export interface ExecutionProvider {
  readonly platform: ExecutionPlatform;
  readonly label: string;
  readonly handlers: ExecutionActionHandler[];
}
