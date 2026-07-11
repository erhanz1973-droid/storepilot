import {
  buildAdvertisingWorkspace,
} from "@/lib/advertising/build-workspace";
import { buildCampaignDetailPage } from "@/lib/advertising/build-campaign-detail";
import { buildAiAccountabilityLayer } from "@/lib/advertising/build-ai-accountability";
import { readAdvertisingVisitSnapshot } from "@/lib/advertising/advertising-visit";
import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { buildProductAttributionDashboard } from "@/lib/attribution/product-engine";
import { buildMarketingManagerView } from "@/lib/analytics/marketing-manager";
import {
  applyAdvertisingPlanLimits,
  buildCampaignEntitlements,
  resolveStorePlan,
} from "@/lib/billing/entitlements";
import { resolveUnlockedCampaignIdFromCookie } from "@/lib/billing/entitlements-server";
import { listRejectionFeedback } from "@/lib/db/decision-feedback";
import { listOutcomeHistory, seedDemoLearningIfNeeded } from "@/lib/db/learning";
import { allowDemoData } from "@/lib/env/runtime";
import { getCachedStoreBundle, type StoreBundle } from "@/lib/services/store-bundle";
import { buildReadOnlyDashboard } from "@/lib/services/dashboard";
import { fingerprintData, getOrCompute } from "@/lib/performance/compute-cache";
import { REFRESH_MS } from "@/lib/performance/refresh-schedules";

function getAdvertisingDashboard(bundle: StoreBundle) {
  return buildReadOnlyDashboard(bundle.storeId, bundle.snapshot);
}

async function buildAdvertisingWorkspaceCore(bundle: StoreBundle) {
  const dashboard = await getAdvertisingDashboard(bundle);

  const productAttribution = buildProductAttributionDashboard(
    bundle.snapshot,
    bundle.costRecords,
    bundle.profitDashboard,
  );

  const marketing = buildMarketingManagerView({
    snapshot: bundle.snapshot,
    profitDashboard: bundle.profitDashboard,
    productAttribution,
    decisions: dashboard.decisionCenter ?? [],
  });

  const attribution = buildAttributionDashboard(
    bundle.snapshot,
    bundle.profitDashboard,
  );

  if (!attribution) {
    throw new Error("Attribution dashboard unavailable");
  }

  const workspace = buildAdvertisingWorkspace({
    marketing,
    attribution,
    snapshot: bundle.snapshot,
    decisions: dashboard.decisionCenter ?? [],
    syncedAt: bundle.snapshot.syncedAt,
    profitDashboard: bundle.profitDashboard,
    storeId: bundle.storeId,
  });

  if (allowDemoData()) {
    await seedDemoLearningIfNeeded(bundle.storeId);
  }
  const [rejections, outcomes] = await Promise.all([
    listRejectionFeedback(bundle.storeId),
    listOutcomeHistory(bundle.storeId),
  ]);

  return {
    workspace,
    rejections,
    outcomes,
    marketing,
    attribution,
    decisions: dashboard.decisionCenter ?? [],
  };
}

export async function buildAdvertisingPageData() {
  const bundle = await getCachedStoreBundle();
  const previousVisit = await readAdvertisingVisitSnapshot();
  const fingerprint = fingerprintData({
    storeId: bundle.storeId,
    syncedAt: bundle.snapshot.syncedAt,
  });

  const core = await getOrCompute(
    `advertising-page:${bundle.storeId}`,
    fingerprint,
    REFRESH_MS.dashboardRead,
    () => buildAdvertisingWorkspaceCore(bundle),
  );

  const accountability = buildAiAccountabilityLayer({
    workspace: core.workspace,
    snapshot: bundle.snapshot,
    profitDashboard: bundle.profitDashboard,
    decisions: core.decisions,
    rejections: core.rejections,
    outcomes: core.outcomes,
    previousVisit,
  });

  const enriched = {
    ...core.workspace,
    accountability,
  };

  const planId = resolveStorePlan();
  const unlockedId = await resolveUnlockedCampaignIdFromCookie(enriched.campaigns);
  const entitlements = buildCampaignEntitlements(enriched.campaigns, unlockedId, planId);
  const limited = applyAdvertisingPlanLimits(enriched, entitlements);

  return { ...limited, snapshot: bundle.snapshot };
}

export async function buildCampaignDetailPageData(campaignId: string) {
  const bundle = await getCachedStoreBundle();
  const fingerprint = fingerprintData({
    storeId: bundle.storeId,
    syncedAt: bundle.snapshot.syncedAt,
  });
  const core = await getOrCompute(
    `advertising-page:${bundle.storeId}`,
    fingerprint,
    REFRESH_MS.dashboardRead,
    () => buildAdvertisingWorkspaceCore(bundle),
  );

  const planId = resolveStorePlan();
  const unlockedId = await resolveUnlockedCampaignIdFromCookie(core.workspace.campaigns);
  const entitlements = buildCampaignEntitlements(core.workspace.campaigns, unlockedId, planId);
  const limited = applyAdvertisingPlanLimits(core.workspace, entitlements);

  return buildCampaignDetailPage(campaignId, {
    workspace: limited,
    marketing: core.marketing,
    attribution: core.attribution,
    snapshot: bundle.snapshot,
    decisions: core.decisions,
    entitlements,
  });
}

export { resolveAdvertisingEntitlements } from "@/lib/billing/resolve-entitlements-light";
