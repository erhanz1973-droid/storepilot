/** Alpine Outfitters — App Store / website demo store (fictional data only). */

export const ALPINE_OUTFITTERS = {
  storeId: "00000000-0000-4000-8000-000000000001",
  name: "Alpine Outfitters",
  industry: "Premium outdoor apparel and accessories",
  country: "United States",
  currency: "USD",
  storeAgeMonths: 22,
  shopDomain: "alpine-outfitters.demo.storepilot.ai",
  plan: "Shopify Plus (Demo)",

  /** Dashboard KPIs (30d) — deterministic showcase figures */
  revenue30d: 82_450,
  netProfit30d: 16_870,
  orders30d: 1_248,
  aov: 66.1,
  conversionRatePct: 3.4,
  blendedRoas: 4.38,
  storeHealthScore: 94,
  aiConfidencePct: 98,

  sessions30d: 54_800,
  users30d: 41_900,
  returningVisitorPct: 32,
  newVisitorPct: 68,

  /** Advertising (30d) */
  metaSpend30d: 9_850,
  metaRevenue30d: 34_900,
  metaRoas: 3.54,
  googleSpend30d: 5_420,
  googleRevenue30d: 23_600,
  googleRoas: 4.35,

  /** Derived 7d rollups (exact 30d × 7/30) for campaign objects */
  metaSpend7d: 2_298,
  metaRevenue7d: 8_143,
  googleSpend7d: 1_265,
  googleRevenue7d: 5_507,

  customerCount: 18_400,
  inventoryValue: 214_600,
  businessStatus: "Healthy Growth",

  inventory: {
    fastMovers: 6,
    healthy: 9,
    lowStock: 1,
    overstock: 2,
    dead: 0,
  },

  trends: {
    revenueChangePct: 14,
    profitChangePct: 12,
    roasChangePct: 9,
    ordersChangePct: 11,
  },
} as const;

export const ALPINE_COLLECTIONS = [
  { id: "ao-jackets", title: "Jackets & Shells", productCount: 3, homepageFeatured: true, revenue30d: 23_900 },
  { id: "ao-packs", title: "Packs & Bags", productCount: 3, homepageFeatured: true, revenue30d: 16_500 },
  { id: "ao-base", title: "Base Layers", productCount: 3, homepageFeatured: false, revenue30d: 12_100 },
  { id: "ao-footwear", title: "Footwear", productCount: 2, homepageFeatured: false, revenue30d: 8_200 },
  { id: "ao-accessories", title: "Trail Accessories", productCount: 4, homepageFeatured: true, revenue30d: 14_500 },
  { id: "ao-camp", title: "Camp Essentials", productCount: 3, homepageFeatured: false, revenue30d: 7_250 },
] as const;
