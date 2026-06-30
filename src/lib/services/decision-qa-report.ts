import { hasActiveAdsConnector } from "@/lib/connectors/active";
import { countActiveCampaigns } from "@/lib/meta/campaign-stats";
import { listStoredRecommendations, syncRecommendations } from "@/lib/db/recommendations";
import { getInstallationForStore } from "@/lib/db/shopify";
import { listOpportunityHistory } from "@/lib/db/opportunity-history";
import { listOutcomeRecords } from "@/lib/db/outcome-records";
import { hasActiveMetaAdsInstallations } from "@/lib/db/meta-ads";
import { listProductCosts } from "@/lib/db/product-costs";
import { buildProfitDecisionEngine } from "@/lib/decisions/profit-engine";
import { runDecisionEngineWithQa } from "@/lib/decisions/qa";
import type { DecisionEngineQaReport } from "@/lib/decisions/qa";
import { buildPriorityQueue } from "@/lib/insights/priority";
import { sortCommerceOpportunities } from "@/lib/insights/opportunity-schema";
import { buildMemoryIndex, applyMemoryToOpportunity } from "@/lib/memory/recommendation-memory";
import { evaluateOpportunities } from "@/lib/opportunities/engine";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildProductIntelligence } from "@/lib/products/engine";
import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { runContinuousMonitors } from "@/lib/monitoring/engine";
import { buildPredictiveInsights } from "@/lib/predictions/engine";
import { buildInventoryForecasts } from "@/lib/autopilot/forecast";
import {
  getVerifiedStoreData,
  listRecommendationAudit,
} from "@/lib/recommendations/validation";
import { applyLearningToOutputs } from "@/lib/learning/outcomes";
import { runValidatedAnalyzers, computeHealthScore } from "@/lib/recommendations/registry";
import { computeInventorySummary } from "@/lib/inventory/summary";
import { buildStoreManagerDashboard } from "@/lib/services/store-manager";
import { syncOpportunityHistory } from "@/lib/services/opportunity-sync";
import { resolveActiveStoreId } from "@/lib/store/context";
import { resolveMerchantMode } from "@/lib/store/merchant-mode";
import { recommendationHasMeasurableImpact } from "@/lib/recommendations/impact";
import type { Recommendation } from "@/lib/types";

function isActiveRecommendation(rec: Recommendation): boolean {
  const status = rec.status ?? "pending";
  if (!recommendationHasMeasurableImpact(rec)) return false;
  if (
    ["ignored", "approved", "completed", "implemented", "measured"].includes(status)
  ) {
    return false;
  }
  if (status === "snoozed" && rec.snoozedUntil) {
    return new Date(rec.snoozedUntil) <= new Date();
  }
  return true;
}

/** Full QA report for /dev/decision-engine */
export async function buildDecisionQaReport(): Promise<DecisionEngineQaReport> {
  const storeId = await resolveActiveStoreId();
  const validationStart = performance.now();
  const { snapshot, gate } = await getVerifiedStoreData(storeId);
  const validationMs = performance.now() - validationStart;

  const validationAudits = await listRecommendationAudit(storeId, 100);
  await syncRecommendations(
    await applyLearningToOutputs(runValidatedAnalyzers(snapshot, gate), storeId),
    storeId,
  );
  const allRecs = await listStoredRecommendations(storeId);
  const activeRecs = allRecs.filter(isActiveRecommendation);

  const costRecords = await listProductCosts(storeId);
  const profitDashboard = computeProfitDashboard(snapshot, costRecords);
  const productIntelligence = buildProductIntelligence(snapshot, costRecords, profitDashboard);
  const attributionDashboard = buildAttributionDashboard(snapshot, profitDashboard);
  const inventorySummary = computeInventorySummary(snapshot.products);
  const adsConnected = hasActiveAdsConnector(snapshot.connectorStates);
  const activeMetaCampaigns = countActiveCampaigns(snapshot.campaigns);

  const { score: healthScore } = computeHealthScore(allRecs, inventorySummary, {
    hasActiveAdsConnector: adsConnected,
    hasActiveMetaCampaigns: activeMetaCampaigns > 0,
  });

  const topOpportunities = evaluateOpportunities(snapshot, {
    limit: 8,
    netMarginPct: profitDashboard?.primary.profitMarginPct ?? undefined,
    extra: [
      ...(productIntelligence?.productOpportunities ?? []),
      ...(attributionDashboard?.attributionOpportunities ?? []),
    ],
  });

  const storeManager = await buildStoreManagerDashboard({
    snapshot,
    profitDashboard,
    dataSources: [],
    storeId,
    storeHealthScore: healthScore,
    topOpportunities,
    criticalAlerts: activeRecs.filter((r) => r.severity === "critical"),
  });

  await syncOpportunityHistory(storeId, topOpportunities, storeManager.opportunityFeed ?? []);
  const historyRecords = await listOpportunityHistory(storeId);
  const outcomeRecords = await listOutcomeRecords(storeId, 100);
  const shopifyInstallation = await getInstallationForStore(storeId);
  const memoryIndex = buildMemoryIndex({
    opportunityHistory: historyRecords,
    recommendations: allRecs,
  });

  const adjustedFeed = sortCommerceOpportunities(
    (storeManager.opportunityFeed ?? []).map((o) => applyMemoryToOpportunity(o, memoryIndex)),
  );
  const adjustedPriorityQueue = buildPriorityQueue(
    adjustedFeed,
    topOpportunities,
    activeRecs.filter((r) => r.severity === "critical"),
  );

  const netMargin = profitDashboard?.primary.profitMarginPct ?? 38;
  const inventoryForecasts = buildInventoryForecasts(snapshot.products, netMargin);
  const predictiveInsights = buildPredictiveInsights({
    snapshot,
    profitDashboard,
    attributionDashboard,
    inventoryForecasts,
  });

  const aiEvents = runContinuousMonitors({
    syncedAt: snapshot.syncedAt,
    snapshot,
    profitDashboard,
    productIntelligence,
    attributionDashboard,
    opportunities: adjustedFeed,
    predictiveInsights,
  });

  const merchantMode = await resolveMerchantMode();
  const strategyStart = performance.now();
  const profitEngine = buildProfitDecisionEngine({
    snapshot,
    profitDashboard: profitDashboard!,
    merchantMode,
  });
  const strategySimulationMs = performance.now() - strategyStart;

  const profitStrategiesByProductId = new Map(
    profitEngine.slowProductStrategies.map((s) => [s.productId, s]),
  );

  return runDecisionEngineWithQa({
    storeId,
    priorityQueue: adjustedPriorityQueue,
    opportunities: adjustedFeed,
    recommendations: activeRecs,
    aiEvents,
    opportunityHistory: historyRecords,
    allRecommendations: allRecs,
    metaConnected: await hasActiveMetaAdsInstallations(storeId),
    shopifyConnected: Boolean(shopifyInstallation),
    shopifyScopes: shopifyInstallation?.scopes ?? [],
    shopifyShopDomain: shopifyInstallation?.shop_domain ?? null,
    campaigns: snapshot.campaigns,
    products: snapshot.products,
    collections: snapshot.collections,
    outcomeRecords,
    validationGate: gate,
    recommendationAudits: validationAudits,
    merchantMode,
    profitStrategiesByProductId,
    validationMs,
    strategySimulationMs,
  });
}
