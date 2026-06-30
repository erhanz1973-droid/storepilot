import { aggregateStoreSnapshot, getDataSourceStatuses } from "@/lib/connectors/registry";
import { buildBusinessContext } from "@/lib/ai/context-engine";
import type { BusinessContext } from "@/lib/ai/types";
import { buildStoreManagerDashboard } from "@/lib/services/store-manager";
import { computeStoreHealthScore } from "@/lib/store-health/score";
import { buildPredictiveInsights } from "@/lib/predictions/engine";
import { buildInventoryForecasts } from "@/lib/autopilot/forecast";
import { normalizeCommerceSnapshot } from "@/lib/commerce/normalize";
import type { NormalizedCommerceSnapshot } from "@/lib/commerce/types";
import { resolveActiveStoreId } from "@/lib/store/context";
import type { StoreManagerDashboard } from "@/lib/insights/types";
import type { StoreHealthScore } from "@/lib/store-health/score";
import type { PredictiveInsight } from "@/lib/predictions/engine";
import type { StoreSnapshot } from "@/lib/connectors/types";
import { buildCustomerIntelligence, type CustomerIntelligenceDashboard } from "@/lib/customers/engine";

export type CopilotDataBundle = {
  context: BusinessContext;
  storeManager: StoreManagerDashboard;
  storeHealth: StoreHealthScore;
  snapshot: StoreSnapshot;
  commerce: NormalizedCommerceSnapshot;
  predictiveInsights: PredictiveInsight[];
  customerIntelligence: CustomerIntelligenceDashboard | null;
};

export async function loadCopilotData(): Promise<CopilotDataBundle> {
  const storeId = await resolveActiveStoreId();
  const [context, snapshot, dataSources] = await Promise.all([
    buildBusinessContext(),
    aggregateStoreSnapshot(storeId),
    getDataSourceStatuses(storeId),
  ]);

  const storeManager = await buildStoreManagerDashboard({
    snapshot,
    profitDashboard: context.profitDashboard,
    dataSources,
    storeId,
    storeHealthScore: context.healthScore,
    topOpportunities: context.topOpportunities,
    criticalAlerts: context.activeRecommendations.filter((r) => r.severity === "critical"),
  });

  const storeHealth = computeStoreHealthScore({
    snapshot,
    profitDashboard: context.profitDashboard ?? null,
    productIntelligence: context.productIntelligence ?? null,
    attributionDashboard: context.attributionDashboard ?? null,
    activeRecommendations: context.activeRecommendations,
  });

  const netMargin = context.profitDashboard?.primary.profitMarginPct ?? 38;
  const inventoryForecasts = buildInventoryForecasts(snapshot.products, netMargin);
  const predictiveInsights = buildPredictiveInsights({
    snapshot,
    profitDashboard: context.profitDashboard ?? null,
    attributionDashboard: context.attributionDashboard ?? null,
    inventoryForecasts,
  });

  const commerce = normalizeCommerceSnapshot(snapshot, {
    storeDomain: snapshot.commerceStoreDomain,
  });

  const customerIntelligence = buildCustomerIntelligence({
    snapshot,
    attribution: context.attributionDashboard ?? null,
    profitDashboard: context.profitDashboard ?? null,
  });

  return { context, storeManager, storeHealth, snapshot, commerce, predictiveInsights, customerIntelligence };
}
