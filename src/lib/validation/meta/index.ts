/** Meta Ads integration validation (enterprise framework adapter). */
export { isDevValidationEnabled } from "../dev-gate";
export {
  buildMetaValidationPanel,
  clearMetaValidationCache,
  metaValidationProvider,
} from "../providers/meta/adapter";
export type { ProviderValidationResult } from "../framework/types";
