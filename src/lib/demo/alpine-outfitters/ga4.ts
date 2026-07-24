import type { GA4Snapshot } from "@/lib/integrations/types";
import { ALPINE_OUTFITTERS } from "./constants";

/** Fixed demo “today” so chart dates stay stable across refreshes within a build. */
const DEMO_TODAY_UTC = Date.UTC(2026, 6, 20);

function dateDaysAgo(daysAgo: number): string {
  return new Date(DEMO_TODAY_UTC - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

export function alpineOutfittersGA4Snapshot(): GA4Snapshot {
  const sessions = ALPINE_OUTFITTERS.sessions30d;
  const users = ALPINE_OUTFITTERS.users30d;
  const returningUsers = Math.round(users * (ALPINE_OUTFITTERS.returningVisitorPct / 100));
  const newUsers = users - returningUsers;

  return {
    sessions30d: sessions,
    users30d: users,
    newUsers30d: newUsers,
    returningUsers30d: returningUsers,
    returningUserRatePct: ALPINE_OUTFITTERS.returningVisitorPct,
    engagedSessions30d: Math.round(sessions * 0.68),
    engagementRatePct: 68,
    avgSessionDurationSec: 178,
    purchases30d: ALPINE_OUTFITTERS.orders30d,
    purchaseRevenue30d: ALPINE_OUTFITTERS.revenue30d,
    transactions30d: ALPINE_OUTFITTERS.orders30d,
    ecommerceConversionRatePct: ALPINE_OUTFITTERS.conversionRatePct,
    syncedAt: "2026-07-20T12:00:00.000Z",
    syncWindowDays: 30,
    landingPages: [
      { path: "/collections/jackets-shells", sessions: 11_200, revenue: 24_800 },
      { path: "/products/alpine-waterproof-jacket", sessions: 8_600, revenue: 18_400 },
      { path: "/", sessions: 9_100, revenue: 12_600 },
      { path: "/collections/packs-bags", sessions: 6_400, revenue: 11_200 },
      { path: "/products/summit-backpack-35l", sessions: 5_200, revenue: 9_800 },
      { path: "/collections/trail-accessories", sessions: 4_800, revenue: 5_650 },
    ],
    sourceMedium: [
      {
        source: "google",
        medium: "cpc",
        campaign: "outdoor_apparel_search",
        sessions: 12_800,
        revenue: 23_600,
        conversions: 286,
      },
      {
        source: "facebook",
        medium: "paid",
        campaign: "prospecting_lookalike",
        sessions: 10_400,
        revenue: 21_200,
        conversions: 248,
      },
      {
        source: "instagram",
        medium: "paid",
        campaign: "brand_alpine",
        sessions: 5_600,
        revenue: 8_400,
        conversions: 98,
      },
      {
        source: "google",
        medium: "organic",
        campaign: "(organic)",
        sessions: 9_800,
        revenue: 12_400,
        conversions: 168,
      },
      {
        source: "(direct)",
        medium: "(none)",
        campaign: "(direct)",
        sessions: 8_200,
        revenue: 9_600,
        conversions: 142,
      },
      {
        source: "klaviyo",
        medium: "email",
        campaign: "welcome_flow",
        sessions: 4_000,
        revenue: 7_250,
        conversions: 112,
      },
      {
        source: "tiktok",
        medium: "paid",
        campaign: "trail_ugc",
        sessions: 4_000,
        revenue: 5_000,
        conversions: 54,
      },
    ],
    utmCampaigns: [
      { campaign: "prospecting_lookalike", sessions: 10_400, revenue: 21_200 },
      { campaign: "outdoor_apparel_search", sessions: 12_800, revenue: 23_600 },
      { campaign: "brand_alpine", sessions: 5_600, revenue: 8_400 },
      { campaign: "welcome_flow", sessions: 4_000, revenue: 7_250 },
    ],
    channelGroups: [
      { channel: "Paid Search", sessions: 12_800, revenue: 23_600 },
      { channel: "Paid Social", sessions: 20_000, revenue: 29_600 },
      { channel: "Organic Search", sessions: 9_800, revenue: 12_400 },
      { channel: "Direct", sessions: 8_200, revenue: 9_600 },
      { channel: "Email", sessions: 4_000, revenue: 7_250 },
    ],
    dailySessions: Array.from({ length: 30 }, (_, i) => {
      const base = Math.round(sessions / 30);
      const wave = 0.88 + Math.sin(i * 0.38) * 0.1 + i * 0.004;
      return {
        date: dateDaysAgo(29 - i),
        sessions: Math.max(800, Math.round(base * wave)),
      };
    }),
    devices: [
      { device: "mobile", sessions: 34_000, revenue: 48_200 },
      { device: "desktop", sessions: 17_400, revenue: 28_900 },
      { device: "tablet", sessions: 3_400, revenue: 5_350 },
    ],
    countries: [
      { country: "US", sessions: 45_200, revenue: 69_800 },
      { country: "CA", sessions: 6_100, revenue: 8_400 },
      { country: "UK", sessions: 3_500, revenue: 4_250 },
    ],
    funnelEvents: {
      productViews30d: 31_200,
      addToCart30d: 8_640,
      checkout30d: 3_920,
      purchases30d: ALPINE_OUTFITTERS.orders30d,
      verified: true,
    },
  };
}
