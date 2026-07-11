import type { AdvertisingCampaignRow, AdvertisingWorkspaceView } from "@/lib/advertising/types";
import { buildAccountWideSummary } from "@/lib/advertising/build-account-summary";
import type { CampaignEntitlements, CampaignAccessStatus, StorePlanId } from "./types";
import { FREE_DEEP_ANALYSIS_CAMPAIGNS, PLAN_LABELS, PLAN_LIMITS, getUpgradePlan } from "./plans";

export function resolveStorePlan(): StorePlanId {
  const fromEnv = process.env.STOREPILOT_PLAN?.toLowerCase();
  if (fromEnv === "starter" || fromEnv === "pro") return "starter";
  if (fromEnv === "free") return "free";
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
  if (entitlements.isUnlimited || entitlements.lockedCampaignCount === 0) {
    return "";
  }
  return `We scanned all ${entitlements.scannedCampaignCount} campaigns. Deep AI analysis is currently available for ${entitlements.unlockedCampaignName || "one campaign"}. Upgrade to ${entitlements.upgradePlanLabel} to unlock detailed AI reasoning, simulations, and optimization packages for every campaign.`;
}

export function buildAnalysisScopeNotice(entitlements: CampaignEntitlements): string {
  if (entitlements.isUnlimited) return "";
  return `We scanned all ${entitlements.scannedCampaignCount} campaigns and generated an account-wide health assessment. Deep AI analysis is currently available for ${entitlements.unlockedCampaignName || "one campaign"}. Upgrade to unlock detailed AI reasoning for every campaign.`;
}

export function buildLockedCampaignMessage(entitlements: CampaignEntitlements): {
  headline: string;
  body: string;
  features: readonly string[];
  upgradeLabel: string;
} {
  return {
    headline: "Deep AI analysis available in Starter",
    body: `Overview metrics are included for every campaign on ${entitlements.planLabel}. Upgrade to ${entitlements.upgradePlanLabel} to unlock:`,
    features: [
      "Root cause analysis",
      "Creative intelligence",
      "Audience analysis",
      "AI timelines & simulations",
      "Optimization packages",
    ],
    upgradeLabel: `Unlock deep analysis in ${entitlements.upgradePlanLabel}`,
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
        ? `${lockedRecommendationCount} additional deep optimization package${lockedRecommendationCount === 1 ? "" : "s"} available in ${entitlements.upgradePlanLabel}.`
        : undefined,
    },
  };
}
