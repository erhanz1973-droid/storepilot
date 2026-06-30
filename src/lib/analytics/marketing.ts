import type { StoreSnapshot } from "@/lib/connectors/types";
import type { MarketingCampaignRow } from "@/lib/analytics/types";

function rowFromMeta(c: StoreSnapshot["campaigns"][0]): MarketingCampaignRow {
  const clicks = c.clicks7d ?? Math.round(c.impressions7d * (c.ctr7d / 100));
  const purchases = c.conversions7d ?? 0;
  const spend = c.spend7d;
  const revenue = c.revenue7d;
  const profit = c.profit7d ?? 0;
  const margin = revenue > 0 && c.profit7d != null ? (profit / revenue) * 100 : 0;

  return {
    id: c.id,
    channel: "meta",
    campaign: c.name,
    status: c.effectiveStatus,
    spend,
    impressions: c.impressions7d,
    reach: c.reach7d ?? Math.round(c.impressions7d / Math.max(c.frequency7d, 1)),
    clicks,
    ctr: c.ctr7d,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: c.impressions7d > 0 ? (spend / c.impressions7d) * 1000 : 0,
    purchases,
    cpa: purchases > 0 ? spend / purchases : 0,
    revenue,
    roas: c.roas7d,
    profit,
    margin,
    profitEstimated: c.profit7d == null,
  };
}

function rowFromGoogle(c: NonNullable<StoreSnapshot["googleAdsSnapshot"]>["campaigns"][0]): MarketingCampaignRow {
  const spend = c.spend7d;
  const revenue = c.revenue7d;
  const clicks = c.clicks7d;
  const impressions = c.impressions7d;
  const purchases = c.conversions7d;

  return {
    id: c.id,
    channel: "google",
    campaign: c.name,
    status: c.status,
    spend,
    impressions,
    reach: impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    purchases,
    cpa: purchases > 0 ? spend / purchases : 0,
    revenue,
    roas: c.roas7d,
    profit: 0,
    margin: 0,
    profitEstimated: true,
  };
}

function rowFromTikTok(c: NonNullable<StoreSnapshot["tiktokAdsSnapshot"]>["campaigns"][0]): MarketingCampaignRow {
  const spend = c.spend7d;
  const revenue = c.revenue7d;
  const clicks = c.clicks7d;
  const impressions = c.impressions7d;
  const purchases = c.conversions7d;

  return {
    id: c.id,
    channel: "tiktok",
    campaign: c.name,
    status: "ACTIVE",
    spend,
    impressions,
    reach: impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    purchases,
    cpa: purchases > 0 ? spend / purchases : 0,
    revenue,
    roas: c.roas7d,
    profit: 0,
    margin: 0,
    profitEstimated: true,
  };
}

export function buildMarketingCampaigns(snapshot: StoreSnapshot): MarketingCampaignRow[] {
  const rows: MarketingCampaignRow[] = [
    ...snapshot.campaigns.map(rowFromMeta),
    ...(snapshot.googleAdsSnapshot?.campaigns ?? []).map(rowFromGoogle),
    ...(snapshot.tiktokAdsSnapshot?.campaigns ?? []).map(rowFromTikTok),
  ];
  return rows.sort((a, b) => b.spend - a.spend);
}

export function filterMarketingByChannel(
  rows: MarketingCampaignRow[],
  channel: "meta" | "google" | "tiktok" | "pinterest",
): MarketingCampaignRow[] {
  if (channel === "pinterest") return [];
  return rows.filter((r) => r.channel === channel);
}
