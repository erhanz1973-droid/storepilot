/**
 * StorePilot Execution Framework
 *
 * Provider-independent lifecycle:
 * Detect → Recommend → Approve → Validate → Build Request → Dry Run / Live →
 * Provider Response → Update Local State → Audit Log → Track Outcome
 *
 * @see pipeline.ts — orchestration
 * @see provider.ts — adapter interface
 * @see registry.ts — handler registration
 * @see providers/ — Meta, Google Ads, Shopify adapters
 */

export { getExecutionMode, isLiveExecutionEnabled } from "./config";
export type { ExecutionMode } from "./config";
export type {
  ActionExecutionContext,
  ActionExecutionLog,
  ActionExecutionOutcome,
  ExecutionAvailability,
  ExecutionEntityType,
  ExecutionLogStatus,
  ExecutionPlatform,
} from "./types";
export type {
  ExecutionActionHandler,
  ExecutionProvider,
  ProviderRequest,
  ProviderResponse,
  ValidationResult,
} from "./provider";
export {
  auditDryRun,
  auditFailure,
  auditSuccess,
  auditValidationFailure,
  dryRunMessage,
} from "./audit";
export {
  clearHandlersForTests,
  listRegisteredHandlers,
  registerHandler,
  registerProvider,
  resolveHandler,
} from "./registry";
export { executeApprovedAction, runExecutionPipeline } from "./pipeline";
export {
  bootstrapExecutionProviders,
  resetExecutionProvidersForTests,
} from "./providers";
