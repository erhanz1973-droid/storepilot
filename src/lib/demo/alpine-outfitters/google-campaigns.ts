import type { GoogleAdsSnapshot } from "@/lib/integrations/types";
import type { AdSpendRollups } from "@/lib/ads/types";
import { ALPINE_OUTFITTERS } from "./constants";

function rollupsFromWeekly(spend7d: number, rev7d: number): AdSpendRollups {
  const daily = spend7d / 7;
  const revDaily = rev7d / 7;
  const bucket = (days: number) => ({
    spend: Math.round(daily * days * 100) / 100,
    attributedRevenue: Math.round(revDaily * days * 100) / 100,
    orders: 0,
  });
  return {
    today: bucket(1),
    yesterday: bucket(1),
    last7d: bucket(7),
    last30d: {
      spend: ALPINE_OUTFITTERS.googleSpend30d,
      attributedRevenue: ALPINE_OUTFITTERS.googleRevenue30d,
      orders: 0,
    },
  };
}

const DEMO_TODAY_UTC = Date.UTC(2026, 6, 20);

function fixedDateOffset(daysAgo: number): string {
  return new Date(DEMO_TODAY_UTC - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Google Ads — 7d campaign totals match alpine googleSpend7d / googleRevenue7d.
 * Strong overall ROAS supports a “increase budget 15%” recommendation.
 */
export function alpineOutfittersGoogleAdsSnapshot(): GoogleAdsSnapshot {
  const spend7d = ALPINE_OUTFITTERS.googleSpend7d;
  const rev7d = ALPINE_OUTFITTERS.googleRevenue7d;
  return {
    campaigns: [
      {
        id: "ao-g-brand",
        name: "Brand — Alpine Outfitters",
        type: "search",
        status: "ENABLED",
        spend7d: 320,
        revenue7d: 1_760,
        roas7d: 5.5,
        impressions7d: 18_400,
        clicks7d: 980,
        conversions7d: 28,
      },
      {
        id: "ao-g-outdoor-search",
        name: "Outdoor Apparel Search",
        type: "search",
        status: "ENABLED",
        spend7d: 380,
        revenue7d: 1_748,
        roas7d: 4.6,
        impressions7d: 42_000,
        clicks7d: 1_420,
        conversions7d: 26,
      },
      {
        id: "ao-g-shopping",
        name: "Shopping — Bestsellers",
        type: "shopping",
        status: "ENABLED",
        spend7d: 290,
        revenue7d: 1_218,
        roas7d: 4.2,
        impressions7d: 96_000,
        clicks7d: 1_150,
        conversions7d: 18,
      },
      {
        id: "ao-g-pmax",
        name: "Performance Max — Trail Gear",
        type: "performance_max",
        status: "ENABLED",
        spend7d: 185,
        revenue7d: 611,
        roas7d: 3.3,
        impressions7d: 128_000,
        clicks7d: 840,
        conversions7d: 9,
      },
      {
        id: "ao-g-competitor",
        name: "Competitor Conquest",
        type: "search",
        status: "ENABLED",
        spend7d: 90,
        revenue7d: 170,
        roas7d: 1.89,
        impressions7d: 12_200,
        clicks7d: 310,
        conversions7d: 3,
      },
    ],
    adGroups: [
      {
        id: "ao-g-ag-brand",
        campaignId: "ao-g-brand",
        name: "Brand Exact",
        spend7d: 220,
        revenue7d: 1_210,
        roas7d: 5.5,
      },
      {
        id: "ao-g-ag-outdoor",
        campaignId: "ao-g-outdoor-search",
        name: "Jackets & Packs",
        spend7d: 280,
        revenue7d: 1_288,
        roas7d: 4.6,
      },
    ],
    keywords: [
      {
        id: "ao-g-kw-1",
        adGroupId: "ao-g-ag-brand",
        text: "alpine outfitters",
        matchType: "EXACT",
        spend7d: 120,
        revenue7d: 720,
        roas7d: 6.0,
      },
      {
        id: "ao-g-kw-2",
        adGroupId: "ao-g-ag-outdoor",
        text: "waterproof hiking jacket",
        matchType: "PHRASE",
        spend7d: 95,
        revenue7d: 456,
        roas7d: 4.8,
      },
    ],
    searchTerms: [
      { term: "alpine waterproof jacket", spend7d: 72, revenue7d: 380 },
      { term: "summit backpack 35l", spend7d: 58, revenue7d: 290 },
      { term: "merino hiking socks", spend7d: 41, revenue7d: 168 },
      { term: "trail running shoes men", spend7d: 36, revenue7d: 142 },
      { term: "cheap outdoor jackets", spend7d: 28, revenue7d: 22 },
    ],
    rollups: rollupsFromWeekly(spend7d, rev7d),
    dailySpend: Array.from({ length: 30 }, (_, i) => {
      const base = spend7d / 7;
      const wave = 0.92 + Math.sin(i * 0.41) * 0.08;
      return {
        date: fixedDateOffset(29 - i),
        spend: Math.round(base * wave * 100) / 100,
      };
    }),
  };
}

export function alpineGoogleSpend7dTotal(): number {
  return alpineOutfittersGoogleAdsSnapshot().campaigns.reduce((s, c) => s + c.spend7d, 0);
}

export function alpineGoogleRevenue7dTotal(): number {
  return alpineOutfittersGoogleAdsSnapshot().campaigns.reduce((s, c) => s + c.revenue7d, 0);
}
