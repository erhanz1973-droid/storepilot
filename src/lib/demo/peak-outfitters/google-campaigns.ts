import type { GoogleAdsSnapshot } from "@/lib/integrations/types";
import type { AdSpendRollups } from "@/lib/ads/types";

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
    last30d: bucket(30),
  };
}

/** 6 Google campaigns — 3 excellent, 2 average, 1 poor */
export function peakOutfittersGoogleAdsSnapshot(): GoogleAdsSnapshot {
  const spend7d = 2_240;
  const rev7d = 12_880;
  return {
    campaigns: [
      {
        id: "po-g-camping-search",
        name: "Camping Equipment Search",
        type: "search",
        status: "ENABLED",
        spend7d: 620,
        revenue7d: 5_146,
        roas7d: 8.3,
        impressions7d: 48_000,
        clicks7d: 2_240,
        conversions7d: 82,
      },
      {
        id: "po-g-brand",
        name: "Brand — Peak Outfitters",
        type: "search",
        status: "ENABLED",
        spend7d: 480,
        revenue7d: 2_976,
        roas7d: 6.2,
        impressions7d: 22_000,
        clicks7d: 1_680,
        conversions7d: 54,
      },
      {
        id: "po-g-shopping",
        name: "Shopping — Best Sellers",
        type: "shopping",
        status: "ENABLED",
        spend7d: 410,
        revenue7d: 2_091,
        roas7d: 5.1,
        impressions7d: 86_000,
        clicks7d: 1_420,
        conversions7d: 38,
      },
      {
        id: "po-g-boots",
        name: "Hiking Boots Search",
        type: "search",
        status: "ENABLED",
        spend7d: 320,
        revenue7d: 768,
        roas7d: 2.4,
        impressions7d: 18_000,
        clicks7d: 640,
        conversions7d: 14,
      },
      {
        id: "po-g-pmax",
        name: "Performance Max — Outdoor",
        type: "performance_max",
        status: "ENABLED",
        spend7d: 290,
        revenue7d: 580,
        roas7d: 2.0,
        impressions7d: 112_000,
        clicks7d: 980,
        conversions7d: 11,
      },
      {
        id: "po-g-generic",
        name: "Generic Outdoor Keywords",
        type: "search",
        status: "ENABLED",
        spend7d: 120,
        revenue7d: 84,
        roas7d: 0.7,
        impressions7d: 14_000,
        clicks7d: 280,
        conversions7d: 2,
      },
    ],
    adGroups: [
      { id: "po-g-ag-camping", campaignId: "po-g-camping-search", name: "Camping Equipment — Exact", spend7d: 420, revenue7d: 3_486, roas7d: 8.3 },
      { id: "po-g-ag-camping-broad", campaignId: "po-g-camping-search", name: "Camping Equipment — Broad", spend7d: 200, revenue7d: 1_660, roas7d: 8.3 },
      { id: "po-g-ag-brand", campaignId: "po-g-brand", name: "Brand Terms", spend7d: 480, revenue7d: 2_976, roas7d: 6.2 },
      { id: "po-g-ag-shopping", campaignId: "po-g-shopping", name: "Best Sellers Feed", spend7d: 410, revenue7d: 2_091, roas7d: 5.1 },
      { id: "po-g-ag-boots", campaignId: "po-g-boots", name: "Hiking Boots — High Intent", spend7d: 320, revenue7d: 768, roas7d: 2.4 },
      { id: "po-g-ag-pmax", campaignId: "po-g-pmax", name: "PMax Asset Group", spend7d: 290, revenue7d: 580, roas7d: 2.0 },
      { id: "po-g-ag-generic", campaignId: "po-g-generic", name: "Generic Outdoor", spend7d: 120, revenue7d: 84, roas7d: 0.7 },
    ],
    keywords: [
      { id: "po-g-kw-1", adGroupId: "po-g-ag-camping", text: "camping equipment", matchType: "EXACT", spend7d: 180, revenue7d: 1_494, roas7d: 8.3 },
      { id: "po-g-kw-2", adGroupId: "po-g-ag-camping", text: "hiking gear", matchType: "PHRASE", spend7d: 140, revenue7d: 962, roas7d: 6.9 },
      { id: "po-g-kw-3", adGroupId: "po-g-ag-brand", text: "peak outfitters", matchType: "EXACT", spend7d: 220, revenue7d: 1_364, roas7d: 6.2 },
      { id: "po-g-kw-4", adGroupId: "po-g-ag-boots", text: "waterproof hiking boots", matchType: "EXACT", spend7d: 160, revenue7d: 384, roas7d: 2.4 },
      { id: "po-g-kw-5", adGroupId: "po-g-ag-generic", text: "outdoor gear store", matchType: "BROAD", spend7d: 120, revenue7d: 84, roas7d: 0.7 },
    ],
    searchTerms: [
      { term: "best camping backpack", spend7d: 86, revenue7d: 714 },
      { term: "lightweight tent 2 person", spend7d: 64, revenue7d: 531 },
      { term: "peak outfitters reviews", spend7d: 42, revenue7d: 260 },
      { term: "waterproof hiking boots women", spend7d: 58, revenue7d: 139 },
      { term: "cheap outdoor gear", spend7d: 38, revenue7d: 0 },
    ],
    rollups: rollupsFromWeekly(spend7d, rev7d),
    dailySpend: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
      spend: Math.round((spend7d / 7) * (0.82 + Math.sin(i * 0.7) * 0.12) * 100) / 100,
    })),
  };
}
