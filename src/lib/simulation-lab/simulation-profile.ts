import type { BusinessModel, MerchantBusinessProfile } from "@/lib/business-model/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { MerchantDNA } from "@/lib/merchant-dna/types";

export function buildSimulationBusinessProfile(
  storeId: string,
  businessModel: BusinessModel,
  snapshot: StoreSnapshot,
  profitDashboard?: ProfitDashboard | null,
): MerchantBusinessProfile {
  const inventoryStrategy =
    businessModel === "dropshipping" || businessModel === "print_on_demand"
      ? "dropship"
      : businessModel === "digital_products"
        ? "digital"
        : "tracked";

  return {
    storeId,
    businessModel,
    businessModelSource: "manual",
    detectedBusinessModel: businessModel,
    detectionConfidence: 1,
    primarySalesChannel: "shopify",
    averageOrderValue: snapshot.storeMetrics.aov30d,
    typicalMarginPct: profitDashboard?.primary.profitMarginPct ?? undefined,
    inventoryStrategy,
    advertisingChannels: ["meta_ads", "google_ads"],
    primaryAcquisitionChannel: "meta_ads",
  };
}

export function buildSimulationMerchantDna(
  storeId: string,
  businessModel: BusinessModel,
  snapshot: StoreSnapshot,
  profitDashboard?: ProfitDashboard | null,
): MerchantDNA {
  const metaSpend =
    snapshot.metaAccountRollups?.last7d.spend ??
    snapshot.campaigns.reduce((s, c) => s + c.spend7d, 0);
  const googleSpend = snapshot.googleAdsSnapshot?.rollups.last7d.spend ?? 0;
  const trafficMix =
    metaSpend > googleSpend * 1.3
      ? "meta_first"
      : googleSpend > metaSpend * 1.3
        ? "google_first"
        : "hybrid";

  const productCount = snapshot.products.length;
  const productDna =
    productCount <= 1
      ? "single_product"
      : productCount <= 5
        ? "hero_product"
        : "general_store";

  return {
    storeId,
    version: 1,
    businessModel,
    storeMaturity: "established",
    growthStage: snapshot.storeMetrics.revenue30d > 25000 ? "scaling" : "growing",
    primaryAcquisitionChannel: trafficMix === "google_first" ? "google_ads" : "meta_ads",
    trafficMix,
    typicalMarginPct: profitDashboard?.primary.profitMarginPct ?? undefined,
    averageOrderValue: snapshot.storeMetrics.aov30d,
    customerType: "b2c",
    productCount,
    productDna,
    pricePosition: (snapshot.storeMetrics.aov30d ?? 0) > 80 ? "premium" : "mid_market",
    seasonality: "moderate",
    geographicMarkets: ["US"],
    preferredAdPlatforms: ["meta_ads", "google_ads"],
    executionStyle: "measured",
    riskTolerance: "medium",
    automationPreference: "approval_required",
    decisionStyle: "data_driven",
    personality: "balanced",
    learned: {
      aggressivenessBias: 0,
      scalingAffinity: 0,
      discountAffinity: 0,
      inventoryClearanceAffinity: 0,
    },
    manualOverrides: {},
    benchmarkCohort: `sim_${businessModel}`,
    inferredAt: new Date().toISOString(),
    personalizationNarrative: `Simulation merchant — ${businessModel.replace(/_/g, " ")}.`,
  };
}
