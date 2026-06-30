import { isDevValidationEnabled } from "@/lib/validation/dev-gate";
import type { ValidationProviderAdapter } from "@/lib/validation/framework/provider";
import { EMPTY_SNAPSHOT } from "@/lib/validation/framework/compare";
import { buildExportReport } from "@/lib/validation/framework/export";
import { getValidationHistory } from "@/lib/validation/framework/history";
import type {
  ProviderValidationResult,
  RunValidationOptions,
  ValidationExportReport,
  ValidationProviderId,
} from "@/lib/validation/framework/types";

/** Placeholder adapter for providers not yet fully implemented. */
export function createStubValidationProvider(
  id: ValidationProviderId,
  label: string,
): ValidationProviderAdapter {
  return {
    id,
    label,

    async runValidation(
      storeId: string,
      _options?: RunValidationOptions,
    ): Promise<ProviderValidationResult | { enabled: false }> {
      if (!isDevValidationEnabled()) return { enabled: false };

      return {
        enabled: true,
        provider: id,
        providerLabel: label,
        storeId,
        connection: {
          businessName: null,
          businessId: null,
          accountName: null,
          accountId: null,
          connectionStatus: "not_implemented",
          tokenExpiresAt: null,
          lastSyncAt: null,
          apiVersion: null,
          timezone: null,
          scopes: [],
        },
        dashboardSnapshot: { ...EMPTY_SNAPSHOT },
        apiSnapshot: { ...EMPTY_SNAPSHOT },
        comparisons: [],
        matchScore: {
          percent: 0,
          status: "red",
          emoji: "🔴",
          label: "Not implemented",
          passedMetrics: 0,
          totalMetrics: 0,
        },
        healthChecks: [
          {
            id: "stub",
            label: `${label} validation adapter pending`,
            passed: false,
            detail: "Provider adapter not yet implemented",
          },
        ],
        syncLogs: [],
        apiLogs: [],
        cache: {
          cacheKey: `${id}_sync:${storeId}`,
          createdAt: null,
          expiresAt: null,
          lastHitAt: null,
          lastMissAt: null,
          hitCount: 0,
          missCount: 0,
        },
        history: getValidationHistory(id, storeId),
        trendScores: [],
        durationMs: 0,
        lastValidatedAt: null,
      };
    },

    getHistory(storeId: string) {
      return getValidationHistory(id, storeId);
    },

    async exportReport(storeId, result) {
      const data = result ?? (await this.runValidation(storeId));
      if (!data.enabled) return null;
      return buildExportReport(data);
    },
  };
}
