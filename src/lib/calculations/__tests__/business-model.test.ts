import { describe, expect, it } from "vitest";
import {
  BUSINESS_MODEL_CONFIGS,
  composeBusinessRecovery,
  formulaConfidenceForModel,
  resolveBusinessModelConfig,
  selectPrimaryKpis,
} from "@/lib/calculations/business-model/config";
import { calculateBusinessKPIs } from "@/lib/calculations/kpis/engine";
import { emptyRawFacts } from "@/lib/calculations/facts/types";
import { calculateDecisionImpactFromInputs } from "@/lib/calculations/impact/engine";

describe("BusinessModelConfig", () => {
  it("resolves every known model", () => {
    for (const model of Object.keys(BUSINESS_MODEL_CONFIGS)) {
      const config = resolveBusinessModelConfig(model as keyof typeof BUSINESS_MODEL_CONFIGS);
      expect(config.businessModel).toBe(model);
      expect(config.primaryKpis.length).toBeGreaterThan(0);
      expect(config.recoveryDefinition.length).toBeGreaterThan(10);
    }
  });

  it("emphasizes different KPIs by model", () => {
    expect(selectPrimaryKpis(BUSINESS_MODEL_CONFIGS.subscription)).toContain("mrr");
    expect(selectPrimaryKpis(BUSINESS_MODEL_CONFIGS.subscription)).toContain("churn");
    expect(selectPrimaryKpis(BUSINESS_MODEL_CONFIGS.own_inventory)).toContain("inventoryDays");
    expect(selectPrimaryKpis(BUSINESS_MODEL_CONFIGS.digital_products)).toContain("blendedRoas");
    expect(selectPrimaryKpis(BUSINESS_MODEL_CONFIGS.digital_products)).not.toContain("inventoryDays");
  });

    it("composes business recovery differently by model (same inputs)", () => {
    const components = {
      avoidedWaste: 6168,
      advertisingSavings: 8635,
      recoveredRevenue: 0,
      marginImprovement: 0,
    };

    const inventory = composeBusinessRecovery(components, BUSINESS_MODEL_CONFIGS.own_inventory);
    const dropship = composeBusinessRecovery(components, BUSINESS_MODEL_CONFIGS.dropshipping);
    const digital = composeBusinessRecovery(components, BUSINESS_MODEL_CONFIGS.digital_products);

    // CEO scale preserved
    expect(inventory).toBeGreaterThanOrEqual(6168);
    expect(dropship).toBeGreaterThanOrEqual(6168);

    // Dropship adds supplier path → higher than inventory waste floor for same ads
    expect(dropship).toBeGreaterThan(inventory);
    // Digital emphasizes ads + revenue (no recovered revenue here → still ≥ floor)
    expect(digital).toBeGreaterThanOrEqual(6168);
  });

  it("weights confidence toward retention for subscription", () => {
    const factors = {
      dataQuality: 0.5,
      sampleSizeScore: 0.5,
      predictionStability: 0.5,
      historicalAccuracy: 0.5,
      retentionHistory: 0.95,
      inventoryAccuracy: 0.2,
      trafficQuality: 0.2,
    };
    const sub = formulaConfidenceForModel(factors, BUSINESS_MODEL_CONFIGS.subscription);
    const retail = formulaConfidenceForModel(factors, BUSINESS_MODEL_CONFIGS.own_inventory);
    expect(sub).toBeGreaterThan(retail);
  });

  it("passes business model into impact calculation without breaking consistency", () => {
    const kpis = calculateBusinessKPIs(emptyRawFacts());
    const label =
      "If accepted, estimated cost savings ~$6,168–$11,102/mo (~$636/mo profit preserved).";

    const own = calculateDecisionImpactFromInputs(
      { expectedImpactLabel: label, category: "campaign_review", confidenceScore: 0.9 },
      kpis,
      "own_inventory",
    );
    const digital = calculateDecisionImpactFromInputs(
      { expectedImpactLabel: label, category: "campaign_review", confidenceScore: 0.9 },
      kpis,
      "digital_products",
    );
    const dropship = calculateDecisionImpactFromInputs(
      { expectedImpactLabel: label, category: "campaign_review", confidenceScore: 0.9 },
      kpis,
      "dropshipping",
    );

    // Own inventory hero = waste-at-risk low bound
    expect(own.businessRecovery).toBe(6168);
    // Explicit profit label → same net profit across models (P&L line)
    expect(own.netProfitImpact).toBe(636);
    expect(digital.netProfitImpact).toBe(636);
    expect(dropship.netProfitImpact).toBe(636);
    // Recovery composition MAY differ by model (digital/dropship weight ads + supplier)
    expect(digital.businessRecovery).toBeGreaterThanOrEqual(own.businessRecovery);
    expect(dropship.businessRecovery).toBeGreaterThan(own.businessRecovery);
  });

  it("uses profile typicalMarginPct when provided", () => {
    const config = resolveBusinessModelConfig({
      storeId: "s1",
      businessModel: "own_inventory",
      businessModelSource: "manual",
      typicalMarginPct: 25,
    });
    expect(config.defaultNetMarginRate).toBe(0.25);
  });
});
