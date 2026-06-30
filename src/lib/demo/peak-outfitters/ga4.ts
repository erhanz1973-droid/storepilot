import type { GA4Snapshot } from "@/lib/integrations/types";
import { PEAK_OUTFITTERS } from "./constants";

export function peakOutfittersGA4Snapshot(): GA4Snapshot {
  const sessions = PEAK_OUTFITTERS.sessions30d;
  const users = Math.round(sessions * 0.82);
  const newUsers = Math.round(users * 0.69);
  const returningUsers = users - newUsers;
  return {
    sessions30d: sessions,
    users30d: users,
    newUsers30d: newUsers,
    returningUsers30d: returningUsers,
    returningUserRatePct: (returningUsers / users) * 100,
    engagedSessions30d: Math.round(sessions * 0.64),
    engagementRatePct: 64,
    avgSessionDurationSec: 163,
    purchases30d: PEAK_OUTFITTERS.orders30d,
    purchaseRevenue30d: PEAK_OUTFITTERS.revenue30d,
    transactions30d: PEAK_OUTFITTERS.orders30d,
    ecommerceConversionRatePct: (PEAK_OUTFITTERS.orders30d / sessions) * 100,
    syncedAt: new Date().toISOString(),
    syncWindowDays: 30,
    landingPages: [
      { path: "/collections/backpacks", sessions: 12_400, revenue: 52_800 },
      { path: "/products/mountain-pro-backpack", sessions: 8_200, revenue: 35_200 },
      { path: "/", sessions: 9_600, revenue: 22_400 },
      { path: "/collections/hiking-boots", sessions: 6_800, revenue: 29_800 },
      { path: "/collections/clearance-gear", sessions: 7_400, revenue: 4_200 },
      { path: "/collections/tents", sessions: 5_200, revenue: 18_600 },
      { path: "/products/alpine-tent", sessions: 4_800, revenue: 21_250 },
    ],
    sourceMedium: [
      { source: "google", medium: "cpc", campaign: "camping_equipment", sessions: 14_200, revenue: 52_400, conversions: 186 },
      { source: "facebook", medium: "paid", campaign: "summer_hiking", sessions: 11_800, revenue: 41_600, conversions: 142 },
      { source: "instagram", medium: "paid", campaign: "brand_trail", sessions: 6_400, revenue: 15_400, conversions: 58 },
      { source: "google", medium: "organic", campaign: "(organic)", sessions: 9_200, revenue: 24_600, conversions: 98 },
      { source: "(direct)", medium: "(none)", campaign: "(direct)", sessions: 8_600, revenue: 20_800, conversions: 84 },
      { source: "klaviyo", medium: "email", campaign: "welcome_flow", sessions: 4_200, revenue: 18_200, conversions: 72 },
      { source: "tiktok", medium: "paid", campaign: "trail_ugc", sessions: 4_020, revenue: 11_250, conversions: 38 },
    ],
    utmCampaigns: [
      { campaign: "summer_hiking", sessions: 11_800, revenue: 41_600 },
      { campaign: "camping_equipment", sessions: 14_200, revenue: 52_400 },
      { campaign: "brand_trail", sessions: 6_400, revenue: 15_400 },
      { campaign: "trail_ugc", sessions: 4_020, revenue: 11_250 },
    ],
    channelGroups: [
      { channel: "Paid Search", sessions: 14_200, revenue: 52_400 },
      { channel: "Paid Social", sessions: 22_220, revenue: 68_250 },
      { channel: "Organic Search", sessions: 9_200, revenue: 24_600 },
      { channel: "Direct", sessions: 8_600, revenue: 20_800 },
      { channel: "Email", sessions: 4_200, revenue: 18_200 },
    ],
    dailySessions: Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const base = Math.round(sessions / 30);
      return {
        date: d.toISOString().slice(0, 10),
        sessions: base + (i % 5) * 120,
      };
    }),
    devices: [
      { device: "mobile", sessions: 36_220, revenue: 112_400 },
      { device: "desktop", sessions: 18_940, revenue: 58_200 },
      { device: "tablet", sessions: 3_260, revenue: 13_650 },
    ],
    countries: [
      { country: "US", sessions: 48_200, revenue: 158_400 },
      { country: "CA", sessions: 6_800, revenue: 18_200 },
      { country: "UK", sessions: 3_420, revenue: 7_650 },
    ],
    funnelEvents: {
      productViews30d: 33_840,
      addToCart30d: 10_516,
      checkout30d: 5_258,
      purchases30d: PEAK_OUTFITTERS.orders30d,
      verified: true,
    },
  };
}
