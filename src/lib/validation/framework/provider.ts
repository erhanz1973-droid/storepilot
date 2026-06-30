import type {
  ProviderValidationResult,
  RunValidationOptions,
  ValidationExportReport,
  ValidationHistoryEntry,
  ValidationProviderId,
} from "./types";

/** Contract every integration validation adapter must implement. */
export interface ValidationProviderAdapter {
  readonly id: ValidationProviderId;
  readonly label: string;

  runValidation(
    storeId: string,
    options?: RunValidationOptions,
  ): Promise<ProviderValidationResult | { enabled: false }>;

  getHistory(storeId: string): ValidationHistoryEntry[];

  exportReport(
    storeId: string,
    result?: ProviderValidationResult,
  ): Promise<ValidationExportReport | null>;

  clearCache?(storeId: string): Promise<void>;
}
