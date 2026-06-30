/** Peak Outfitters — fictional demo store constants (not production data). */

export const PEAK_OUTFITTERS = {
  storeId: "00000000-0000-4000-8000-000000000001",
  name: "Peak Outfitters",
  industry: "Outdoor & Hiking Equipment",
  country: "United States",
  currency: "USD",
  storeAgeMonths: 18,
  shopDomain: "peak-outfitters.demo.storepilot.ai",
  plan: "Shopify Plus (Demo)",

  revenue30d: 184_250,
  netProfit30d: 42_870,
  orders30d: 1_487,
  aov: 123.9,
  sessions30d: 58_420,
  conversionRatePct: 2.54,
  returningCustomerPct: 31,
  newCustomerPct: 69,
  storeHealthScore: 82,
  businessStatus: "Healthy",

  customerCount: 1_500,
  inventoryValue: 326_000,
  clearanceRecoveryPotential: 18_500,

  inventory: {
    fastMovers: 8,
    healthy: 15,
    lowStock: 3,
    overstock: 2,
    dead: 2,
  },

  trends: {
    revenueChangePct: 11,
    profitChangePct: 7,
    roasChangePct: 16,
    ordersChangePct: 13,
  },
} as const;

export const DEMO_COLLECTIONS = [
  { id: "po-backpacks", title: "Backpacks", productCount: 4, homepageFeatured: true, revenue30d: 38_200 },
  { id: "po-tents", title: "Camping Tents", productCount: 4, homepageFeatured: false, revenue30d: 28_400 },
  { id: "po-sleeping", title: "Sleeping Bags", productCount: 3, homepageFeatured: false, revenue30d: 19_600 },
  { id: "po-bottles", title: "Water Bottles", productCount: 3, homepageFeatured: true, revenue30d: 14_800 },
  { id: "po-boots", title: "Hiking Boots", productCount: 4, homepageFeatured: false, revenue30d: 31_200 },
  { id: "po-flashlights", title: "Flashlights & Lanterns", productCount: 4, homepageFeatured: false, revenue30d: 12_400 },
  { id: "po-stoves", title: "Portable Stoves", productCount: 3, homepageFeatured: false, revenue30d: 9_800 },
  { id: "po-accessories", title: "Accessories", productCount: 5, homepageFeatured: false, revenue30d: 18_450 },
  { id: "po-clearance", title: "Clearance Gear", productCount: 4, homepageFeatured: false, revenue30d: 1_400 },
] as const;
