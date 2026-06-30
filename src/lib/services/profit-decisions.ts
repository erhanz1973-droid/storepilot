import { buildBusinessContext } from "@/lib/ai/context-engine";
import { getDecisionPack } from "@/lib/decision-packs/registry";
import { resolveMerchantBusinessProfile } from "@/lib/business-model/profile";
import { aggregateStoreSnapshot } from "@/lib/connectors/registry";
import { buildProfitDecisionEngine } from "@/lib/decisions/profit-engine";
import { listProductCosts } from "@/lib/db/product-costs";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { resolveActiveStoreId } from "@/lib/store/context";
import { resolveMerchantMode } from "@/lib/store/merchant-mode";

export async function buildProfitDecisionPlan() {
  const storeId = await resolveActiveStoreId();
  const [snapshot, context, costRecords, merchantMode] = await Promise.all([
    aggregateStoreSnapshot(storeId),
    buildBusinessContext(),
    listProductCosts(storeId),
    resolveMerchantMode(),
  ]);

  const profitDashboard =
    context.profitDashboard ?? computeProfitDashboard(snapshot, costRecords);

  if (!profitDashboard) {
    return {
      merchantMode,
      objective: "Profit data unavailable — connect Shopify and add product costs.",
      recommendations: [],
      slowProductStrategies: [],
      inventoryStrategiesEnabled: true,
    };
  }

  const businessProfile = await resolveMerchantBusinessProfile({
    storeId,
    snapshot,
    profitDashboard,
  });
  const pack = getDecisionPack(
    businessProfile.businessModel,
    businessProfile.hybridModelWeights,
  );

  const result = buildProfitDecisionEngine({
    snapshot,
    profitDashboard,
    context,
    merchantMode,
    enableInventoryStrategies: pack.enableInventoryStrategies,
  });

  return {
    ...result,
    inventoryStrategiesEnabled: pack.enableInventoryStrategies,
    businessModel: businessProfile.businessModel,
  };
}
