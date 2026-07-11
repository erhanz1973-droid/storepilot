import type { AdvertisingCampaignRow, AdvertisingPlatformId } from "@/lib/advertising/types";
import { buildMarketingCampaigns } from "@/lib/analytics/marketing";
import type { MarketingChannel } from "@/lib/analytics/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import {
  buildCampaignEntitlements,
  resolveStorePlan,
} from "@/lib/billing/entitlements";
import { resolveUnlockedCampaignIdFromCookie } from "@/lib/billing/entitlements-server";
import { getCachedStoreBundle } from "@/lib/services/store-bundle";

const PLATFORM_LABELS: Record<AdvertisingPlatformId, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  microsoft: "Microsoft Ads",
};

const CHANNEL_TO_PLATFORM: Record<MarketingChannel, AdvertisingPlatformId> = {
  meta: "meta",
  google: "google",
  tiktok: "tiktok",
  pinterest: "pinterest",
};

/** Plan entitlements from normalized marketing campaigns — avoids full advertising workspace build. */
function campaignRowsFromSnapshot(snapshot: StoreSnapshot): AdvertisingCampaignRow[] {
  return buildMarketingCampaigns(snapshot).map((campaign, index) => {
    const platform = CHANNEL_TO_PLATFORM[campaign.channel];
    const conversionRate =
      campaign.clicks > 0
        ? Math.round((campaign.purchases / campaign.clicks) * 10000) / 100
        : 0;

    return {
      id: campaign.id,
      campaign: campaign.campaign,
      platform,
      platformLabel: PLATFORM_LABELS[platform],
      status: campaign.status,
      healthScore: 50,
      healthTier: "needs_review",
      spend: campaign.spend,
      revenue: campaign.revenue,
      profit: campaign.profit,
      roas: campaign.roas,
      cpa: campaign.cpa,
      ctr: campaign.ctr,
      conversionRate,
      breakEvenRoas: null,
      trend: "flat",
      recommendation: "scale",
      recommendationLabel: "Review",
      expectedOpportunityMonthly: Math.max(0, campaign.revenue - campaign.spend),
      riskLevel: "Medium",
      channel: campaign.channel,
      analysisStatus: "deep",
      aiScore: 50,
      priorityRank: index + 1,
      nextAction: "Review campaign",
      briefRecommendation: "Review campaign performance before scaling spend.",
    };
  });
}

export async function resolveAdvertisingEntitlements() {
  const bundle = await getCachedStoreBundle();
  const campaigns = campaignRowsFromSnapshot(bundle.snapshot);
  const planId = resolveStorePlan();
  const unlockedId = await resolveUnlockedCampaignIdFromCookie(campaigns);
  return {
    entitlements: buildCampaignEntitlements(campaigns, unlockedId, planId),
    campaigns: campaigns.map((c) => ({ id: c.id, campaign: c.campaign })),
  };
}
