import { describe, expect, it } from "vitest";
import { buildAiTrustSummary, buildSystemSummary } from "../trust-summary";
import type { ProviderHealthDetail } from "../types";

const providers: ProviderHealthDetail[] = [
  {
    id: "shopify",
    label: "Shopify",
    connectionStatus: "connected",
    tokenValid: true,
    lastSuccessfulSync: new Date().toISOString(),
    apiLatencyMs: null,
    rateLimitStatus: "ok",
    lastApiError: null,
    recordsSynced: 10,
    missingFields: ["Customers"],
    dataFreshness: "fresh",
    dataQualityPct: 90,
    aiReadyPct: 85,
    aiReady: true,
    entityChecks: [{ label: "Customers", value: "0", status: "missing" }],
  },
  {
    id: "google_ads",
    label: "Google Ads",
    connectionStatus: "disconnected",
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
  it("includes confidence reductions for gaps", () => {
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
    expect(trust.confidenceReductions.some((r) => r.includes("Google Ads"))).toBe(true);
  });
});

describe("buildSystemSummary", () => {
  it("counts connected providers and AI features", () => {
    const summary = buildSystemSummary({
      providers,
      dataQualityPct: 82,
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
    expect(summary.connectedProviders).toBe(1);
    expect(summary.totalProviders).toBe(2);
    expect(summary.aiFeaturesAvailable).toBe(2);
    expect(summary.totalAiFeatures).toBe(3);
  });
});
