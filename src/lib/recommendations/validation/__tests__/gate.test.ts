import { describe, expect, it } from "vitest";
import {
  computeFinalConfidence,
  resolveTrustLevel,
  validationConfidenceFromScore,
} from "@/lib/recommendations/validation/confidence";
import { applyValidationToOutput } from "@/lib/recommendations/validation/evidence-builder";
import type { ValidationGateReport } from "@/lib/recommendations/validation/types";
import { campaignsAnalyzer } from "@/lib/recommendations/campaigns";

function mockGate(overrides?: Partial<ValidationGateReport>): ValidationGateReport {
  return {
    storeId: "store-1",
    evaluatedAt: new Date().toISOString(),
    providers: [
      {
        providerId: "meta",
        connectorId: "meta_ads",
        label: "Meta Ads",
        connected: true,
        matchScore: 100,
        trustLevel: "trusted",
        lastSyncAt: new Date().toISOString(),
        cacheCreatedAt: new Date().toISOString(),
        cacheAgeMinutes: 2,
        dataAgeMinutes: 2,
        freshness: "fresh",
        readiness: "production_ready",
      },
      {
        providerId: "google",
        connectorId: "google_ads",
        label: "Google Ads",
        connected: true,
        matchScore: 82,
        trustLevel: "blocked",
        lastSyncAt: null,
        cacheCreatedAt: null,
        cacheAgeMinutes: null,
        dataAgeMinutes: null,
        freshness: "unknown",
        readiness: "not_validated",
      },
    ],
    overallMatchPercent: 91,
    canGenerateRecommendations: true,
    trustedProviderIds: ["meta"],
    blockedProviderIds: ["google"],
    warnedProviderIds: [],
    ...overrides,
  };
}

describe("recommendation validation gate", () => {
  it("resolves trust levels from scores", () => {
    expect(resolveTrustLevel(100, true)).toBe("trusted");
    expect(resolveTrustLevel(97, true)).toBe("warn");
    expect(resolveTrustLevel(82, true)).toBe("blocked");
    expect(resolveTrustLevel(null, true)).toBe("warn");
  });

  it("computes final confidence from AI and validation scores", () => {
    expect(computeFinalConfidence(0.95, 1)).toBe(0.95);
    expect(computeFinalConfidence(0.95, 0.82)).toBe(0.779);
    expect(validationConfidenceFromScore(100)).toBe(1);
  });

  it("blocks outputs when all required providers are blocked", () => {
    const gate = mockGate();
    const output = {
      id: "camp-1",
      title: "Pause Campaign",
      description: "Low ROAS",
      priority: "high" as const,
      expectedImpact: "+$100/mo",
      confidence: 0.88,
      evidence: [{ label: "ROAS", value: "0.81" }],
      actions: [{ label: "Review", type: "review" as const }],
      category: "campaign_review" as const,
      entityType: "campaign",
      entityId: "1",
    };

    const blockedGate = mockGate({
      providers: gate.providers.map((p) =>
        p.providerId === "meta" ? { ...p, matchScore: 72, trustLevel: "blocked" as const } : p,
      ),
      blockedProviderIds: ["meta", "google"],
      trustedProviderIds: [],
    });

    const result = applyValidationToOutput(output, campaignsAnalyzer, blockedGate);
    expect(result.validation?.blocked).toBe(true);
    expect(result.confidence).toBe(0);
  });

  it("reduces confidence when validation score is warn tier", () => {
    const gate = mockGate({
      providers: [
        {
          providerId: "meta",
          connectorId: "meta_ads",
          label: "Meta Ads",
          connected: true,
          matchScore: 97,
          trustLevel: "warn",
          lastSyncAt: new Date().toISOString(),
          cacheCreatedAt: new Date().toISOString(),
          cacheAgeMinutes: 5,
          dataAgeMinutes: 5,
          freshness: "fresh",
          readiness: "development",
        },
      ],
      warnedProviderIds: ["meta"],
      trustedProviderIds: [],
    });

    const output = {
      id: "camp-1",
      title: "Pause Campaign",
      description: "Low ROAS",
      priority: "high" as const,
      expectedImpact: "+$100/mo",
      confidence: 0.88,
      evidence: [{ label: "ROAS", value: "0.81" }],
      actions: [{ label: "Review", type: "review" as const }],
      category: "campaign_review" as const,
    };

    const result = applyValidationToOutput(output, campaignsAnalyzer, gate);
    expect(result.validation?.blocked).toBe(false);
    expect(result.confidence).toBeLessThan(0.88);
  });
});
