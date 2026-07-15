/**
 * Independent KPI recalculator — MUST NOT import from ../formulas or KPI engine.
 * Phase 3: verify StorePilot against a separate arithmetic implementation.
 */

import {
  INTEGRITY_LOCKED,
  META_ADS_30D,
  SHOPIFY_ORDERS_30D,
  type MetaCampaignRow,
  type ShopifyOrderRow,
} from "./fixtures";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function safeDiv(a: number, b: number): number | null {
  if (b === 0 || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a / b;
}

export type IndependentCommerceTotals = {
  revenue: number;
  orders: number;
  cogs: number;
  shippingCost: number;
  refunds: number;
  platformFees: number;
};

export type IndependentAdsTotals = {
  adSpend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  attributedRevenue: number;
};

export type IndependentKpis = {
  revenue: number;
  orders: number;
  cogs: number;
  shippingCost: number;
  refunds: number;
  platformFees: number;
  adSpend: number;
  purchases: number;
  customers: number;
  sessions: number;
  grossProfit: number;
  netProfit: number;
  contributionMargin: number;
  grossMarginPct: number | null;
  netMarginPct: number | null;
  blendedRoas: number | null;
  mer: number | null;
  aov: number | null;
  cpa: number | null;
  cac: number | null;
  conversionRatePct: number | null;
};

export function sumShopifyOrders(rows: ShopifyOrderRow[]): IndependentCommerceTotals {
  return {
    revenue: rows.reduce((s, r) => s + r.total_price, 0),
    orders: rows.length,
    cogs: rows.reduce((s, r) => s + r.cogs, 0),
    shippingCost: rows.reduce((s, r) => s + r.shipping_cost, 0),
    refunds: rows.reduce((s, r) => s + r.refunds, 0),
    platformFees: rows.reduce((s, r) => s + r.platform_fees, 0),
  };
}

export function sumMetaAds(rows: MetaCampaignRow[]): IndependentAdsTotals {
  return {
    adSpend: rows.reduce((s, r) => s + r.spend, 0),
    impressions: rows.reduce((s, r) => s + r.impressions, 0),
    clicks: rows.reduce((s, r) => s + r.clicks, 0),
    purchases: rows.reduce((s, r) => s + r.purchases, 0),
    attributedRevenue: rows.reduce((s, r) => s + r.attributed_revenue, 0),
  };
}

/**
 * Recalculate KPIs from raw export totals using explicit textbook formulas.
 * Intentionally duplicated — do not refactor to call StorePilot formula library.
 */
export function independentCalculateKpis(input: {
  commerce: IndependentCommerceTotals;
  ads: IndependentAdsTotals;
  customers: number;
  sessions: number;
}): IndependentKpis {
  const { commerce: c, ads: a, customers, sessions } = input;
  const grossProfit = round2(c.revenue - c.cogs);
  const netProfit = round2(
    c.revenue - c.cogs - c.shippingCost - c.refunds - c.platformFees - a.adSpend,
  );
  const contributionMargin = round2(c.revenue - c.cogs - a.adSpend);
  const grossMargin = safeDiv(grossProfit, c.revenue);
  const netMargin = safeDiv(netProfit, c.revenue);
  const roas = safeDiv(c.revenue, a.adSpend);

  return {
    revenue: c.revenue,
    orders: c.orders,
    cogs: c.cogs,
    shippingCost: c.shippingCost,
    refunds: c.refunds,
    platformFees: c.platformFees,
    adSpend: a.adSpend,
    purchases: a.purchases,
    customers,
    sessions,
    grossProfit,
    netProfit,
    contributionMargin,
    grossMarginPct: grossMargin == null ? null : round2(grossMargin * 100),
    netMarginPct: netMargin == null ? null : round2(netMargin * 100),
    blendedRoas: roas,
    mer: roas,
    aov: safeDiv(c.revenue, c.orders),
    cpa: safeDiv(a.adSpend, a.purchases),
    cac: safeDiv(a.adSpend, customers),
    conversionRatePct: (() => {
      const r = safeDiv(c.orders, sessions);
      return r == null ? null : round2(r * 100);
    })(),
  };
}

/** Run independent path on the permanent integrity fixtures */
export function independentKpisFromIntegrityFixtures(): IndependentKpis {
  const commerce = sumShopifyOrders(SHOPIFY_ORDERS_30D);
  const ads = sumMetaAds(META_ADS_30D);
  return independentCalculateKpis({
    commerce,
    ads,
    customers: INTEGRITY_LOCKED.customers,
    sessions: INTEGRITY_LOCKED.sessions,
  });
}

export function shopifyOrdersToCsv(rows: ShopifyOrderRow[] = SHOPIFY_ORDERS_30D): string {
  const header = "order_id,created_at,total_price,cogs,shipping_cost,refunds,platform_fees";
  const body = rows
    .map(
      (r) =>
        `${r.order_id},${r.created_at},${r.total_price},${r.cogs},${r.shipping_cost},${r.refunds},${r.platform_fees}`,
    )
    .join("\n");
  return `${header}\n${body}\n`;
}

export function metaAdsToCsv(rows: MetaCampaignRow[] = META_ADS_30D): string {
  const header = "campaign_id,campaign_name,spend,impressions,clicks,purchases,attributed_revenue";
  const body = rows
    .map(
      (r) =>
        `${r.campaign_id},${r.campaign_name},${r.spend},${r.impressions},${r.clicks},${r.purchases},${r.attributed_revenue}`,
    )
    .join("\n");
  return `${header}\n${body}\n`;
}
