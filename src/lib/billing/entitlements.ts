import type { AdvertisingCampaignRow, AdvertisingWorkspaceView } from "@/lib/advertising/types";
import { buildAccountWideSummary } from "@/lib/advertising/build-account-summary";
import type { CampaignEntitlements, CampaignAccessStatus, StorePlanId } from "./types";
import { FREE_DEEP_ANALYSIS_CAMPAIGNS, PLAN_LABELS, PLAN_LIMITS, getUpgradePlan } from "./plans";

export function resolveStorePlan(): StorePlanId {
  // Version 1 always resolves to Free Early Access. Legacy tiers remain available
  // to the entitlement builders for future monetization work.
  return "free";
}

export function buildCampaignEntitlements(
  campaigns: AdvertisingCampaignRow[],
  unlockedCampaignId: string | null,
  planId: StorePlanId = resolveStorePlan(),
): CampaignEntitlements {
  const limits = PLAN_LIMITS[planId];
  const upgrade = getUpgradePlan(planId);
  const deepCampaign =
    limits.unlimitedCampaigns
      ? campaigns[0] ?? null
      : campaigns.find((c) => c.id === unlockedCampaignId) ??
        campaigns[0] ??
        null;

  const maxDeep = limits.unlimitedCampaigns ? campaigns.length : FREE_DEEP_ANALYSIS_CAMPAIGNS;

  return {
    planId,
    planLabel: PLAN_LABELS[planId],
    upgradePlanLabel: upgrade ? PLAN_LABELS[upgrade] : PLAN_LABELS.starter,
    maxAnalyzedCampaigns: limits.maxAnalyzedCampaigns,
    maxDeepAnalysisCampaigns: maxDeep,
    totalCampaigns: campaigns.length,
    scannedCampaignCount: campaigns.length,
    unlockedCampaignId: deepCampaign?.id ?? "",
    unlockedCampaignName: deepCampaign?.campaign ?? "",
    lockedCampaignCount: limits.unlimitedCampaigns
      ? 0
      : Math.max(0, campaigns.length - FREE_DEEP_ANALYSIS_CAMPAIGNS),
    isUnlimited: limits.unlimitedCampaigns,
  };
}

export function campaignAnalysisStatus(
  campaignId: string,
  entitlements: CampaignEntitlements,
): CampaignAccessStatus {
  if (entitlements.isUnlimited) return "deep";
  return campaignId === entitlements.unlockedCampaignId ? "deep" : "overview";
}

export function hasDeepAnalysis(
  campaignId: string | undefined | null,
  entitlements: CampaignEntitlements,
): boolean {
  if (!campaignId) return entitlements.isUnlimited;
  return campaignAnalysisStatus(campaignId, entitlements) === "deep";
}

/** @deprecated Use hasDeepAnalysis */
export function isCampaignUnlocked(
  campaignId: string | undefined | null,
  entitlements: CampaignEntitlements,
): boolean {
  return hasDeepAnalysis(campaignId, entitlements);
}

export function buildScaleUpgradeMessage(entitlements: CampaignEntitlements): string {
  if (entitlements.isUnlimited || entitlements.lockedCampaignCount === 0) return "";
  return "Full campaign analysis is included in StorePilot Version 1. Refresh entitlements to restore access.";
}

export function buildAnalysisScopeNotice(entitlements: CampaignEntitlements): string {
  if (entitlements.isUnlimited) return "";
  return "Full campaign analysis is included in StorePilot Version 1. Refresh entitlements to restore access.";
}

export function buildLockedCampaignMessage(entitlements: CampaignEntitlements): {
  headline: string;
  body: string;
  features: readonly string[];
  upgradeLabel: string;
} {
  return {
    headline: "Full analysis is included",
    body: "StorePilot Version 1 includes these features for every campaign:",
    features: [
      "Root cause analysis",
      "Creative intelligence",
      "Audience analysis",
      "AI timelines & simulations",
      "Optimization packages",
    ],
    upgradeLabel: "Full access included",
  };
}

export function applyAdvertisingPlanLimits(
  workspace: AdvertisingWorkspaceView,
  entitlements: CampaignEntitlements,
): AdvertisingWorkspaceView {
  const accountSummary = buildAccountWideSummary(workspace.campaigns);

  if (entitlements.isUnlimited) {
    return {
      ...workspace,
      accountSummary,
      campaigns: workspace.campaigns.map((c) => ({ ...c, analysisStatus: "deep" as const })),
      planUsage: entitlements,
    };
  }

  const deepId = entitlements.unlockedCampaignId;
  const isDeep = (id: string) => id === deepId;

  const campaigns = workspace.campaigns.map((c) => ({
    ...c,
    analysisStatus: campaignAnalysisStatus(c.id, entitlements),
  }));

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const blendedRoas = totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : 0;
  const avgHealth =
    campaigns.length > 0
      ? Math.round(campaigns.reduce((s, c) => s + c.healthScore, 0) / campaigns.length)
      : workspace.overview.healthScore;

  const visibleRecommendations = workspace.optimizationCenter.filter(
    (r) => !r.campaignId || isDeep(r.campaignId),
  );
  const visiblePackages = workspace.optimizationPackages.filter(
    (p) => !p.campaignId || isDeep(p.campaignId),
  );
  const lockedRecommendationCount = Math.max(
    0,
    workspace.optimizationPackages.length - visiblePackages.length,
  );

  return {
    ...workspace,
    accountSummary,
    planUsage: { ...entitlements, lockedRecommendationCount } as CampaignEntitlements & {
      lockedRecommendationCount?: number;
    },
    overview: {
      ...workspace.overview,
      healthScore: avgHealth,
      spend30d: totalSpend,
      revenue30d: totalRevenue,
      blendedRoas,
      analysisScopeNotice: buildAnalysisScopeNotice(entitlements),
    },
    campaigns,
    adSets: workspace.adSets.filter((a) => isDeep(a.campaignId)),
    ads: workspace.ads.filter((a) => isDeep(a.campaignId)),
    creatives: workspace.creatives.filter((c) =>
      campaigns.some((camp) => camp.campaign === c.campaignName && isDeep(camp.id)),
    ),
    audiences: workspace.audiences,
    optimizationCenter: visibleRecommendations,
    optimizationPackages: visiblePackages,
    timelines: workspace.timelines.filter((t) => isDeep(t.campaignId)),
    upgradeMessaging: {
      scale: buildScaleUpgradeMessage(entitlements),
      lockedRecommendationCount,
      additionalRecommendationsLabel: lockedRecommendationCount > 0
        ? `${lockedRecommendationCount} deep optimization package${lockedRecommendationCount === 1 ? "" : "s"} awaiting an entitlement refresh.`
        : undefined,
    },
  };
}
