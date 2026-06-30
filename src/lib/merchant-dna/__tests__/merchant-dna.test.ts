import { describe, expect, it } from "vitest";
import { evolveLearnedSignals, DEFAULT_LEARNED_SIGNALS } from "@/lib/merchant-dna/learning/evolution";
import { inferGrowthStage } from "@/lib/merchant-dna/inference/growth-stage";
import { inferTrafficMix } from "@/lib/merchant-dna/inference/traffic-dna";
import {
  adjustDecisionPriorityForDna,
  buildDnaPersonalizationNarrative,
} from "@/lib/merchant-dna/personalization";
import { buildBenchmarkCohortId } from "@/lib/merchant-dna/benchmark";
import type { MerchantDNA } from "@/lib/merchant-dna/types";
import type { DecisionItem } from "@/lib/decisions/center";
import type { StoreSnapshot } from "@/lib/connectors/types";

function baseDna(overrides: Partial<MerchantDNA> = {}): MerchantDNA {
  return {
    storeId: "test",
    version: 1,
    businessModel: "dropshipping",
    storeMaturity: "growing",
    growthStage: "scaling",
    primaryAcquisitionChannel: "meta_ads",
    trafficMix: "meta_first",
    customerType: "b2c",
    productCount: 25,
    productDna: "hero_product",
    pricePosition: "mid_market",
    seasonality: "none",
    geographicMarkets: ["US"],
    preferredAdPlatforms: ["meta_ads"],
    executionStyle: "measured",
    riskTolerance: "low",
    automationPreference: "approval_required",
    decisionStyle: "data_driven",
    personality: "conservative",
    learned: { ...DEFAULT_LEARNED_SIGNALS, tooAggressiveRejections: 2, aggressivenessBias: -0.3 },
    manualOverrides: {},
    benchmarkCohort: "dropshipping:scaling:hero_product:mid_market",
    inferredAt: new Date().toISOString(),
    personalizationNarrative: "",
    ...overrides,
  };
}

describe("merchant DNA learning", () => {
  it("lowers aggressiveness after repeated too_aggressive rejections", () => {
    const learned = evolveLearnedSignals(DEFAULT_LEARNED_SIGNALS, {
      rejections: [
        { reason: "too_aggressive", createdAt: "2026-01-01" },
        { reason: "too_aggressive", createdAt: "2026-01-02" },
      ],
      recommendations: [],
    });
    expect(learned.aggressivenessBias).toBeLessThan(0);
    expect(learned.tooAggressiveRejections).toBe(2);
  });

  it("raises scaling affinity after scaling approvals", () => {
    const learned = evolveLearnedSignals(DEFAULT_LEARNED_SIGNALS, {
      rejections: [],
      recommendations: [
        {
          id: "1",
          category: "campaign_review",
          title: "Scale Meta campaign",
          severity: "high",
          reason: "ROAS strong",
          expectedImpact: "$500",
          confidenceScore: 0.9,
          actionLabel: "Approve",
          supportingMetrics: [],
          createdAt: "2026-01-01",
          status: "approved",
        },
        {
          id: "2",
          category: "campaign_review",
          title: "Increase budget on winner",
          severity: "high",
          reason: "Scale",
          expectedImpact: "$300",
          confidenceScore: 0.85,
          actionLabel: "Approve",
          supportingMetrics: [],
          createdAt: "2026-01-02",
          status: "approved",
        },
      ],
    });
    expect(learned.scalingAffinity).toBeGreaterThan(0);
  });
});

describe("merchant DNA inference", () => {
  it("classifies startup from low order volume", () => {
    const snapshot = {
      source: "demo",
      syncedAt: new Date().toISOString(),
      products: [{ id: "1", title: "A", inventoryQuantity: 0, unitsSold30d: 2, revenue30d: 100, price: 50, collectionIds: [], tags: [] }],
      collections: [],
      campaigns: [],
      storeMetrics: { orders30d: 10, revenue30d: 400, aov30d: 40, conversionRate30d: 1.5 },
      connectorStates: {},
    } as StoreSnapshot;

    expect(
      inferGrowthStage({
        storeId: "x",
        businessModel: "dropshipping",
        snapshot,
      }),
    ).toBe("startup");
  });

  it("detects meta-first traffic from spend", () => {
    const snapshot = {
      source: "demo",
      syncedAt: new Date().toISOString(),
      products: [],
      collections: [],
      campaigns: [{ id: "1", name: "C1", spend7d: 500, roas7d: 2, status: "ACTIVE" }],
      googleAdsSnapshot: { rollups: { last7d: { spend: 50 } } },
      storeMetrics: { orders30d: 100, revenue30d: 10000, aov30d: 100, conversionRate30d: 2 },
      connectorStates: { meta_ads: "connected" },
    } as StoreSnapshot;

    const traffic = inferTrafficMix(snapshot);
    expect(traffic.trafficMix).toBe("meta_first");
  });
});

describe("merchant DNA personalization", () => {
  it("builds narrative referencing DNA traits", () => {
    const narrative = buildDnaPersonalizationNarrative(baseDna());
    expect(narrative).toContain("Dropshipping");
    expect(narrative).toContain("Scaling");
    expect(narrative).toContain("Conservative");
  });

  it("deprioritizes scaling for conservative declining merchants", () => {
    const dna = baseDna({ growthStage: "declining", personality: "conservative" });
    const item: DecisionItem = {
      id: "d1",
      priority: "high",
      summary: "Scale Meta campaign budget by 20%",
      why: "ROAS is above target",
      supportingMetrics: [],
      confidencePct: 80,
      estimatedImpactLabel: "$500",
      recommendedAction: "Scale",
      status: "open",
      actionAvailable: false,
      executionAvailability: "manual",
      source: "recommendation",
      sourceId: "r1",
      priorityScore: 80,
    };
    const delta = adjustDecisionPriorityForDna(item, dna);
    expect(delta).toBeLessThan(0);
  });
});

describe("merchant benchmark cohort", () => {
  it("groups similar merchants by DNA fingerprint", () => {
    const cohort = buildBenchmarkCohortId({
      businessModel: "dropshipping",
      growthStage: "scaling",
      productDna: "hero_product",
      pricePosition: "mid_market",
    });
    expect(cohort).toBe("dropshipping:scaling:hero_product:mid_market");
  });
});
