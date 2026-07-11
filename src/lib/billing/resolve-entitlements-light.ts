import type { AdvertisingCampaignRow } from "@/lib/advertising/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import {
  buildCampaignEntitlements,
  resolveStorePlan,
} from "@/lib/billing/entitlements";
import { resolveUnlockedCampaignIdFromCookie } from "@/lib/billing/entitlements-server";
import { getCachedStoreBundle } from "@/lib/services/store-bundle";

/** Minimal campaign rows for plan entitlements — avoids full advertising workspace build. */
function campaignRowsFromSnapshot(snapshot: StoreSnapshot): AdvertisingCampaignRow[] {
  return snapshot.campaigns.map((c) => ({
    id: c.id,
    campaign: c.name,
    platform: "meta",
    platformLabel: "Meta Ads",
    status: c.status ?? "ACTIVE",
    healthScore: 50,
    healthTier: "needs_review",
    spend: c.spend7d ?? 0,
    revenue: c.revenue7d ?? 0,
    profit: (c.revenue7d ?? 0) - (c.spend7d ?? 0),
    roas: c.roas7d ?? 0,
    breakEvenRoas: null,
    trend: "flat",
    recommendation: "scale",
    recommendationLabel: "Review",
    expectedOpportunityMonthly: Math.max(0, (c.revenue7d ?? 0) - (c.spend7d ?? 0)),
    riskLevel: "Medium",
    channel: "meta",
    analysisStatus: "deep" as const,
    aiScore: 50,
    nextAction: "Review campaign",
  }));
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
