import type { GA4Snapshot } from "@/lib/integrations/types";
import { runGa4Report, metricTotal } from "./api";

const DATE_30D = [{ startDate: "30daysAgo", endDate: "today" }];

function formatGa4Date(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

/** Returns true when GA4 purchase events align with Shopify order volume (±25%). */
export function verifyGa4FunnelEvents(
  funnelPurchases: number,
  shopifyOrders30d?: number,
): boolean {
  return (
    shopifyOrders30d != null &&
    shopifyOrders30d > 0 &&
    funnelPurchases > 0 &&
    Math.abs(funnelPurchases - shopifyOrders30d) / shopifyOrders30d < 0.25
  );
}

export async function fetchGa4Snapshot(
  accessToken: string,
  propertyId: string,
  shopifyOrders30d?: number,
): Promise<GA4Snapshot> {
  const trafficReport = await runGa4Report(accessToken, propertyId, {
    dateRanges: DATE_30D,
    metrics: [
      { name: "sessions" },
      { name: "totalUsers" },
      { name: "newUsers" },
      { name: "engagedSessions" },
      { name: "engagementRate" },
      { name: "averageSessionDuration" },
      { name: "ecommercePurchases" },
      { name: "purchaseRevenue" },
      { name: "transactions" },
      { name: "sessionConversionRate" },
    ],
  });

  const sessions30d = metricTotal(trafficReport, 0);
  const users30d = metricTotal(trafficReport, 1);
  const newUsers30d = metricTotal(trafficReport, 2);
  const engagedSessions30d = metricTotal(trafficReport, 3);
  const engagementRate = metricTotal(trafficReport, 4);
  const avgSessionDurationSec = metricTotal(trafficReport, 5);
  const purchases30d = metricTotal(trafficReport, 6);
  const purchaseRevenue30d = metricTotal(trafficReport, 7);
  const transactions30d = metricTotal(trafficReport, 8);
  const ecommerceConversionRate = metricTotal(trafficReport, 9);

  const returningUsers30d = Math.max(0, users30d - newUsers30d);
  const returningUserRatePct =
    users30d > 0 ? Math.round((returningUsers30d / users30d) * 1000) / 10 : 0;

  const sourceReport = await runGa4Report(accessToken, propertyId, {
    dateRanges: DATE_30D,
    dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }, { name: "sessionCampaignName" }],
    metrics: [
      { name: "sessions" },
      { name: "purchaseRevenue" },
      { name: "ecommercePurchases" },
    ],
    limit: "50",
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  });

  const sourceMedium = (sourceReport.rows ?? []).map((row) => ({
    source: row.dimensionValues?.[0]?.value ?? "(not set)",
    medium: row.dimensionValues?.[1]?.value ?? "(not set)",
    campaign: row.dimensionValues?.[2]?.value ?? "(not set)",
    sessions: Number(row.metricValues?.[0]?.value) || 0,
    revenue: Number(row.metricValues?.[1]?.value) || 0,
    conversions: Number(row.metricValues?.[2]?.value) || 0,
  }));

  const landingReport = await runGa4Report(accessToken, propertyId, {
    dateRanges: DATE_30D,
    dimensions: [{ name: "landingPagePlusQueryString" }],
    metrics: [{ name: "sessions" }, { name: "purchaseRevenue" }],
    limit: "20",
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  });

  const landingPages = (landingReport.rows ?? []).map((row) => ({
    path: row.dimensionValues?.[0]?.value ?? "/",
    sessions: Number(row.metricValues?.[0]?.value) || 0,
    revenue: Number(row.metricValues?.[1]?.value) || 0,
  }));

  const deviceReport = await runGa4Report(accessToken, propertyId, {
    dateRanges: DATE_30D,
    dimensions: [{ name: "deviceCategory" }],
    metrics: [{ name: "sessions" }, { name: "purchaseRevenue" }],
    limit: "10",
  });

  const devices = (deviceReport.rows ?? []).map((row) => ({
    device: row.dimensionValues?.[0]?.value ?? "unknown",
    sessions: Number(row.metricValues?.[0]?.value) || 0,
    revenue: Number(row.metricValues?.[1]?.value) || 0,
  }));

  const countryReport = await runGa4Report(accessToken, propertyId, {
    dateRanges: DATE_30D,
    dimensions: [{ name: "country" }],
    metrics: [{ name: "sessions" }, { name: "purchaseRevenue" }],
    limit: "20",
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  });

  const countries = (countryReport.rows ?? []).map((row) => ({
    country: row.dimensionValues?.[0]?.value ?? "Unknown",
    sessions: Number(row.metricValues?.[0]?.value) || 0,
    revenue: Number(row.metricValues?.[1]?.value) || 0,
  }));

  const channelReport = await runGa4Report(accessToken, propertyId, {
    dateRanges: DATE_30D,
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }, { name: "purchaseRevenue" }],
    limit: "15",
  });

  const channelGroups = (channelReport.rows ?? []).map((row) => ({
    channel: row.dimensionValues?.[0]?.value ?? "Unknown",
    sessions: Number(row.metricValues?.[0]?.value) || 0,
    revenue: Number(row.metricValues?.[1]?.value) || 0,
  }));

  const dailyReport = await runGa4Report(accessToken, propertyId, {
    dateRanges: DATE_30D,
    dimensions: [{ name: "date" }],
    metrics: [{ name: "sessions" }],
    limit: "31",
  });

  const dailySessions = (dailyReport.rows ?? [])
    .map((row) => ({
      date: formatGa4Date(row.dimensionValues?.[0]?.value ?? ""),
      sessions: Number(row.metricValues?.[0]?.value) || 0,
    }))
    .filter((d) => d.date.length >= 8)
    .sort((a, b) => a.date.localeCompare(b.date));

  const campaignAgg = new Map<string, { campaign: string; sessions: number; revenue: number }>();
  for (const r of sourceMedium) {
    const key = r.campaign || "(not set)";
    const cur = campaignAgg.get(key) ?? { campaign: key, sessions: 0, revenue: 0 };
    cur.sessions += r.sessions;
    cur.revenue += r.revenue;
    campaignAgg.set(key, cur);
  }

  const funnelReport = await runGa4Report(accessToken, propertyId, {
    dateRanges: DATE_30D,
    metrics: [
      { name: "sessions" },
      { name: "itemsViewed" },
      { name: "addToCarts" },
      { name: "checkouts" },
      { name: "ecommercePurchases" },
    ],
  });

  const productViews30d = metricTotal(funnelReport, 1);
  const addToCart30d = metricTotal(funnelReport, 2);
  const checkout30d = metricTotal(funnelReport, 3);
  const funnelPurchases = metricTotal(funnelReport, 4);

  const verified = verifyGa4FunnelEvents(funnelPurchases, shopifyOrders30d);

  return {
    sessions30d,
    users30d,
    newUsers30d,
    returningUsers30d,
    returningUserRatePct,
    engagedSessions30d,
    engagementRatePct: Math.round(engagementRate * 1000) / 10,
    avgSessionDurationSec,
    purchases30d,
    purchaseRevenue30d,
    transactions30d,
    ecommerceConversionRatePct: Math.round(ecommerceConversionRate * 1000) / 10,
    landingPages,
    sourceMedium,
    utmCampaigns: [...campaignAgg.values()].sort((a, b) => b.sessions - a.sessions).slice(0, 20),
    devices,
    countries,
    channelGroups,
    dailySessions,
    funnelEvents: {
      productViews30d,
      addToCart30d,
      checkout30d,
      purchases30d: funnelPurchases,
      verified,
    },
    syncedAt: new Date().toISOString(),
    syncWindowDays: 30,
  };
}
