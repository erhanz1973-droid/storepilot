import { isDevValidationEnabled } from "@/lib/validation/dev-gate";
import { getValidationHistory } from "./history";
import { listValidationProviders } from "./registry";
import type { ValidationEvidenceBundle, ValidationEvidenceItem, ValidationProviderId } from "./types";

const EVIDENCE_PROVIDER_LABELS: Record<ValidationProviderId, string> = {
  meta: "Meta Validation Passed",
  google: "Google Ads Validation Passed",
  shopify: "Shopify Validation Passed",
  ga4: "GA4 Validation Passed",
  ai: "AI Engine Validation Passed",
};

function latestMatchPercent(provider: ValidationProviderId, storeId: string): number | null {
  const history = getValidationHistory(provider, storeId);
  return history[0]?.matchScore ?? null;
}

/**
 * Evidence bundle for AI Recommendation Engine — only populated when validation has run.
 * Does not trigger validation itself (no production perf impact).
 */
export function getValidationEvidence(
  storeId: string,
  options?: { cacheFresh?: boolean },
): ValidationEvidenceBundle {
  if (!isDevValidationEnabled() && process.env.STOREPILOT_VALIDATION_MODE !== "1") {
    return {
      providers: [],
      items: [],
      overallMatchPercent: null,
      cacheFresh: options?.cacheFresh ?? false,
      apiVerified: false,
      allPassed: false,
    };
  }

  const providers = listValidationProviders().map((p) => p.id);
  const items: ValidationEvidenceItem[] = [];
  const matchScores: number[] = [];

  for (const provider of providers) {
    const score = latestMatchPercent(provider, storeId);
    const passed = score !== null && score >= 99;
    items.push({
      id: `${provider}_validation`,
      label: EVIDENCE_PROVIDER_LABELS[provider],
      passed,
    });
    if (score !== null) matchScores.push(score);
  }

  const cacheFresh = options?.cacheFresh ?? false;
  if (cacheFresh) {
    items.push({ id: "cache_fresh", label: "Cache Fresh", passed: true });
  } else {
    items.push({ id: "cache_fresh", label: "Cache Fresh", passed: false });
  }

  const apiVerified = items.some((i) => i.id.endsWith("_validation") && i.passed);
  const dashboardMatch =
    matchScores.length > 0
      ? Math.round((matchScores.reduce((a, b) => a + b, 0) / matchScores.length) * 10) / 10
      : null;

  if (dashboardMatch !== null) {
    items.push({
      id: "dashboard_match",
      label: `Dashboard Match ${dashboardMatch}%`,
      passed: dashboardMatch >= 99,
    });
  }

  items.push({
    id: "api_verified",
    label: "API Verified",
    passed: apiVerified,
  });

  return {
    providers,
    items,
    overallMatchPercent: dashboardMatch,
    cacheFresh,
    apiVerified,
    allPassed: items.every((i) => i.passed),
  };
}
