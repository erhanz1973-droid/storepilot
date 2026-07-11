import { describe, expect, it } from "vitest";
import { buildAiTrustSummary, buildSystemSummary } from "../trust-summary";
import type { ProviderHealthDetail } from "../types";

function dim(
  label: string,
  status: "good" | "warning" | "bad",
  detail = "",
  scorePct?: number,
) {
  return { label, detail: detail || label, status, scorePct };
}

const providers: ProviderHealthDetail[] = [
  {
    id: "shopify",
    label: "Shopify",
    connectionStatus: "connected",
    authentication: dim("Authorized", "good"),
    dataAvailability: dim("Partial data", "warning", "Customers missing", 72),
    aiReadiness: dim("Limited confidence", "warning", "", 68),
    tokenValid: true,
    lastSuccessfulSync: new Date().toISOString(),
    apiLatencyMs: null,
    rateLimitStatus: "ok",
    lastApiError: null,
    recordsSynced: 10,
    missingFields: ["Customers"],
    dataFreshness: "fresh",
    dataQualityPct: 90,
    aiReadyPct: 68,
    aiReady: false,
    entityChecks: [{ label: "Customers", value: "0", status: "missing" }],
  },
  {
    id: "google_ads",
    label: "Google Ads",
    connectionStatus: "disconnected",
    authentication: dim("Not authorized", "bad"),
    dataAvailability: dim("No data", "bad", "", 0),
    aiReadiness: dim("Not ready", "bad", "", 0),
    tokenValid: false,
    lastSuccessfulSync: null,
    apiLatencyMs: null,
    rateLimitStatus: "unknown",
    lastApiError: null,
    recordsSynced: null,
    missingFields: [],
    dataFreshness: "unknown",
    dataQualityPct: null,
    aiReadyPct: 0,
    aiReady: false,
    entityChecks: [],
  },
];

describe("buildAiTrustSummary", () => {
  it("includes dimension-prefixed confidence reductions", () => {
    const trust = buildAiTrustSummary({
      overallAiReadinessPct: 66,
      dataQualityPct: 82,
      gate: {
        canGenerateRecommendations: true,
        evaluatedAt: new Date().toISOString(),
        storeId: "s1",
        providers: [],
        overallMatchPercent: 80,
        trustedProviderIds: [],
        blockedProviderIds: [],
        warnedProviderIds: [],
      },
      providers,
      missingBlocks: [],
      qualityIssues: [],
      capabilityMatrix: [
        { feature: "A", status: "ready", reason: "" },
        { feature: "B", status: "waiting", reason: "" },
      ],
    });
    expect(trust.aiTrustScorePct).toBeGreaterThan(0);
    expect(trust.confidenceReductions.some((r) => r.startsWith("Authentication:"))).toBe(true);
  });
});

describe("buildSystemSummary", () => {
  it("returns separate authentication, data, and ai readiness summaries", () => {
    const summary = buildSystemSummary({
      providers,
      dataQualityPct: 82,
      overallAiReadinessPct: 66,
      capabilityMatrix: [
        { feature: "A", status: "ready", reason: "" },
        { feature: "B", status: "ready", reason: "" },
        { feature: "C", status: "waiting", reason: "" },
      ],
      gate: {
        evaluatedAt: new Date().toISOString(),
        canGenerateRecommendations: true,
        storeId: "s1",
        providers: [],
        overallMatchPercent: null,
        trustedProviderIds: [],
        blockedProviderIds: [],
        warnedProviderIds: [],
      },
      generatedAt: new Date().toISOString(),
      testSuiteRanAt: null,
    });
    expect(summary.authentication.authorizedCount).toBe(1);
    expect(summary.authentication.totalProviders).toBe(2);
    expect(summary.data.qualityPct).toBe(82);
    expect(summary.aiReadiness.readinessPct).toBe(66);
    expect(summary.aiReadiness.featuresAvailable).toBe(2);
    expect(summary.authentication.label).not.toBe(summary.data.label);
  });
});
