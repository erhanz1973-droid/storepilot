import { listRejectionFeedback } from "@/lib/db/decision-feedback";
import { listStoredRecommendations } from "@/lib/db/recommendations";
import { getMerchantDnaProfile, upsertMerchantDnaProfile } from "@/lib/db/merchant-dna";
import type { MerchantBusinessProfile } from "@/lib/business-model/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { ProductIntelligenceDashboard } from "@/lib/products/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import { buildMerchantBenchmark, buildBenchmarkCohortId } from "./benchmark";
import {
  DEFAULT_LEARNED_SIGNALS,
  evolveLearnedSignals,
  personalityFromLearned,
} from "./learning/evolution";
import { inferGrowthStage } from "./inference/growth-stage";
import { inferTrafficMix } from "./inference/traffic-dna";
import { inferProductDna } from "./inference/product-dna";
import { buildDnaPersonalizationNarrative } from "./personalization";
import type {
  AutomationPreference,
  MerchantDNA,
  MerchantDNALearnedSignals,
  MerchantDNAManualOverrides,
  RiskTolerance,
  StoreMaturity,
} from "./types";
import {
  normalizeAutomationPreference,
  normalizeGrowthStage,
  normalizePersonality,
  normalizeProductDna,
  normalizeTrafficMix,
} from "./types";

export type ResolveMerchantDnaInput = {
  storeId: string;
  businessProfile: MerchantBusinessProfile;
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  productIntelligence?: ProductIntelligenceDashboard | null;
};

function inferStoreMaturity(snapshot: StoreSnapshot): StoreMaturity {
  const orders = snapshot.storeMetrics?.orders30d ?? 0;
  if (orders < 40) return "new";
  if (orders >= 300) return "legacy";
  return "established";
}

function riskFromPersonality(
  personality: ReturnType<typeof normalizePersonality>,
  margin?: number,
): RiskTolerance {
  if (personality === "conservative") return "low";
  if (personality === "aggressive") return "high";
  if (margin != null && margin < 20) return "low";
  return "medium";
}

export async function resolveMerchantDNA(
  input: ResolveMerchantDnaInput,
): Promise<{ dna: MerchantDNA; benchmark: ReturnType<typeof buildMerchantBenchmark> }> {
  const stored = await getMerchantDnaProfile(input.storeId);
  const manual: MerchantDNAManualOverrides = stored?.manualOverrides ?? {};

  const ctx = {
    storeId: input.storeId,
    businessModel: input.businessProfile.businessModel,
    snapshot: input.snapshot,
    profitDashboard: input.profitDashboard,
    productIntelligence: input.productIntelligence,
  };

  const growthStage = normalizeGrowthStage(
    manual.growthStage ?? inferGrowthStage(ctx),
  );
  const traffic = inferTrafficMix(input.snapshot);
  const trafficMix = normalizeTrafficMix(manual.trafficMix ?? traffic.trafficMix);
  const aov =
    input.businessProfile.averageOrderValue ?? input.snapshot.storeMetrics?.aov30d;
  const margin =
    input.businessProfile.typicalMarginPct ??
    input.profitDashboard?.primary.profitMarginPct ??
    undefined;
  const product = inferProductDna({
    snapshot: input.snapshot,
    businessModel: input.businessProfile.businessModel,
    productIntelligence: input.productIntelligence,
    averageOrderValue: aov,
  });

  const [rejections, recommendations] = await Promise.all([
    listRejectionFeedback(input.storeId, 100),
    listStoredRecommendations(input.storeId),
  ]);

  const learned: MerchantDNALearnedSignals = evolveLearnedSignals(
    stored?.learned ?? DEFAULT_LEARNED_SIGNALS,
    {
      rejections: rejections.map((r) => ({ reason: r.reason, createdAt: r.createdAt })),
      recommendations,
    },
  );

  const basePersonality = normalizePersonality(manual.personality ?? "balanced");
  const personality = personalityFromLearned(basePersonality, learned);

  const traits = {
    businessModel: input.businessProfile.businessModel,
    storeMaturity: inferStoreMaturity(input.snapshot),
    growthStage,
    primaryAcquisitionChannel:
      manual.primaryAcquisitionChannel ??
      input.businessProfile.primaryAcquisitionChannel ??
      traffic.primaryChannel,
    trafficMix,
    typicalMarginPct: margin,
    averageOrderValue: aov,
    customerType: "b2c" as const,
    productCount: input.snapshot.products.length,
    productDna: normalizeProductDna(manual.productDna ?? product.productDna),
    pricePosition: product.pricePosition,
    seasonality: product.seasonality,
    geographicMarkets: ["US"],
    preferredAdPlatforms:
      input.businessProfile.advertisingChannels?.length
        ? input.businessProfile.advertisingChannels
        : traffic.preferredPlatforms,
    executionStyle: manual.executionStyle ?? ("measured" as const),
    riskTolerance: manual.riskTolerance ?? riskFromPersonality(personality, margin),
    automationPreference: normalizeAutomationPreference(
      manual.automationPreference ?? "approval_required",
    ),
    decisionStyle: manual.decisionStyle ?? ("data_driven" as const),
    personality,
  };

  const benchmarkCohort = buildBenchmarkCohortId({
    businessModel: traits.businessModel,
    growthStage: traits.growthStage,
    productDna: traits.productDna,
    pricePosition: traits.pricePosition,
  });

  const dna: MerchantDNA = {
    storeId: input.storeId,
    version: (stored?.version ?? 0) + 1,
    ...traits,
    learned,
    manualOverrides: manual,
    benchmarkCohort,
    inferredAt: new Date().toISOString(),
    personalizationNarrative: "",
  };

  dna.personalizationNarrative = buildDnaPersonalizationNarrative(dna);
  const benchmark = buildMerchantBenchmark({
    dna,
    snapshot: input.snapshot,
    profitDashboard: input.profitDashboard,
  });

  await upsertMerchantDnaProfile(input.storeId, {
    dna,
    learned,
    manualOverrides: manual,
    benchmarkCohort,
    version: dna.version,
  });

  return { dna, benchmark };
}

export function automationAllowsAutopilot(pref: AutomationPreference): boolean {
  return pref === "semi_automatic" || pref === "full_autopilot";
}
