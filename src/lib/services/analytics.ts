import { buildIntegrationReadiness, type IntegrationReadiness } from "@/lib/trust/integration-readiness";
import { cache } from "react";
import { buildExecutiveAnalytics } from "@/lib/analytics/executive";
import { allowDemoData } from "@/lib/env/runtime";
import { buildExecutiveAdvisorView, type ExecutiveAdvisorView } from "@/lib/analytics/executive-advisor";
import { buildExecutiveUnifiedLayer } from "@/lib/analytics/executive-unified-layer";
import { buildExecutiveCeoOsLayer, type ExecutiveCeoOsLayer } from "@/lib/analytics/build-executive-ceo-os";
import { readExecutiveVisitSnapshot } from "@/lib/analytics/executive-visit";
import type { DailyAiPlaybook, ExecutiveFocusSummary } from "@/lib/analytics/ai-daily-playbook";
import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { buildDemoSnapshot } from "@/lib/demo/get-demo-snapshot";
import { getActiveDemoScenarioId } from "@/lib/demo/scenario-context";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { logServerRenderError } from "@/lib/services/server-render-error";
import { computeStoreHealthScore } from "@/lib/store-health/score";
import { buildMarketingManagerView } from "@/lib/analytics/marketing-manager";
import { buildProductAttributionDashboard } from "@/lib/attribution/product-engine";
import { buildMarketingCampaigns } from "@/lib/analytics/marketing";
import { buildTrafficAnalytics } from "@/lib/analytics/traffic";
import { buildFunnelAnalyticsLegacy } from "@/lib/funnel/engine";
import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { buildProductIntelligence } from "@/lib/products/engine";
import { runContinuousMonitors, aiEventsToActivityFeed } from "@/lib/monitoring/engine";
import { buildCommerceOpportunities } from "@/lib/insights/engine";
import { buildPredictiveInsights } from "@/lib/predictions/engine";
import { buildInventoryForecasts } from "@/lib/autopilot/forecast";
import { buildLiveMissionControlView, buildLiveKpiUpdate } from "@/lib/live/mission-control";
import { buildLiveRawMetricsFast, liveDataFingerprint } from "@/lib/live/live-raw-metrics";
import { getOrCompute, fingerprintData } from "@/lib/performance/compute-cache";
import { REFRESH_MS } from "@/lib/performance/refresh-schedules";
import { profileServerAsync, logPerfSummary } from "@/lib/performance/server-profiler";
import type { LiveMissionControlView } from "@/lib/live/mission-control-types";
import { buildSalesManagerView } from "@/lib/analytics/sales-manager";
import { buildTrafficManagerView } from "@/lib/analytics/traffic-manager";
import {
  getCachedActiveStoreId,
  getCachedStoreBundle,
} from "@/lib/services/store-bundle";
import { getCachedDashboard } from "@/lib/services/dashboard";
import { getLiveExecutiveBundle } from "@/lib/executive/live/bundle";

/** Light bundle — no full dashboard / recommendation sync. */
async function buildLightAnalyticsContext() {
  const bundle = await getCachedStoreBundle();

  return {
    storeId: bundle.storeId,
    snapshot: bundle.snapshot,
    profitDashboard: bundle.profitDashboard,
    executive: buildExecutiveAnalytics({
      snapshot: bundle.snapshot,
      profitDashboard: bundle.profitDashboard,
      executiveSummary: null,
      trends: null,
    }),
    marketing: buildMarketingCampaigns(bundle.snapshot),
    traffic: buildTrafficAnalytics(bundle.snapshot),
    funnel: buildFunnelAnalyticsLegacy(bundle.snapshot),
  };
}

/** Full bundle — executive / marketing pages that need decisions & AI behavior. */
const buildFullAnalyticsContext = cache(async () => {
  const storeId = await getCachedActiveStoreId();
  const [bundle, dashboard] = await Promise.all([
    getCachedStoreBundle(),
    getCachedDashboard(storeId),
  ]);

  return {
    storeId,
    dashboard,
    snapshot: bundle.snapshot,
    profitDashboard: bundle.profitDashboard,
    executive: buildExecutiveAnalytics({
      snapshot: bundle.snapshot,
      profitDashboard: bundle.profitDashboard,
      executiveSummary: dashboard.storeManager?.executiveSummary ?? null,
      trends: dashboard.storeManager?.trends ?? null,
    }),
    marketing: buildMarketingCampaigns(bundle.snapshot),
    traffic: buildTrafficAnalytics(bundle.snapshot),
    funnel: buildFunnelAnalyticsLegacy(bundle.snapshot),
  };
});

export async function buildAnalyticsContext() {
  return buildFullAnalyticsContext();
}

export type ExecutivePageData = ExecutiveAdvisorView & {
  syncedAt: string;
  dailyPlaybook: DailyAiPlaybook;
  executiveFocus: ExecutiveFocusSummary;
  ceoOs: ExecutiveCeoOsLayer;
  integrationReadiness: IntegrationReadiness;
};

function attachCeoOsLayer(
  page: Omit<ExecutivePageData, "ceoOs">,
  decisions: import("@/lib/decisions/center").DecisionItem[],
  previousVisit: import("@/lib/analytics/executive-visit").ExecutiveVisitSnapshot | null,
): ExecutivePageData {
  const ir = page.integrationReadiness;
  const ceoOs = buildExecutiveCeoOsLayer({
    priorityAction: page.priorityAction,
    executiveFocus: page.executiveFocus,
    dailyPlaybook: page.dailyPlaybook,
    aiBehavior: page.aiBehavior,
    decisions,
    executiveMode: page.executiveMode,
    previousVisit,
    connectedSources: {
      shopify: ir.shopifyConnected,
      metaAds: ir.metaConnected,
      googleAds: ir.googleConnected,
      ga4: ir.googleConnected,
      inventory: true,
      customers: true,
    },
  });
  return { ...page, ceoOs };
}

function attachUnifiedLayer(
  view: ExecutiveAdvisorView,
  snapshot: import("@/lib/connectors/types").StoreSnapshot,
  profitDashboard: import("@/lib/profit/types").ProfitDashboard | null | undefined,
  syncedAt: string,
  businessProfile?: import("@/lib/business-model/types").MerchantBusinessProfile | null,
): Omit<ExecutivePageData, "ceoOs"> {
  const unified = buildExecutiveUnifiedLayer({
    snapshot,
    profitDashboard,
    storeHealth: view.storeHealth,
    topThreatLabel: view.executiveMode.biggestThreat.label,
    businessProfile,
  });
  const integrationReadiness = buildIntegrationReadiness({ snapshot });
  return {
    ...view,
    syncedAt,
    dailyPlaybook: unified.dailyPlaybook,
    executiveFocus: unified.executiveFocus,
    integrationReadiness,
  };
}

const EMPTY_OPPORTUNITY_HISTORY = {
  total: 0,
  detected: 0,
  viewed: 0,
  ignored: 0,
  resolved: 0,
  expired: 0,
  actionRate: 0,
} as const;

/** Demo fallback when live store/dashboard loading fails in production. */
export async function buildDemoExecutivePageData(): Promise<ExecutivePageData> {
  const scenarioId = await getActiveDemoScenarioId();
  const snapshot = buildDemoSnapshot(scenarioId);
  const profitDashboard = computeProfitDashboard(snapshot, []);
  const storeHealth = computeStoreHealthScore({
    snapshot,
    profitDashboard,
    productIntelligence: null,
    attributionDashboard: null,
    activeRecommendations: [],
  });
  const experienceInput = {
    snapshot,
    profitDashboard,
    executiveSummary: null,
    trends: null,
    decisions: [],
    opportunityFeed: [],
    priorityQueue: [],
    morningBrief: null,
    predictiveInsights: [],
    storeHealth,
  };
  const view = buildExecutiveAdvisorView({
    snapshot,
    profitDashboard,
    trends: null,
    decisions: [],
    activityFeed: [],
    autopilot: null,
    morningBrief: null,
      opportunityHistory: EMPTY_OPPORTUNITY_HISTORY,
      experienceInput,
      businessProfile: null,
    });
  const base = attachUnifiedLayer(view, snapshot, profitDashboard, snapshot.syncedAt);
  const previousVisit = await readExecutiveVisitSnapshot();
  return attachCeoOsLayer(base, [], previousVisit);
}

export async function buildExecutivePageData(): Promise<ExecutivePageData> {
  try {
    const timings: Record<string, number> = {};
    const t0 = performance.now();

    const [bundle, live] = await profileServerAsync("executive-bundle+live", async () =>
      Promise.all([getCachedStoreBundle(), getLiveExecutiveBundle()]),
    );
    timings["bundle+live"] = Math.round(performance.now() - t0);

    const useLiveExtras = live != null && live.storeId === bundle.storeId;
    const fingerprint = fingerprintData({
      syncedAt: bundle.snapshot.syncedAt,
      storeId: bundle.storeId,
      liveShop: live?.shopDomain ?? null,
    });

    const base = await getOrCompute(
      `executive-page:${bundle.storeId}`,
      fingerprint,
      REFRESH_MS.executiveDashboard,
      async () => {
        const dashStart = performance.now();
        const dashboard = await getCachedDashboard(bundle.storeId, {
          snapshotOverride: bundle.snapshot,
          liveExtraOpportunities: useLiveExtras ? live.liveOpportunities : undefined,
          liveAnalyzerOutputs: useLiveExtras ? live.liveAnalyzerOutputs : undefined,
          hybridDataSources: useLiveExtras ? live.dataSources : undefined,
          readOnly: true,
          skipRecommendationSync: true,
        });
        timings.dashboard = Math.round(performance.now() - dashStart);

        const advisorStart = performance.now();
        const {
          listExecutiveMemoryEvents,
          executiveMemoryEventsToItems,
        } = await import("@/lib/db/executive-memory");
        const persistedEvents = await listExecutiveMemoryEvents(bundle.storeId, 12);
        const persistedMemory = executiveMemoryEventsToItems(persistedEvents);

        const view = buildExecutiveAdvisorView({
          snapshot: bundle.snapshot,
          profitDashboard: bundle.profitDashboard,
          trends: dashboard.storeManager?.trends ?? null,
          decisions: dashboard.decisionCenter ?? [],
          activityFeed: dashboard.activityFeed ?? [],
          autopilot: dashboard.autopilotDashboard ?? null,
          morningBrief: dashboard.morningBrief ?? null,
          aiPerformance: dashboard.aiPerformance,
          opportunityHistory: dashboard.opportunityHistory ?? EMPTY_OPPORTUNITY_HISTORY,
          experienceInput: {
            snapshot: bundle.snapshot,
            profitDashboard: bundle.profitDashboard,
            executiveSummary: dashboard.storeManager?.executiveSummary ?? null,
            trends: dashboard.storeManager?.trends ?? null,
            decisions: dashboard.decisionCenter ?? [],
            opportunityFeed: dashboard.storeManager?.opportunityFeed ?? [],
            priorityQueue: dashboard.storeManager?.priorityQueue ?? [],
            morningBrief: dashboard.morningBrief ?? null,
            predictiveInsights: dashboard.predictiveInsights ?? [],
            storeHealth: dashboard.storeHealth ?? null,
            metricSourceLabels: useLiveExtras ? live.dataSources.metricLabels : undefined,
          },
          businessProfile: dashboard.businessProfile,
          persistedMemory,
        });
        timings["executive-advisor"] = Math.round(performance.now() - advisorStart);

        const result = attachUnifiedLayer(
          view,
          bundle.snapshot,
          bundle.profitDashboard,
          bundle.snapshot.syncedAt,
          dashboard.businessProfile,
        );
        timings.total = Math.round(performance.now() - t0);
        logPerfSummary("Executive Dashboard", timings);
        return result;
      },
    );

    const dashboard = await getCachedDashboard(bundle.storeId, {
      snapshotOverride: bundle.snapshot,
      readOnly: true,
      skipRecommendationSync: true,
    });
    const decisions = dashboard.decisionCenter ?? [];
    const previousVisit = await readExecutiveVisitSnapshot();
    return attachCeoOsLayer(base, decisions, previousVisit);
  } catch (error) {
    logServerRenderError("buildExecutivePageData", error);
    if (allowDemoData()) {
      return await buildDemoExecutivePageData();
    }
    throw error;
  }
}

export async function buildMarketingPageData() {
  const ctx = await buildFullAnalyticsContext();
  const bundle = await getCachedStoreBundle();
  const productAttribution = buildProductAttributionDashboard(
    ctx.snapshot,
    bundle.costRecords,
    ctx.profitDashboard,
  );
  const view = buildMarketingManagerView({
    snapshot: ctx.snapshot,
    profitDashboard: ctx.profitDashboard,
    productAttribution,
    decisions: ctx.dashboard.decisionCenter ?? [],
  });
  const integrationReadiness = buildIntegrationReadiness({
    snapshot: ctx.snapshot,
    campaigns: view.campaigns,
  });
  return { ...view, syncedAt: ctx.snapshot.syncedAt, integrationReadiness };
}

export async function buildTrafficPageData() {
  const bundle = await getCachedStoreBundle();
  const view = buildTrafficManagerView({
    snapshot: bundle.snapshot,
    profitDashboard: bundle.profitDashboard,
  });
  return { ...view, syncedAt: bundle.snapshot.syncedAt };
}

export async function buildFunnelPageData() {
  const ctx = await buildLightAnalyticsContext();
  return { ...ctx.funnel, syncedAt: ctx.snapshot.syncedAt };
}

export async function buildSalesPageData() {
  const bundle = await getCachedStoreBundle();
  return buildSalesManagerView({
    snapshot: bundle.snapshot,
    profitDashboard: bundle.profitDashboard,
  });
}

export async function buildLivePageData() {
  const bundle = await getCachedStoreBundle();
  const productIntelligence = buildProductIntelligence(
    bundle.snapshot,
    bundle.costRecords,
    bundle.profitDashboard,
  );
  const attributionDashboard = buildAttributionDashboard(
    bundle.snapshot,
    bundle.profitDashboard,
  );
  const netMargin = bundle.profitDashboard?.primary.profitMarginPct ?? 38;
  const opportunities = buildCommerceOpportunities(
    bundle.snapshot,
    bundle.profitDashboard,
    [],
  );
  const inventoryForecasts = buildInventoryForecasts(bundle.snapshot.products, netMargin);
  const predictiveInsights = buildPredictiveInsights({
    snapshot: bundle.snapshot,
    profitDashboard: bundle.profitDashboard,
    attributionDashboard,
    inventoryForecasts,
  });
  const aiEvents = runContinuousMonitors({
    syncedAt: bundle.snapshot.syncedAt,
    snapshot: bundle.snapshot,
    profitDashboard: bundle.profitDashboard,
    productIntelligence,
    attributionDashboard,
    opportunities,
    predictiveInsights,
  });
  const activityFeed = aiEventsToActivityFeed(aiEvents);
  const today = bundle.profitDashboard?.periods.find((p) => p.window === "today");
  const spendToday = bundle.snapshot.adSpendSnapshot?.totalRollups.today.spend ?? 0;
  const roasToday =
    spendToday > 0 && today
      ? today.revenue / spendToday
      : bundle.profitDashboard?.blendedRoas?.blendedRoas30d ?? 0;

  return {
    syncedAt: bundle.snapshot.syncedAt,
    visitorsOnline: bundle.snapshot.ga4Snapshot?.sessions30d
      ? Math.round(bundle.snapshot.ga4Snapshot.sessions30d / 48)
      : null,
    ordersToday: today?.orders ?? 0,
    revenueToday: today?.revenue ?? 0,
    profitToday: today?.netProfit ?? null,
    spendToday,
    roasToday,
    checkouts: bundle.snapshot.ga4Snapshot?.funnelEvents?.checkout30d
      ? Math.max(3, Math.round(bundle.snapshot.ga4Snapshot.funnelEvents.checkout30d / 30 / 6))
      : null,
    recentOrders: bundle.snapshot.storeMetrics.orders30d,
    activityFeed,
    aiEvents,
    requiresGa4: !bundle.snapshot.ga4Snapshot?.sessions30d,
  };
}

export async function buildLiveKpiMetrics(): Promise<
  Pick<LiveMissionControlView, "syncedAt" | "health" | "kpis" | "alerts">
> {
  const bundle = await getCachedStoreBundle();
  const raw = buildLiveRawMetricsFast(bundle);
  return buildLiveKpiUpdate(raw, bundle.profitDashboard);
}

export async function buildLiveMissionControl(): Promise<LiveMissionControlView> {
  const bundle = await getCachedStoreBundle();
  const fingerprint = liveDataFingerprint(bundle);
  return getOrCompute(
    "live-mission-control-full",
    fingerprint,
    REFRESH_MS.liveFull,
    async () => {
      const raw = await buildLivePageData();
      return buildLiveMissionControlView(raw, bundle.snapshot, bundle.profitDashboard);
    },
  );
}

export type { LiveMissionControlView };
