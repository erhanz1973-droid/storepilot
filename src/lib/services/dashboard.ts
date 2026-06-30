import { cache } from "react";
import { getDataSourceStatuses } from "@/lib/connectors/registry";
import { hasActiveAdsConnector } from "@/lib/connectors/active";
import { getStaleRecommendationCategories } from "@/lib/connectors/capabilities";
import { countActiveCampaigns } from "@/lib/meta/campaign-stats";
import {
  getAllApprovals,
  getPreviousDailySnapshot,
  listRecommendationHistory,
  listStoredRecommendations,
  purgeRecommendationsByCategories,
  saveDailySnapshot,
  syncConnectorStatuses,
  syncRecommendations,
} from "@/lib/db/recommendations";
import { resolveHistoryCampaignStatus, resolveCampaignFromSnapshot, formatCampaignReviewImpact, campaignDetailsFromEvidence } from "@/lib/recommendations/campaign-review";
import { buildCampaignMetaDetails } from "@/lib/meta/campaign-details";
import { generateAiBrief } from "@/lib/services/brief";
import { computeInventorySummary } from "@/lib/inventory/summary";
import { getStoreBusinessGoals } from "@/lib/db/business-goals";
import {
  computeHealthScore,
  runBusinessModelAwareAnalyzers,
  buildAnalyzerContext,
} from "@/lib/recommendations/registry";
import { resolveMerchantBusinessProfile } from "@/lib/business-model/profile";
import { buildDecisionPackContext } from "@/lib/decision-packs/registry";
import { computeBusinessModelHealth } from "@/lib/business-model/health";
import { resolveMerchantDNA } from "@/lib/merchant-dna/resolver";
import {
  getCachedVerifiedStoreData,
  recordRecommendationAuditBatch,
  listRecommendationAudit,
} from "@/lib/recommendations/validation";
import {
  onRecommendationsCreated,
  markRecommendationsDisplayed,
} from "@/lib/recommendations/intelligence/lifecycle";
import {
  persistRecommendationIntelligenceFields,
} from "@/lib/db/recommendation-intelligence";
import { evaluateOpportunities } from "@/lib/opportunities/engine";
import { buildStoreStatus } from "@/lib/store-status/build";
import { runPendingMeasurements } from "@/lib/learning/measurement-engine";
import { computeAiPerformance } from "@/lib/learning/outcomes";
import { generateWeeklyAiReport } from "@/lib/learning/weekly-report";
import { listOutcomeHistory, seedDemoLearningIfNeeded, listMeasuredRecommendations } from "@/lib/db/learning";
import { allowDemoData } from "@/lib/env/runtime";
import { applyLearningToOutputs } from "@/lib/learning/outcomes";
import { recommendationHasMeasurableImpact } from "@/lib/recommendations/impact";
import { resolveActiveStoreId } from "@/lib/store/context";
import { computeProfitDashboard } from "@/lib/profit/engine";
import {
  getCachedActiveStoreId,
  getCachedProductCosts,
  getCachedSnapshot,
} from "@/lib/services/store-bundle";
import { buildProductIntelligence } from "@/lib/products/engine";
import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { buildAutopilotDashboard } from "@/lib/autopilot/engine";
import { buildStoreManagerDashboard } from "@/lib/services/store-manager";
import { syncOpportunityHistory } from "@/lib/services/opportunity-sync";
import {
  computeStoreHealthScore,
  factorScoresToBreakdown,
} from "@/lib/store-health/score";
import { buildActivityFeed } from "@/lib/timeline/activity-feed";
import { buildPredictiveInsights } from "@/lib/predictions/engine";
import { buildInventoryForecasts } from "@/lib/autopilot/forecast";
import { runContinuousMonitors, aiEventsToActivityFeed } from "@/lib/monitoring/engine";
import { buildMorningExecutiveBrief } from "@/lib/brief/morning-brief";
import { hasActiveMetaAdsInstallations } from "@/lib/db/meta-ads";
import { getInstallationForStore } from "@/lib/db/shopify";
import { buildDecisionEngine } from "@/lib/decisions/engine";
import {
  enrichDecisionsWithQa,
  filterMerchantReadyDecisions,
} from "@/lib/decisions/qa";
import { buildProfitDecisionEngine } from "@/lib/decisions/profit-engine";
import { listOpportunityHistory } from "@/lib/db/opportunity-history";
import { listOutcomeRecords } from "@/lib/db/outcome-records";
import { buildMemoryIndex, applyMemoryToOpportunity } from "@/lib/memory/recommendation-memory";
import { buildPriorityQueue } from "@/lib/insights/priority";
import { sortCommerceOpportunities } from "@/lib/insights/opportunity-schema";
import { resolveMerchantMode } from "@/lib/store/merchant-mode";
import type { DashboardSnapshot, Recommendation, RecommendationCategory, RecommendationStatus } from "@/lib/types";

const RECOMMENDATION_SYNC_TTL_MS = 15 * 60 * 1000;

export type BuildDashboardOptions = {
  skipRecommendationSync?: boolean;
};

function isActiveRecommendation(rec: Recommendation): boolean {
  const status = rec.status ?? "pending";
  if (!recommendationHasMeasurableImpact(rec)) return false;
  if (status === "ignored" || status === "approved" || status === "completed" || status === "implemented" || status === "measured") {
    return false;
  }
  if (status === "snoozed" && rec.snoozedUntil) {
    return new Date(rec.snoozedUntil) <= new Date();
  }
  return true;
}

export async function ensureRecommendationsSynced(storeId: string): Promise<Recommendation[]> {
  const { snapshot, gate } = await getCachedVerifiedStoreData(storeId);
  const costRecords = await getCachedProductCosts(storeId);
  const profitDashboard = computeProfitDashboard(snapshot, costRecords);
  const businessProfile = await resolveMerchantBusinessProfile({
    storeId,
    snapshot,
    profitDashboard,
  });
  const storeBusinessGoals = await getStoreBusinessGoals(storeId);
  const analyzerContext = buildAnalyzerContext({
    snapshot,
    businessGoals: storeBusinessGoals,
    profitDashboard,
  });
  const decisionPackContext = buildDecisionPackContext({
    businessModel: businessProfile.businessModel,
    hybridWeights: businessProfile.hybridModelWeights,
  });
  const started = Date.now();
  const inactiveCategories = getStaleRecommendationCategories(
    snapshot.connectorStates,
  ) as RecommendationCategory[];
  const adsConnected = hasActiveAdsConnector(snapshot.connectorStates);
  const categoriesToPurge = [...inactiveCategories];
  if (adsConnected && countActiveCampaigns(snapshot.campaigns) === 0) {
    if (!categoriesToPurge.includes("campaign_review")) {
      categoriesToPurge.push("campaign_review");
    }
  }
  await purgeRecommendationsByCategories(storeId, categoriesToPurge);
  const outputs = await applyLearningToOutputs(
    runBusinessModelAwareAnalyzers(snapshot, gate, decisionPackContext.pack, analyzerContext),
    storeId,
  );
  await syncRecommendations(outputs, storeId);
  const recs = await listStoredRecommendations(storeId);
  const idByDedupe = new Map<string, string>();
  for (const output of outputs) {
    const match = recs.find(
      (r) =>
        r.title === output.title ||
        (output.entityId != null &&
          r.entityId === output.entityId &&
          r.category === output.category),
    );
    if (match) idByDedupe.set(output.id, match.id);
  }
  await recordRecommendationAuditBatch({
    storeId,
    outputs,
    recommendationIds: idByDedupe,
    durationMs: Date.now() - started,
  });
  await persistRecommendationIntelligenceFields(storeId, outputs, idByDedupe);
  await onRecommendationsCreated(storeId, outputs, idByDedupe);
  return recs;
}

/** Skip full analyzer sync when recommendations were refreshed recently. */
export const getCachedRecommendations = cache(async (storeId: string): Promise<Recommendation[]> => {
  const existing = await listStoredRecommendations(storeId);
  if (existing.length > 0) {
    const latestMs = existing.reduce((max, rec) => {
      const ts = new Date(rec.createdAt).getTime();
      return ts > max ? ts : max;
    }, 0);
    if (Date.now() - latestMs < RECOMMENDATION_SYNC_TTL_MS) {
      return existing;
    }
  }
  return ensureRecommendationsSynced(storeId);
});

export const getCachedDashboard = cache(
  async (
    storeIdOverride?: string,
    options?: BuildDashboardOptions,
  ): Promise<
    DashboardSnapshot & { dataSources: Awaited<ReturnType<typeof getDataSourceStatuses>> }
  > => {
    return buildDashboard(storeIdOverride, options);
  },
);

export async function buildDashboard(
  storeIdOverride?: string,
  options?: BuildDashboardOptions,
): Promise<
  DashboardSnapshot & { dataSources: Awaited<ReturnType<typeof getDataSourceStatuses>> }
> {
  const storeId = storeIdOverride ?? (await getCachedActiveStoreId());
  const [{ snapshot, gate }, validationAudits, dataSources, costRecords] = await Promise.all([
    getCachedVerifiedStoreData(storeId),
    listRecommendationAudit(storeId, 100),
    getDataSourceStatuses(storeId),
    getCachedProductCosts(storeId),
  ]);
  const allRecs = options?.skipRecommendationSync
    ? await listStoredRecommendations(storeId)
    : await getCachedRecommendations(storeId);
  const activeRecs = allRecs.filter(isActiveRecommendation);
  const inventorySummary = computeInventorySummary(snapshot.products);
  const adsConnected = hasActiveAdsConnector(snapshot.connectorStates);
  const activeMetaCampaigns = countActiveCampaigns(snapshot.campaigns);

  const profitDashboard = computeProfitDashboard(snapshot, costRecords);
  const productIntelligence = buildProductIntelligence(snapshot, costRecords, profitDashboard);
  const attributionDashboard = buildAttributionDashboard(snapshot, profitDashboard);

  const previousSnapshot = await getPreviousDailySnapshot(storeId);
  const storeHealth = computeStoreHealthScore({
    snapshot,
    profitDashboard,
    productIntelligence,
    attributionDashboard,
    activeRecommendations: activeRecs,
    previousFactorScores: previousSnapshot?.factorScores as Partial<
      Record<import("@/lib/store-health/score").StoreHealthFactor, number>
    >,
    previousScore: previousSnapshot?.healthScore,
  });

  const { score, breakdown } = computeHealthScore(allRecs, inventorySummary, {
    hasActiveAdsConnector: adsConnected,
    hasActiveMetaCampaigns: activeMetaCampaigns > 0,
  });
  const healthScore = storeHealth.score;

  const criticalAlerts = activeRecs.filter((r) => r.severity === "critical");
  const revenueOpportunities = activeRecs.filter((r) =>
    ["bundle_opportunity", "promotion_opportunity", "homepage_merchandising"].includes(
      r.category,
    ),
  );

  if (allowDemoData()) {
    await seedDemoLearningIfNeeded(storeId);
  }
  await runPendingMeasurements(storeId);

  const measuredRecs = await listMeasuredRecommendations(storeId);
  const outcomeHistory = await listOutcomeHistory(storeId);
  const aiPerformance = computeAiPerformance(measuredRecs, outcomeHistory);

  const netMarginPct = profitDashboard?.primary.profitMarginPct ?? undefined;
  const topOpportunities = evaluateOpportunities(snapshot, {
    limit: 8,
    netMarginPct,
    extra: [
      ...(productIntelligence?.productOpportunities ?? []),
      ...(attributionDashboard?.attributionOpportunities ?? []),
    ],
  });

  const weeklyReport = await generateWeeklyAiReport(storeId, {
    snapshot,
    profitDashboard,
    productIntelligence,
    attributionDashboard,
    topOpportunities,
    activeRecommendations: activeRecs,
  });

  const storeStatus = buildStoreStatus(snapshot, dataSources);
  const aiBrief = generateAiBrief(healthScore, activeRecs, criticalAlerts, revenueOpportunities, topOpportunities);

  const autopilotDashboard = buildAutopilotDashboard(
    {
      snapshot,
      profitDashboard,
      productIntelligence,
      attributionDashboard,
      topOpportunities,
      activeRecommendations: activeRecs,
      criticalAlerts,
      storeHealthScore: healthScore,
    },
    allRecs,
  );

  const storeManager = await buildStoreManagerDashboard({
    snapshot,
    profitDashboard,
    dataSources,
    storeId,
    storeHealthScore: healthScore,
    topOpportunities,
    criticalAlerts,
  });

  const opportunityHistory = await syncOpportunityHistory(
    storeId,
    topOpportunities,
    storeManager.opportunityFeed ?? [],
  );

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
    criticalAlerts,
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

  const roas30d = profitDashboard?.blendedRoas?.blendedRoas30d;
  const roasPrev = snapshot.salesTrends
    ? roas30d != null
      ? { direction: (roas30d >= 1.5 ? "up" : "down") as "up" | "down", value: roas30d }
      : null
    : null;

  const legacyFeed = buildActivityFeed({
    syncedAt: snapshot.syncedAt,
    opportunities: adjustedFeed,
    activeRecommendations: activeRecs,
    alerts: autopilotDashboard.alerts,
    roasChange: roasPrev,
  });
  const activityFeed = [
    ...aiEventsToActivityFeed(aiEvents),
    ...legacyFeed.filter((e) => !aiEvents.some((ev) => ev.title === e.event)),
  ].slice(0, 12);

  const revenue7Change = storeManager.trends?.metrics.find((m) => m.id === "revenue_7d")?.changePct;
  const morningBrief = buildMorningExecutiveBrief({
    storeHealth,
    dailyBrief: storeManager.dailyBrief,
    priorityQueue: adjustedPriorityQueue,
    opportunities: adjustedFeed,
    aiEvents,
    profitMarginPct: profitDashboard?.primary.profitMarginPct ?? undefined,
    revenueChangePct: revenue7Change ?? null,
  });

  const merchantMode = await resolveMerchantMode();
  const businessProfile = await resolveMerchantBusinessProfile({
    storeId,
    snapshot,
    profitDashboard,
    productIntelligence,
  });
  const decisionPackContext = buildDecisionPackContext({
    businessModel: businessProfile.businessModel,
    hybridWeights: businessProfile.hybridModelWeights,
  });
  const businessModelHealth = computeBusinessModelHealth({
    profile: businessProfile,
    snapshot,
    profitDashboard,
    productIntelligence,
  });
  const { dna: merchantDna, benchmark: merchantBenchmark } = await resolveMerchantDNA({
    storeId,
    businessProfile,
    snapshot,
    profitDashboard,
    productIntelligence,
  });
  const profitEngine = buildProfitDecisionEngine({
    snapshot,
    profitDashboard: profitDashboard!,
    merchantMode,
    enableInventoryStrategies: decisionPackContext.pack.enableInventoryStrategies,
  });
  const profitStrategiesByProductId = new Map(
    profitEngine.slowProductStrategies.map((s) => [s.productId, s]),
  );

  const allDecisions = buildDecisionEngine({
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
    businessProfile,
    decisionPackContext,
    merchantDna,
  });

  const decisionCenter = filterMerchantReadyDecisions(enrichDecisionsWithQa(allDecisions));

  const storeManagerAdjusted = {
    ...storeManager,
    opportunityFeed: adjustedFeed,
    priorityQueue: adjustedPriorityQueue,
  };

  await syncConnectorStatuses(
    storeId,
    dataSources.map((d) => ({
      connector_type: d.id,
      label: d.label,
      status: d.status,
      last_sync_at: d.lastSyncAt,
    })),
  );

  await saveDailySnapshot(
    storeId,
    healthScore,
    breakdown,
    aiBrief,
    {
      syncedAt: snapshot.syncedAt,
      productCount: snapshot.products.length,
    },
    factorScoresToBreakdown(storeHealth.factors),
  );

  return {
    storeHealthScore: healthScore,
    healthBreakdown: breakdown,
    storeHealth,
    inventorySummary,
    topOpportunities,
    storeStatus,
    revenueOpportunities: revenueOpportunities.slice(0, 6),
    criticalAlerts,
    aiBrief,
    aiPerformance,
    weeklyReport,
    activityFeed,
    aiEvents,
    morningBrief,
    decisionCenter,
    outcomeRecords,
    predictiveInsights,
    opportunityHistory,
    lastAnalyzedAt: snapshot.syncedAt,
    dataSources,
    connectorStates: snapshot.connectorStates,
    hasActiveAdsConnector: adsConnected,
    hasActiveMetaCampaigns: activeMetaCampaigns > 0,
    profitDashboard,
    productIntelligence,
    attributionDashboard,
    autopilotDashboard,
    storeManager: storeManagerAdjusted,
    validationGate: gate,
    businessProfile,
    businessModelHealth,
    dashboardWidgets: decisionPackContext.pack.dashboardWidgets,
    merchantDna,
    merchantBenchmark,
  };
}

export async function listRecommendations() {
  const storeId = await resolveActiveStoreId();
  const recs = await ensureRecommendationsSynced(storeId);
  const approvals = await getAllApprovals();
  const approvalMap = new Map(approvals.map((a) => [a.recommendationId, a]));

  return recs.map((rec) => {
    const existing = approvalMap.get(rec.id);
    const status = rec.status ?? existing?.status ?? "pending";
    return {
      ...rec,
      status,
      approval: {
        recommendationId: rec.id,
        status,
        note: existing?.note,
        updatedAt: existing?.updatedAt ?? rec.createdAt,
        snoozedUntil: rec.snoozedUntil ?? existing?.snoozedUntil,
      },
    };
  });
}

export async function getHistory(filters?: {
  status?: RecommendationStatus;
  priority?: string;
  category?: string;
}) {
  const storeId = await resolveActiveStoreId();
  await ensureRecommendationsSynced(storeId);
  const entries = await listRecommendationHistory(storeId, filters);
  const snapshot = await getCachedSnapshot(storeId);

  return entries.map((entry) => {
    if (entry.recommendation.category !== "campaign_review") {
      return entry;
    }

    const campaign = resolveCampaignFromSnapshot(snapshot.campaigns, {
      entityId: entry.recommendation.entityId,
      title: entry.recommendation.title,
    });

    const status = resolveHistoryCampaignStatus(
      snapshot.campaigns,
      {
        entityId: entry.recommendation.entityId,
        title: entry.recommendation.title,
      },
      entry.recommendation,
    );

    const expectedImpact = campaign
      ? formatCampaignReviewImpact(campaign)
      : entry.expectedImpact;

    return {
      ...entry,
      expectedImpact,
      campaignStatus: status.campaignStatus,
      campaignStatusLabel: status.campaignStatusLabel,
      campaignDetails: campaign
        ? buildCampaignMetaDetails(campaign, "tr")
        : campaignDetailsFromEvidence(entry.recommendation),
    };
  });
}
