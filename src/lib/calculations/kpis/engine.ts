import type { ProfitDashboard } from "@/lib/profit/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { RawFacts } from "../facts/types";
import { emptyAdvertisingFacts, emptyCommerceFacts } from "../facts/types";
import {
  formulaAov,
  formulaBlendedRoas,
  formulaContributionMargin,
  formulaConversionRatePct,
  formulaGrossMarginPct,
  formulaGrossProfit,
  formulaMer,
  formulaNetMarginPct,
  formulaNetProfit,
  formulaCac,
  formulaCpa,
} from "../formulas";

const WINDOW_DAYS: Record<RawFacts["window"], number> = {
  today: 1,
  yesterday: 1,
  last7d: 7,
  last30d: 30,
  monthly: 30,
};

/**
 * Layer 2 — Business KPIs
 * Every historical business metric is computed exactly once here.
 */
export type BusinessKPIs = {
  window: RawFacts["window"];
  windowDays: number;
  currency: string;
  revenue: number;
  orders: number;
  grossProfit: number;
  netProfit: number;
  contributionMargin: number;
  grossMarginPct: number | null;
  netMarginPct: number | null;
  adSpend: number;
  blendedRoas: number | null;
  mer: number | null;
  cac: number | null;
  cpa: number | null;
  aov: number | null;
  conversionRatePct: number | null;
  refunds: number;
  cogs: number;
  shippingCost: number;
  platformFees: number;
};

export function calculateBusinessKPIs(facts: RawFacts): BusinessKPIs {
  const { commerce, advertising } = facts;
  const grossProfit = formulaGrossProfit(commerce.revenue, commerce.cogs);
  const netProfit = formulaNetProfit({
    revenue: commerce.revenue,
    cogs: commerce.cogs,
    shippingCost: commerce.shippingCost,
    refunds: commerce.refunds,
    platformFees: commerce.platformFees,
    adSpend: advertising.adSpend,
  });
  const contributionMargin = formulaContributionMargin(
    commerce.revenue,
    commerce.cogs,
    advertising.adSpend,
  );

  const customers = commerce.customers ?? commerce.orders;

  return {
    window: facts.window,
    windowDays: WINDOW_DAYS[facts.window],
    currency: facts.currency,
    revenue: commerce.revenue,
    orders: commerce.orders,
    grossProfit,
    netProfit,
    contributionMargin,
    grossMarginPct: formulaGrossMarginPct(grossProfit, commerce.revenue),
    netMarginPct: formulaNetMarginPct(netProfit, commerce.revenue),
    adSpend: advertising.adSpend,
    blendedRoas: formulaBlendedRoas(commerce.revenue, advertising.adSpend),
    mer: formulaMer(commerce.revenue, advertising.adSpend),
    cac: formulaCac(advertising.adSpend, customers),
    cpa: formulaCpa(advertising.adSpend, advertising.purchases || commerce.orders),
    aov: formulaAov(commerce.revenue, commerce.orders),
    conversionRatePct: formulaConversionRatePct(
      commerce.orders,
      commerce.sessions ?? 0,
    ),
    refunds: commerce.refunds,
    cogs: commerce.cogs,
    shippingCost: commerce.shippingCost,
    platformFees: commerce.platformFees,
  };
}

/** Build RawFacts from an existing profit dashboard (30d primary window). */
export function rawFactsFromProfitDashboard(
  dashboard: ProfitDashboard,
  partial?: Partial<RawFacts>,
): RawFacts {
  const p = dashboard.primary;
  return {
    currency: "USD",
    window: "last30d",
    commerce: {
      revenue: p.revenue,
      orders: p.orders,
      refunds: p.refunds,
      discounts: 0,
      taxes: null,
      shippingCost: p.shippingCost,
      shippingRevenue: 0,
      cogs: p.cogs,
      platformFees: p.transactionFees,
      sessions: null,
      customers: p.orders,
      inventoryUnits: null,
      inventoryValue: null,
    },
    advertising: {
      adSpend: p.adSpend,
      impressions: 0,
      clicks: 0,
      purchases: p.orders,
      attributedRevenue: p.revenue,
    },
    campaigns: [],
    products: [],
    historicalPredictionAccuracy: null,
    dataQualityScore: dashboard.confidence?.scorePct ?? null,
    ...partial,
  };
}

/** Build RawFacts from store snapshot rollups (lightweight path). */
export function rawFactsFromSnapshot(
  snapshot: StoreSnapshot,
  profitDashboard?: ProfitDashboard | null,
): RawFacts {
  if (profitDashboard) {
    return rawFactsFromProfitDashboard(profitDashboard, {
      commerce: {
        ...emptyCommerceFacts(),
        sessions: snapshot.ga4Snapshot?.sessions30d ?? null,
      },
      advertising: {
        ...emptyAdvertisingFacts(),
        adSpend:
          profitDashboard.primary.adSpend ??
          snapshot.adSpendSnapshot?.totalRollups.last30d.spend ??
          snapshot.campaigns.reduce((s, c) => s + c.spend7d * (30 / 7), 0),
      },
      campaigns: snapshot.campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        platform: "meta" as const,
        spend: c.spend7d * (30 / 7),
        revenue: c.revenue7d * (30 / 7),
        purchases: 0,
        clicks: 0,
        impressions: 0,
      })),
    });
  }

  const rollups = snapshot.profitRollups?.last30d;
  const adSpend =
    snapshot.adSpendSnapshot?.totalRollups.last30d.spend ??
    snapshot.campaigns.reduce((s, c) => s + c.spend7d * (30 / 7), 0);

  return {
    currency: "USD",
    window: "last30d",
    commerce: {
      revenue: rollups?.revenue ?? snapshot.metrics.revenue30d ?? 0,
      orders: rollups?.orders ?? snapshot.metrics.orders30d ?? 0,
      refunds: rollups?.refunds ?? 0,
      discounts: 0,
      taxes: null,
      shippingCost: rollups?.shipping ?? 0,
      shippingRevenue: 0,
      cogs: rollups?.cogs ?? 0,
      platformFees: 0,
      sessions: snapshot.ga4Snapshot?.sessions30d ?? null,
      customers: rollups?.orders ?? snapshot.metrics.orders30d ?? 0,
      inventoryUnits: null,
      inventoryValue: null,
    },
    advertising: {
      adSpend,
      impressions: 0,
      clicks: 0,
      purchases: rollups?.orders ?? 0,
      attributedRevenue: rollups?.revenue ?? 0,
    },
    campaigns: [],
    products: [],
    historicalPredictionAccuracy: null,
    dataQualityScore: null,
  };
}
