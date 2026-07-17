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
    message: `Deep AI analysis for ${match.campaign} is included in StorePilot Version 1. Refresh entitlements to restore access.`,
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
      label: "Campaign analysis access",
      calculable: false,
      reasonIfNot: `${gate.campaignName} is awaiting an entitlement refresh.`,
    },
    relatedInsights: [],
    dataSourcesUsed: ["meta_ads", "google_ads"],
    whyItHappened: "Version 1 includes deep analysis for every campaign; this access state is stale.",
  };
}
