import { describe, expect, it } from "vitest";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { Recommendation } from "@/lib/types";
import { generatedEventsForAnalyzeResult } from "@/lib/analytics/activation-events";
import {
  assembleFirstRunAnalyzeResult,
  extraAnalyzerOutputsForFirstValue,
  pickBestRecommendation,
} from "@/lib/first-run/assemble";
import {
  buildFirstValueInsight,
  FIRST_VALUE_DEDUPE_KEY,
  shouldSurfaceFirstValueOnDashboard,
} from "@/lib/first-run/first-value";
import { resolveFirstRunPhase } from "@/lib/first-run/types";

function snapshot(overrides: Partial<StoreSnapshot> = {}): StoreSnapshot {
  return {
    source: "connected",
    syncedAt: new Date().toISOString(),
    products: [],
    collections: [],
    campaigns: [],
    storeMetrics: {
      revenue30d: 0,
      orders30d: 0,
      aov30d: 0,
      conversionRate30d: 0,
    },
    connectorStates: {
      shopify: "connected",
      meta_ads: "disconnected",
      google_ads: "disconnected",
    },
    ...overrides,
  };
}

const veyloLike = snapshot({
  products: [
    {
      id: "prod-hoodie",
      title: "Classic Hoodie",
      inventoryQuantity: 12,
      unitsSold30d: 2,
      revenue30d: 23.98,
      price: 11.99,
      collectionIds: [],
      tags: [],
    },
    {
      id: "prod-quiet",
      title: "Quiet Tee",
      inventoryQuantity: 8,
      unitsSold30d: 0,
      revenue30d: 0,
      price: 19,
      collectionIds: [],
      tags: [],
    },
  ],
  storeMetrics: {
    revenue30d: 23.98,
    orders30d: 2,
    aov30d: 11.99,
    conversionRate30d: 1,
  },
  commerceOrders: [
    {
      id: "o1",
      externalId: "o1",
      platform: "shopify",
      createdAt: "2026-08-01T00:00:00.000Z",
      revenue: 11.99,
      cogs: 0,
      shipping: 0,
      discounts: 0,
      refunds: 0,
      isNewCustomer: true,
      lines: [{ productId: "prod-hoodie", title: "Classic Hoodie", quantity: 1, revenue: 11.99 }],
    },
    {
      id: "o2",
      externalId: "o2",
      platform: "shopify",
      createdAt: "2026-08-02T00:00:00.000Z",
      revenue: 11.99,
      cogs: 0,
      shipping: 0,
      discounts: 0,
      refunds: 0,
      isNewCustomer: false,
      lines: [{ productId: "prod-hoodie", title: "Classic Hoodie", quantity: 1, revenue: 11.99 }],
    },
  ],
});

const auraGridLike = snapshot({
  products: Array.from({ length: 28 }, (_, i) => ({
    id: `ag-${i + 1}`,
    title: `AuraGrid SKU ${i + 1}`,
    inventoryQuantity: i === 0 ? 5000 : 4,
    unitsSold30d: 0,
    revenue30d: 0,
    price: 40,
    collectionIds: [],
    tags: [],
  })),
  storeMetrics: {
    revenue30d: 0,
    orders30d: 0,
    aov30d: 0,
    conversionRate30d: 0,
  },
});

function engineRec(partial: Partial<Recommendation> = {}): Recommendation {
  return {
    id: "engine-1",
    category: "low_inventory",
    title: "Restock bestseller",
    severity: "high",
    reason: "Cover is too thin",
    expectedImpact: "$400/mo",
    confidenceScore: 0.82,
    actionLabel: "Review",
    supportingMetrics: [{ label: "Days cover", value: "4" }],
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe("first-value funnel", () => {
  it("Scenario A — products + orders generate and show a first recommendation", () => {
    const insight = buildFirstValueInsight(veyloLike);
    expect(insight.kind).toBe("recommendation");
    expect(insight.output).not.toBeNull();
    expect(insight.output?.id).toBe(FIRST_VALUE_DEDUPE_KEY);
    expect(insight.body).toMatch(/Classic Hoodie/);
    expect(insight.body).not.toMatch(/\$[0-9,]+\/mo/);
    expect(insight.output?.expectedImpact).not.toMatch(/\$\d/);

    const extras = extraAnalyzerOutputsForFirstValue(veyloLike);
    expect(extras).toHaveLength(1);

    const result = assembleFirstRunAnalyzeResult({
      storeId: "veylo",
      shopifyConnected: true,
      snapshot: veyloLike,
      recommendations: extras.map((output) => ({
        id: output.id,
        category: output.category,
        title: output.title,
        severity: output.priority,
        reason: output.description,
        expectedImpact: output.expectedImpact,
        confidenceScore: output.confidence,
        actionLabel: output.actions[0]?.label ?? "Review",
        supportingMetrics: output.evidence,
        createdAt: new Date().toISOString(),
        entityId: output.entityId,
        entityType: output.entityType,
      })),
      hasProfit: false,
      durationMs: 12,
    });

    expect(result.ok).toBe(true);
    expect(result.decision).not.toBeNull();
    expect(result.decision?.presentation).toBe("first_insight");
    expect(result.decision?.title).toMatch(/Classic Hoodie/);
    expect(result.decision?.evidencePoints.some((p) => p.includes("Orders"))).toBe(true);

    const events = generatedEventsForAnalyzeResult(result);
    expect(events.map((e) => e.event)).toEqual([
      "store_stage_detected",
      "first_recommendation_generated",
      "first_recommendation_shown",
      "next_best_action_shown",
    ]);
    expect(result.merchantStage).toBe("new");
    const generated = events.find((e) => e.event === "first_recommendation_generated");
    expect(generated?.props.recommendation_type).toBe("best_seller_focus");
    expect(generated?.props.source).toBe("first_run");
  });

  it("Scenario B — products with 0 orders do not fabricate a business recommendation", () => {
    const insight = buildFirstValueInsight(auraGridLike);
    expect(insight.kind).toBe("low_data");
    expect(insight.output).toBeNull();
    expect(insight.body).toMatch(/more data/i);
    expect(insight.known.some((row) => row.label === "Products" && row.value === "28")).toBe(true);
    expect(insight.known.some((row) => row.label === "Orders" && row.value === "0")).toBe(true);
    expect(extraAnalyzerOutputsForFirstValue(auraGridLike)).toEqual([]);

    const result = assembleFirstRunAnalyzeResult({
      storeId: "auragrid",
      shopifyConnected: true,
      snapshot: auraGridLike,
      recommendations: [],
      hasProfit: false,
      durationMs: 9,
    });

    expect(result.decision).toBeNull();
    expect(result.firstValue?.kind).toBe("low_data");
    expect(result.firstValue?.primaryAction.href).toContain("/connections");
    expect(result.merchantStage).toBe("new");
    expect(generatedEventsForAnalyzeResult(result).map((e) => e.event)).toEqual([
      "store_stage_detected",
      "next_best_action_shown",
      "first_recommendation_shown",
    ]);
    expect(resolveFirstRunPhase({ result, error: null, analyzing: false })).toBe("low_data");
  });

  it("Scenario C — OAuth/Shopify connected loads first-run analysis", () => {
    const result = assembleFirstRunAnalyzeResult({
      storeId: "oauth-shop",
      shopifyConnected: true,
      snapshot: veyloLike,
      recommendations: [],
      hasProfit: false,
      durationMs: 4,
    });
    expect(result.ok).toBe(true);
    expect(result.shopifyConnected).toBe(true);
    expect(result.stages[0]?.id).toBe("shopify_connected");
    expect(result.stages[0]?.status).toBe("done");
    expect(result.decision).not.toBeNull();
  });

  it("Scenario D — analyze failure maps to a clear error phase, not a blank screen", () => {
    expect(
      resolveFirstRunPhase({
        result: null,
        error: "Analysis could not finish. You can retry or open Connections.",
        analyzing: false,
      }),
    ).toBe("error");

    const disconnected = assembleFirstRunAnalyzeResult({
      storeId: "x",
      shopifyConnected: false,
      snapshot: snapshot({ source: "disconnected" }),
      recommendations: [],
      hasProfit: false,
      durationMs: 1,
    });
    expect(disconnected.ok).toBe(false);
    expect(disconnected.emptyReason).toMatch(/Connect Shopify/i);
  });

  it("Scenario E — refresh uses a stable first-value id instead of duplicating recs", () => {
    const first = extraAnalyzerOutputsForFirstValue(veyloLike);
    const second = extraAnalyzerOutputsForFirstValue(veyloLike);
    expect(first[0]?.id).toBe(FIRST_VALUE_DEDUPE_KEY);
    expect(second[0]?.id).toBe(first[0]?.id);
    expect(first[0]?.title).toBe(second[0]?.title);
  });

  it("does not invent ROAS or profit numbers for thin sales", () => {
    const insight = buildFirstValueInsight(veyloLike);
    expect(insight.output?.description).not.toMatch(/ROAS of|ROAS:|ROAS =/);
    expect(insight.output?.expectedImpact).not.toMatch(/\$\d/);
    expect(insight.unknown.some((row) => row.label === "Channel ROAS")).toBe(true);
  });

  it("prefers an engine rec with measurable impact over the first-value fallback", () => {
    const recs = [engineRec(), engineRec({ id: "engine-2", expectedImpact: "$50/mo", confidenceScore: 0.6 })];
    const best = pickBestRecommendation(recs);
    expect(best?.id).toBe("engine-1");

    const result = assembleFirstRunAnalyzeResult({
      storeId: "healthy",
      shopifyConnected: true,
      snapshot: veyloLike,
      recommendations: recs,
      hasProfit: true,
      durationMs: 3,
    });
    expect(result.decision?.recommendationId).toBe("engine-1");
    expect(result.decision?.presentation).toBe("executive_decision");
  });

  it("surfaces low-data guidance on the dashboard only for connected shops without a decision", () => {
    const insight = buildFirstValueInsight(auraGridLike);
    expect(
      shouldSurfaceFirstValueOnDashboard({
        insight,
        hasExecutiveDecision: false,
        shopifyConnected: true,
      }),
    ).toBe(true);
    expect(
      shouldSurfaceFirstValueOnDashboard({
        insight,
        hasExecutiveDecision: true,
        shopifyConnected: true,
      }),
    ).toBe(false);
    expect(
      shouldSurfaceFirstValueOnDashboard({
        insight,
        hasExecutiveDecision: false,
        shopifyConnected: false,
      }),
    ).toBe(false);
  });
});
