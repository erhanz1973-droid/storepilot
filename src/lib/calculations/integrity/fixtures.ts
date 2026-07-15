/**
 * Fixed Shopify + Meta fixtures for Financial Integrity Suite.
 * Hand-designed so every total is exact and re-derivable from the CSV rows.
 *
 * Locked window totals (last 30d, USD):
 *   Revenue $52,340 | COGS $22,100 | Shipping $4,100 | Fees $720 | Ad Spend $12,100
 *   Gross Profit $30,240 | Net Profit $13,320 | ROAS/MER ≈ 4.3256
 */

export const INTEGRITY_LOCKED = {
  currency: "USD",
  window: "last30d",
  revenue: 52_340,
  orders: 10,
  cogs: 22_100,
  shippingCost: 4_100,
  refunds: 0,
  platformFees: 720,
  adSpend: 12_100,
  purchases: 190,
  customers: 280,
  sessions: 14_200,
  impressions: 410_000,
  clicks: 12_800,
  attributedRevenue: 40_100,
  grossProfit: 30_240, // 52340 − 22100
  netProfit: 13_320, // 52340 − 22100 − 4100 − 0 − 720 − 12100
  contributionMargin: 18_140, // 52340 − 22100 − 12100
  grossMarginPct: 57.78, // round2(30240/52340*100)
  netMarginPct: 25.45, // round2(13320/52340*100)
  blendedRoas: 52340 / 12100, // exact ratio
  mer: 52340 / 12100,
  aov: 52340 / 10, // 5234
  cpa: 12100 / 190,
  cac: 12100 / 280,
  conversionRatePct: 0.07, // round2(10/14200*100) = 0.07
  /** Decision impact locked to Prospecting Broad pause label */
  businessRecovery: 6168,
  netProfitImpact: 636,
  campaignLabel:
    "If accepted, estimated cost savings ~$6,168–$11,102/mo (~$636/mo profit preserved).",
} as const;

/** Shopify order export rows — totals must equal INTEGRITY_LOCKED commerce fields */
export type ShopifyOrderRow = {
  order_id: string;
  created_at: string;
  total_price: number;
  cogs: number;
  shipping_cost: number;
  refunds: number;
  platform_fees: number;
};

export const SHOPIFY_ORDERS_30D: ShopifyOrderRow[] = [
  { order_id: "1001", created_at: "2026-06-15", total_price: 5000, cogs: 2210, shipping_cost: 410, refunds: 0, platform_fees: 72 },
  { order_id: "1002", created_at: "2026-06-16", total_price: 5200, cogs: 2200, shipping_cost: 410, refunds: 0, platform_fees: 72 },
  { order_id: "1003", created_at: "2026-06-18", total_price: 4800, cogs: 2000, shipping_cost: 410, refunds: 0, platform_fees: 72 },
  { order_id: "1004", created_at: "2026-06-20", total_price: 6100, cogs: 2600, shipping_cost: 410, refunds: 0, platform_fees: 72 },
  { order_id: "1005", created_at: "2026-06-22", total_price: 4500, cogs: 1900, shipping_cost: 410, refunds: 0, platform_fees: 72 },
  { order_id: "1006", created_at: "2026-06-24", total_price: 3900, cogs: 1650, shipping_cost: 410, refunds: 0, platform_fees: 72 },
  { order_id: "1007", created_at: "2026-06-26", total_price: 7200, cogs: 3000, shipping_cost: 410, refunds: 0, platform_fees: 72 },
  { order_id: "1008", created_at: "2026-06-28", total_price: 5500, cogs: 2300, shipping_cost: 410, refunds: 0, platform_fees: 72 },
  { order_id: "1009", created_at: "2026-07-02", total_price: 4800, cogs: 2050, shipping_cost: 410, refunds: 0, platform_fees: 72 },
  { order_id: "1010", created_at: "2026-07-10", total_price: 5340, cogs: 2190, shipping_cost: 410, refunds: 0, platform_fees: 72 },
];

/** Meta Ads export rows — spend must equal INTEGRITY_LOCKED.adSpend */
export type MetaCampaignRow = {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  attributed_revenue: number;
};

export const META_ADS_30D: MetaCampaignRow[] = [
  { campaign_id: "m01", campaign_name: "Prospecting Broad", spend: 3200, impressions: 95_000, clicks: 2800, purchases: 28, attributed_revenue: 6200 },
  { campaign_id: "m02", campaign_name: "Prospecting Lookalike", spend: 2100, impressions: 72_000, clicks: 2100, purchases: 34, attributed_revenue: 7800 },
  { campaign_id: "m03", campaign_name: "Retargeting ATC", spend: 1800, impressions: 48_000, clicks: 1900, purchases: 42, attributed_revenue: 9100 },
  { campaign_id: "m04", campaign_name: "Retargeting View", spend: 1500, impressions: 55_000, clicks: 1600, purchases: 25, attributed_revenue: 5400 },
  { campaign_id: "m05", campaign_name: "Brand Search Mirror", spend: 900, impressions: 22_000, clicks: 980, purchases: 18, attributed_revenue: 4100 },
  { campaign_id: "m06", campaign_name: "Catalog Sales", spend: 1400, impressions: 60_000, clicks: 1700, purchases: 22, attributed_revenue: 3800 },
  { campaign_id: "m07", campaign_name: "Seasonal Promo", spend: 1200, impressions: 58_000, clicks: 1720, purchases: 21, attributed_revenue: 3700 },
];

/** Hand-calculated expected KPIs from the rows above (independent of StorePilot engine). */
export const INTEGRITY_EXPECTED_KPIS = {
  revenue: INTEGRITY_LOCKED.revenue,
  orders: INTEGRITY_LOCKED.orders,
  cogs: INTEGRITY_LOCKED.cogs,
  shippingCost: INTEGRITY_LOCKED.shippingCost,
  refunds: INTEGRITY_LOCKED.refunds,
  platformFees: INTEGRITY_LOCKED.platformFees,
  adSpend: INTEGRITY_LOCKED.adSpend,
  purchases: INTEGRITY_LOCKED.purchases,
  customers: INTEGRITY_LOCKED.customers,
  sessions: INTEGRITY_LOCKED.sessions,
  grossProfit: INTEGRITY_LOCKED.grossProfit,
  netProfit: INTEGRITY_LOCKED.netProfit,
  contributionMargin: INTEGRITY_LOCKED.contributionMargin,
  grossMarginPct: INTEGRITY_LOCKED.grossMarginPct,
  netMarginPct: INTEGRITY_LOCKED.netMarginPct,
  blendedRoas: INTEGRITY_LOCKED.blendedRoas,
  mer: INTEGRITY_LOCKED.mer,
  aov: INTEGRITY_LOCKED.aov,
  cpa: INTEGRITY_LOCKED.cpa,
  cac: INTEGRITY_LOCKED.cac,
  conversionRatePct: INTEGRITY_LOCKED.conversionRatePct,
  businessRecovery: INTEGRITY_LOCKED.businessRecovery,
  netProfitImpact: INTEGRITY_LOCKED.netProfitImpact,
} as const;
