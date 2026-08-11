import { listStoredRecommendations } from "@/lib/db/recommendations";
import { buildGrowthCopilotView, classifyMerchantStage } from "@/lib/growth-copilot";
import type { GrowthCopilotView, MerchantStage } from "@/lib/growth-copilot";
import { getCachedStoreBundle } from "@/lib/services/store-bundle";

export async function buildGrowthCopilotPageData(): Promise<GrowthCopilotView> {
  const bundle = await getCachedStoreBundle();
  let recommendations: Awaited<ReturnType<typeof listStoredRecommendations>> = [];
  try {
    recommendations = await listStoredRecommendations(bundle.storeId);
  } catch {
    recommendations = [];
  }
  return buildGrowthCopilotView({
    storeId: bundle.storeId,
    snapshot: bundle.snapshot,
    profitDashboard: bundle.profitDashboard,
    hasProductCosts: bundle.costRecords.length > 0,
    recommendations,
  });
}

export async function resolveHomeMerchantStage(): Promise<MerchantStage> {
  const bundle = await getCachedStoreBundle();
  return classifyMerchantStage({
    snapshot: bundle.snapshot,
    profitDashboard: bundle.profitDashboard,
    hasProductCosts: bundle.costRecords.length > 0,
  }).stage;
}
