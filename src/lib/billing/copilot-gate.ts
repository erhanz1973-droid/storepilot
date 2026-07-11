import type { CampaignEntitlements } from "./types";
import { campaignMatchesName } from "./campaign-selection";
import { isCampaignUnlocked } from "./entitlements";
import type { CopilotStructuredResponse } from "@/lib/copilot/types";

export type CopilotCampaignGateResult =
  | { blocked: false }
  | {
      blocked: true;
      campaignName: string;
      message: string;
      upgradePlanLabel: string;
      unlockedCampaignName: string;
    };

export function checkCopilotCampaignAccess(
  question: string,
  campaigns: { id: string; campaign: string }[],
  entitlements: CampaignEntitlements,
): CopilotCampaignGateResult {
  if (entitlements.isUnlimited) return { blocked: false };

  const match = campaignMatchesName(campaigns, question);
  if (!match) return { blocked: false };

  if (isCampaignUnlocked(match.id, entitlements)) {
    return { blocked: false };
  }

  return {
    blocked: true,
    campaignName: match.campaign,
    upgradePlanLabel: entitlements.upgradePlanLabel,
    unlockedCampaignName: entitlements.unlockedCampaignName,
    message: `Deep AI analysis for ${match.campaign} is available in ${entitlements.upgradePlanLabel}. Every campaign is scanned on Free — upgrade for root cause analysis, simulations, and optimization packages.`,
  };
}

export function buildCopilotPlanBlockedResponse(
  gate: Extract<CopilotCampaignGateResult, { blocked: true }>,
): CopilotStructuredResponse {
  return {
    intent: "plan_campaign_locked",
    summary: gate.message,
    evidence: [],
    confidencePct: 90,
    recommendations: [],
    businessImpact: {
      label: "Upgrade to unlock campaign analysis",
      calculable: false,
      reasonIfNot: `${gate.campaignName} requires ${gate.upgradePlanLabel}.`,
    },
    relatedInsights: [],
    dataSourcesUsed: ["meta_ads", "google_ads"],
    whyItHappened: `${gate.campaignName} is visible in your account scan. The Free plan includes deep AI for ${gate.unlockedCampaignName} only. Upgrade to ${gate.upgradePlanLabel} for deep analysis on every campaign.`,
  };
}
