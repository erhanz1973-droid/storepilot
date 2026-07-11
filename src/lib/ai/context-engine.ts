import { aggregateStoreSnapshot, getDataSourceStatuses } from "@/lib/connectors/registry";
import { hasActiveAdsConnector } from "@/lib/connectors/active";
import { getStaleRecommendationCategories } from "@/lib/connectors/capabilities";
import {
  listStoredRecommendations,
  purgeRecommendationsByCategories,
  syncRecommendations,
} from "@/lib/db/recommendations";
import { getInstallationForStore } from "@/lib/db/shopify";
import { generateAiBrief } from "@/lib/services/brief";
import { computeInventorySummary } from "@/lib/inventory/summary";
import { countActiveCampaigns, getActiveCampaigns } from "@/lib/meta/campaign-stats";
import {
  computeHealthScore,
  runValidatedAnalyzers,
} from "@/lib/recommendations/registry";
import { getVerifiedStoreData } from "@/lib/recommendations/validation";
import { evaluateOpportunities } from "@/lib/opportunities/engine";
import { applyLearningToOutputs, computeAiPerformance } from "@/lib/learning/outcomes";
import { generateWeeklyAiReport } from "@/lib/learning/weekly-report";
import { allowDemoData } from "@/lib/env/runtime";
import { listOutcomeHistory, seedDemoLearningIfNeeded } from "@/lib/db/learning";
import { listProductCosts } from "@/lib/db/product-costs";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildProductIntelligence } from "@/lib/products/engine";
import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { buildProductAttributionDashboard } from "@/lib/attribution/product-engine";
import type { ProductAttributionDashboard } from "@/lib/attribution/product-types";
import { buildAutopilotDashboard } from "@/lib/autopilot/engine";
import { recommendationHasMeasurableImpact } from "@/lib/recommendations/impact";
import { computeIntegrationConfidence } from "@/lib/integrations/confidence";
import { resolveActiveStoreId } from "@/lib/store/context";
import { resolveMerchantMode } from "@/lib/store/merchant-mode";
import type { BusinessContext } from "./types";
import type { Recommendation, RecommendationCategory } from "@/lib/types";
import { DEMO_STORE_ID } from "@/lib/types";

function isActive(rec: Recommendation): boolean {
  if (!recommendationHasMeasurableImpact(rec)) return false;
  const status = rec.status ?? "pending";
  if (["ignored", "approved", "completed", "implemented", "measured"].includes(status)) return false;
  if (status === "snoozed" && rec.snoozedUntil) {
    return new Date(rec.snoozedUntil) > new Date();
  }
  return true;
}

export async function buildBusinessContext(): Promise<BusinessContext> {
  const storeId = await resolveActiveStoreId();
  const { snapshot, gate } = await getVerifiedStoreData(storeId);
  const staleCategories = getStaleRecommendationCategories(
    snapshot.connectorStates,
  ) as RecommendationCategory[];
  const adsConnected = hasActiveAdsConnector(snapshot.connectorStates);
  const categoriesToPurge = [...staleCategories];
  if (adsConnected && countActiveCampaigns(snapshot.campaigns) === 0) {
    if (!categoriesToPurge.includes("campaign_review")) {
      categoriesToPurge.push("campaign_review");
    }
  }
  await purgeRecommendationsByCategories(storeId, categoriesToPurge);
  const outputs = await applyLearningToOutputs(runValidatedAnalyzers(snapshot, gate), storeId);
  await syncRecommendations(outputs, storeId);
  const recommendations = await listStoredRecommendations(storeId);
  const activeRecommendations = recommendations.filter(isActive);
  const inventorySummary = computeInventorySummary(snapshot.products);
  const activeMetaCampaigns = countActiveCampaigns(snapshot.campaigns);
  const { score, breakdown } = computeHealthScore(recommendations, inventorySummary, {
    hasActiveAdsConnector: adsConnected,
    hasActiveMetaCampaigns: activeMetaCampaigns > 0,
  });

  const criticalAlerts = activeRecommendations.filter((r) => r.severity === "critical");
  const revenueOpportunities = activeRecommendations.filter((r) =>
    ["bundle_opportunity", "promotion_opportunity", "homepage_merchandising"].includes(
      r.category,
    ),
  );

  const costRecords = await listProductCosts(storeId);
  const profitDashboard = computeProfitDashboard(snapshot, costRecords);
  const merchantMode = await resolveMerchantMode();
  const productAttribution = buildProductAttributionDashboard(
    snapshot,
    costRecords,
    profitDashboard,
  );
  const productIntelligence = buildProductIntelligence(
    snapshot,
    costRecords,
    profitDashboard,
    productAttribution,
  );
  const attributionDashboard = buildAttributionDashboard(snapshot, profitDashboard);
  const topOpportunities = evaluateOpportunities(snapshot, {
    limit: 8,
    netMarginPct: profitDashboard?.primary.profitMarginPct ?? undefined,
    extra: [
      ...(productIntelligence?.productOpportunities ?? []),
      ...(attributionDashboard?.attributionOpportunities ?? []),
    ],
  });
  const autopilotDashboard = buildAutopilotDashboard(
    {
      snapshot,
      profitDashboard,
      productIntelligence,
      attributionDashboard,
      topOpportunities,
      activeRecommendations,
      criticalAlerts,
      storeHealthScore: score,
    },
    recommendations,
  );
  if (allowDemoData()) {
    await seedDemoLearningIfNeeded(storeId);
  }
  const outcomeHistory = await listOutcomeHistory(storeId);
  const aiPerformance = computeAiPerformance([], outcomeHistory);
  const weeklyReport = await generateWeeklyAiReport(storeId);

  const aiBrief = generateAiBrief(
    score,
    activeRecommendations,
    criticalAlerts,
    revenueOpportunities,
    topOpportunities,
  );
  const dataSources = await getDataSourceStatuses(storeId);
  const installation = await getInstallationForStore(storeId);

  const lowStockProducts = snapshot.products
    .map((p) => {
      const dailyVelocity = p.unitsSold30d / 30;
      const daysOfCover =
        dailyVelocity > 0 ? p.inventoryQuantity / dailyVelocity : 999;
      return { title: p.title, inventory: p.inventoryQuantity, daysOfCover };
    })
    .filter((p) => p.daysOfCover <= 14)
    .sort((a, b) => a.daysOfCover - b.daysOfCover);

  const slowProducts = snapshot.products
    .filter((p) => p.unitsSold30d <= 20 && p.inventoryQuantity >= 30)
    .map((p) => ({
      title: p.title,
      unitsSold30d: p.unitsSold30d,
      inventory: p.inventoryQuantity,
    }));

  const topProducts = [...snapshot.products]
    .sort((a, b) => b.revenue30d - a.revenue30d)
    .slice(0, 5)
    .map((p) => ({
      title: p.title,
      revenue30d: p.revenue30d,
      unitsSold30d: p.unitsSold30d,
      inventory: p.inventoryQuantity,
    }));

  const campaigns = adsConnected
    ? getActiveCampaigns(snapshot.campaigns).map((c) => ({
        name: c.name,
        roas7d: c.roas7d,
        spend7d: c.spend7d,
        impressions7d: c.impressions7d,
        revenue7d: c.revenue7d,
        frequency7d: c.frequency7d,
        effectiveStatus: c.effectiveStatus,
      }))
    : [];

  const inventoryUnits = snapshot.products.reduce((s, p) => s + p.inventoryQuantity, 0);
  const integrationConfidence = computeIntegrationConfidence(
    snapshot,
    snapshot.integrationSnapshot,
  );
  const connectedLabels = dataSources
    .filter((d) => d.status === "connected" || d.status === "demo")
    .map((d) => `${d.label} (${d.status})`)
    .join(", ");

  return {
    storeId,
    isDemo: !installation && storeId === DEMO_STORE_ID,
    syncedAt: snapshot.syncedAt,
    healthScore: score,
    healthBreakdown: breakdown,
    storeMetrics: snapshot.storeMetrics,
    productCount: snapshot.products.length,
    inventoryUnits,
    collectionCount: snapshot.collections.length,
    discountCount: 0,
    topProducts,
    lowStockProducts,
    slowProducts,
    campaigns,
    hasActiveAdsConnector: adsConnected,
    hasActiveMetaCampaigns: activeMetaCampaigns > 0,
    salesTrends: snapshot.salesTrends,
    recommendations,
    activeRecommendations,
    topOpportunities,
    aiBrief,
    aiPerformance,
    weeklyReport,
    dataSourceSummary: `${connectedLabels || "Demo data"} · Integration confidence ${integrationConfidence.scorePct}% (${integrationConfidence.liveDataPct}% live)`,
    profitDashboard,
    productIntelligence,
    productAttribution,
    attributionDashboard,
    autopilotDashboard,
    merchantMode,
  };
}
