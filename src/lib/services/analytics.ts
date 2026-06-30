import { cache } from "react";
import { buildExecutiveAnalytics } from "@/lib/analytics/executive";
import { buildExecutiveAdvisorView } from "@/lib/analytics/executive-advisor";
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
import { getOrCompute } from "@/lib/performance/compute-cache";
import { REFRESH_MS } from "@/lib/performance/refresh-schedules";
import type { LiveMissionControlView } from "@/lib/live/mission-control-types";
import { buildSalesManagerView } from "@/lib/analytics/sales-manager";
import { buildTrafficManagerView } from "@/lib/analytics/traffic-manager";
import { getCachedDashboard } from "@/lib/services/dashboard";
import {
  getCachedActiveStoreId,
  getCachedStoreBundle,
} from "@/lib/services/store-bundle";

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

export async function buildExecutivePageData() {
  const ctx = await buildFullAnalyticsContext();
  const view = buildExecutiveAdvisorView({
    snapshot: ctx.snapshot,
    profitDashboard: ctx.profitDashboard,
    trends: ctx.dashboard.storeManager?.trends ?? null,
    decisions: ctx.dashboard.decisionCenter ?? [],
    activityFeed: ctx.dashboard.activityFeed ?? [],
    autopilot: ctx.dashboard.autopilotDashboard ?? null,
    morningBrief: ctx.dashboard.morningBrief ?? null,
    aiPerformance: ctx.dashboard.aiPerformance,
    opportunityHistory: ctx.dashboard.opportunityHistory ?? {
      total: 0,
      detected: 0,
      viewed: 0,
      ignored: 0,
      resolved: 0,
      expired: 0,
      actionRate: 0,
    },
    experienceInput: {
      snapshot: ctx.snapshot,
      profitDashboard: ctx.profitDashboard,
      executiveSummary: ctx.dashboard.storeManager?.executiveSummary ?? null,
      trends: ctx.dashboard.storeManager?.trends ?? null,
      decisions: ctx.dashboard.decisionCenter ?? [],
      opportunityFeed: ctx.dashboard.storeManager?.opportunityFeed ?? [],
      priorityQueue: ctx.dashboard.storeManager?.priorityQueue ?? [],
      morningBrief: ctx.dashboard.morningBrief ?? null,
      predictiveInsights: ctx.dashboard.predictiveInsights ?? [],
      storeHealth: ctx.dashboard.storeHealth ?? null,
    },
  });
  return { ...view, syncedAt: ctx.snapshot.syncedAt };
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
  return { ...view, syncedAt: ctx.snapshot.syncedAt };
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
