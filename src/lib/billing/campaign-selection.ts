import type { AdvertisingCampaignRow } from "@/lib/advertising/types";

/** Pick the campaign that best demonstrates StorePilot value on Free. */
export function selectDefaultUnlockedCampaign(
  campaigns: AdvertisingCampaignRow[],
): AdvertisingCampaignRow | null {
  if (campaigns.length === 0) return null;

  const sorted = [...campaigns].sort((a, b) => {
    const opp = b.expectedOpportunityMonthly - a.expectedOpportunityMonthly;
    if (opp !== 0) return opp;
    return b.spend - a.spend;
  });

  return sorted[0] ?? null;
}

export function resolveUnlockedCampaignId(
  campaigns: AdvertisingCampaignRow[],
  preferredId?: string | null,
): string | null {
  if (campaigns.length === 0) return null;
  if (preferredId && campaigns.some((c) => c.id === preferredId)) {
    return preferredId;
  }
  return selectDefaultUnlockedCampaign(campaigns)?.id ?? campaigns[0]!.id;
}

export function campaignMatchesName(
  campaigns: { id: string; campaign: string }[],
  query: string,
): { id: string; campaign: string } | null {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return null;

  const exact = campaigns.find((c) => c.campaign.toLowerCase() === normalized);
  if (exact) return exact;

  const partial = campaigns.find(
    (c) =>
      c.campaign.toLowerCase().includes(normalized) ||
      normalized.includes(c.campaign.toLowerCase()),
  );
  return partial ?? null;
}
