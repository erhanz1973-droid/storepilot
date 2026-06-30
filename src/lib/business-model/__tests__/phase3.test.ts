import { describe, expect, it } from "vitest";
import { detectBusinessModelFromSnapshot } from "@/lib/business-model/detection";
import { resolveMerchantBusinessProfile } from "@/lib/business-model/profile";
import { upsertStoreBusinessProfile } from "@/lib/db/business-profile";
import {
  buildDecisionPackContext,
  decisionAllowedByPack,
  filterAnalyzerOutputs,
  getDecisionPack,
} from "@/lib/decision-packs/registry";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { DecisionItem } from "@/lib/decisions/center";

function baseSnapshot(products: StoreSnapshot["products"]): StoreSnapshot {
  return {
    source: "demo",
    syncedAt: new Date().toISOString(),
    products,
    collections: [],
    campaigns: [],
    storeMetrics: {
      orders30d: 100,
      revenue30d: 10000,
      aov30d: 100,
      conversionRate30d: 2.1,
    },
    connectorStates: {},
  };
}

describe("business model detection", () => {
  it("detects dropshipping when most SKUs have zero inventory", () => {
    const snapshot = baseSnapshot([
      { id: "1", title: "Product A", inventoryQuantity: 0, unitsSold30d: 10, price: 40, revenue30d: 400, collectionIds: [], tags: [] },
      { id: "2", title: "Product B", inventoryQuantity: 0, unitsSold30d: 8, price: 30, revenue30d: 240, collectionIds: [], tags: [] },
      { id: "3", title: "Product C", inventoryQuantity: 0, unitsSold30d: 5, price: 20, revenue30d: 100, collectionIds: [], tags: [] },
    ]);

    const result = detectBusinessModelFromSnapshot({ snapshot });
    expect(result.detectedModel).toBe("dropshipping");
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it("detects own_inventory when catalog has tracked stock", () => {
    const snapshot = baseSnapshot([
      { id: "1", title: "Backpack", inventoryQuantity: 120, unitsSold30d: 80, price: 80, revenue30d: 6400, collectionIds: [], tags: [] },
      { id: "2", title: "Boots", inventoryQuantity: 96, unitsSold30d: 60, price: 60, revenue30d: 3600, collectionIds: [], tags: [] },
      { id: "3", title: "Tent", inventoryQuantity: 58, unitsSold30d: 40, price: 200, revenue30d: 8000, collectionIds: [], tags: [] },
    ]);

    const result = detectBusinessModelFromSnapshot({ snapshot });
    expect(result.detectedModel).toBe("own_inventory");
  });

  it("does not auto-apply dropshipping detection as active model", async () => {
    const storeId = "test-no-auto-dropship";
    const snapshot = baseSnapshot([
      { id: "1", title: "Product A", inventoryQuantity: 0, unitsSold30d: 10, price: 40, revenue30d: 400, collectionIds: [], tags: [] },
      { id: "2", title: "Product B", inventoryQuantity: 0, unitsSold30d: 8, price: 30, revenue30d: 240, collectionIds: [], tags: [] },
    ]);

    const profile = await resolveMerchantBusinessProfile({ storeId, snapshot });
    expect(profile.businessModel).toBe("own_inventory");
    expect(profile.businessModelSource).not.toBe("detected");
    expect(profile.detectedBusinessModel).toBe("dropshipping");
  });

  it("keeps manual own_inventory when catalog looks like dropshipping", async () => {
    const storeId = "test-manual-own-inventory";
    const snapshot = baseSnapshot([
      { id: "1", title: "Product A", inventoryQuantity: 0, unitsSold30d: 10, price: 40, revenue30d: 400, collectionIds: [], tags: [] },
      { id: "2", title: "Product B", inventoryQuantity: 0, unitsSold30d: 8, price: 30, revenue30d: 240, collectionIds: [], tags: [] },
    ]);

    await upsertStoreBusinessProfile(storeId, {
      businessModel: "own_inventory",
      businessModelSource: "manual",
      inventoryStrategy: "tracked",
    });

    const profile = await resolveMerchantBusinessProfile({ storeId, snapshot });
    expect(profile.businessModel).toBe("own_inventory");
    expect(profile.businessModelSource).toBe("manual");
    expect(profile.inventoryStrategy).toBe("tracked");
    expect(profile.detectedBusinessModel).toBe("dropshipping");
  });
});

describe("decision packs", () => {
  it("disables inventory recommendations for dropshipping", () => {
    const pack = getDecisionPack("dropshipping");
    const outputs = filterAnalyzerOutputs(
      [
        {
          id: "inv-1",
          category: "low_inventory",
          title: "Low Inventory Alert",
          description: "Restock soon",
          priority: "high",
          expectedImpact: "$100",
          confidence: 0.8,
          evidence: [],
          actions: [{ label: "Review", type: "review" }],
        },
        {
          id: "camp-1",
          category: "campaign_review",
          title: "Scale campaign",
          description: "ROAS is strong",
          priority: "high",
          expectedImpact: "$500",
          confidence: 0.9,
          evidence: [],
          actions: [{ label: "Review", type: "review" }],
        },
      ],
      pack,
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]?.category).toBe("campaign_review");
  });

  it("filters inventory decisions from decision center for dropshipping", () => {
    const context = buildDecisionPackContext({ businessModel: "dropshipping" });
    const inventoryDecision: DecisionItem = {
      id: "d1",
      priority: "high",
      summary: "Clearance discount for slow inventory",
      why: "Aged stock needs clearance",
      supportingMetrics: [],
      confidencePct: 80,
      estimatedImpactLabel: "$500",
      recommendedAction: "Discount",
      status: "open",
      actionAvailable: false,
      executionAvailability: "manual",
      source: "recommendation",
      sourceId: "r1",
      priorityScore: 80,
    };
    const scalingDecision: DecisionItem = {
      ...inventoryDecision,
      id: "d2",
      summary: "Scale winning product campaign",
      why: "ROAS above target on hero SKU",
    };

    expect(decisionAllowedByPack(inventoryDecision, context.pack)).toBe(false);
    expect(decisionAllowedByPack(scalingDecision, context.pack)).toBe(true);
  });
});
