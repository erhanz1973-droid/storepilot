import type { ProfitDashboard } from "@/lib/profit/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ChartDefinition } from "@/lib/analytics/types";
import { buildExecutiveAnalytics } from "@/lib/analytics/executive";
import { analyzeSalesTrends } from "@/lib/ai/sales-trends";
import { estimateMonthlyRecovery } from "@/lib/analytics/recovery-engine";
import {
  buildOrderIntelligenceRows,
  type OrderIntelligenceHighlight,
  type SalesOrderRow,
} from "@/lib/analytics/order-intelligence";
export type {
  OrderHealthStatus,
  OrderIntelligenceHighlight,
  OrderProfitBreakdown,
  SalesOrderRow,
} from "@/lib/analytics/order-intelligence";

export type SalesBrief = {
  greeting: string;
  lines: string[];
  todayPriority: string | null;
  todayPriorityAction: string | null;
};

export type SalesBusinessKpi = {
  id: string;
  label: string;
  value: string;
  sublabel?: string;
  tone?: "positive" | "negative" | "warning" | "default";
};

export type RevenueQuality = {
  score: number;
  reasons: string[];
  warnings: string[];
};

export type RevenueDriver = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  contributionPct?: number;
};

export type SalesOpportunity = {
  id: string;
  title: string;
  estimatedProfitMonthly: number;
  recoveryProbabilityPct: number;
  reasons: string[];
};

export type TrendCommentary = {
  revenueLine: string;
  ordersLine: string;
  insight: string;
};

export type CustomerValueSummary = {
  newCustomerRevenue: number;
  returningCustomerRevenue: number;
  repeatPurchaseRatePct: number;
  ltv: number | null;
  ltvStatus: "verified" | "estimated" | "unavailable";
};

export type DiscountInsight = {
  discountTotal: number;
  additionalRevenue: number;
  marginImpactPct: number;
  explanation: string;
};

export type SalesManagerV2 = {
  brief: SalesBrief;
  businessKpis: SalesBusinessKpi[];
  revenueQuality: RevenueQuality;
  drivers: RevenueDriver[];
  opportunities: SalesOpportunity[];
  orders: SalesOrderRow[];
  orderHighlights: OrderIntelligenceHighlight[];
  trendCommentary: TrendCommentary;
  customerValue: CustomerValueSummary;
  discountInsight: DiscountInsight;
  secondaryMetrics: SalesBusinessKpi[];
  charts: ChartDefinition[];
  totalRecoverableMonthly: number;
};

function fmt(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function greetingForHour(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function computeRevenueQuality(input: {
  aov: number;
  aovChangePct: number | null;
  refundRatePct: number;
  repeatRatePct: number;
  grossMarginPct: number | null;
  discountRatePct: number;
}): RevenueQuality {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 72;

  if (input.aovChangePct != null && Math.abs(input.aovChangePct) <= 5) {
    score += 8;
    reasons.push("Average order value is stable.");
  } else if (input.aovChangePct != null && input.aovChangePct > 5) {
    score += 12;
    reasons.push("Average order value is growing.");
  } else if (input.aovChangePct != null && input.aovChangePct < -5) {
    score -= 10;
    warnings.push("Average order value declined vs prior period.");
  } else {
    reasons.push("Average order value is within normal range.");
  }

  if (input.refundRatePct <= 2.5) {
    score += 10;
    reasons.push("Refund rate remains healthy.");
  } else if (input.refundRatePct <= 5) {
    score += 2;
    warnings.push("Refund rate is slightly above target.");
  } else {
    score -= 12;
    warnings.push("Refund rate is elevated — review product quality and sizing.");
  }

  if (input.repeatRatePct >= 28) {
    score += 10;
    reasons.push("Strong repeat purchase rate.");
  } else if (input.repeatRatePct >= 18) {
    score += 4;
    reasons.push("Average repeat purchase rate.");
  } else {
    score -= 8;
    warnings.push("Repeat purchase rate is below target.");
  }

  if (input.grossMarginPct != null && input.grossMarginPct >= 35) {
    score += 8;
    reasons.push("Gross margin supports profitable growth.");
  } else if (input.grossMarginPct != null && input.grossMarginPct >= 25) {
    score += 2;
  } else if (input.grossMarginPct != null) {
    score -= 6;
    warnings.push("Gross margin is compressed.");
  }

  if (input.discountRatePct > 10) {
    score -= 8;
    warnings.push("Discount usage above target.");
  } else if (input.discountRatePct <= 6) {
    score += 4;
    reasons.push("Discount usage is controlled.");
  }

  return {
    score: clamp(Math.round(score), 0, 100),
    reasons,
    warnings,
  };
}

function buildRevenueDrivers(snapshot: StoreSnapshot): RevenueDriver[] {
  const products = [...snapshot.products]
    .filter((p) => p.revenue30d > 0)
    .sort((a, b) => b.revenue30d - a.revenue30d);
  const collections = [...(snapshot.collections ?? [])]
    .filter((c) => c.revenue30d > 0)
    .sort((a, b) => b.revenue30d - a.revenue30d);
  const totalRev = snapshot.storeMetrics.revenue30d || 1;

  const ga4 = snapshot.ga4Snapshot;
  let topChannel = "Direct";
  let channelDetail = "—";
  if (ga4?.channelGroups?.length) {
    const top = [...ga4.channelGroups].sort((a, b) => b.revenue - a.revenue)[0];
    if (top) {
      topChannel = top.channel;
      channelDetail = fmt(top.revenue);
    }
  } else if (ga4?.sourceMedium?.length) {
    const top = [...ga4.sourceMedium].sort((a, b) => b.revenue - a.revenue)[0];
    if (top) {
      topChannel = `${top.source}/${top.medium}`;
      channelDetail = fmt(top.revenue);
    }
  }

  const topCountry = ga4?.countries?.length
    ? [...ga4.countries].sort((a, b) => b.revenue - a.revenue)[0]
    : null;
  const topDevice = ga4?.devices?.length
    ? [...ga4.devices].sort((a, b) => b.revenue - a.revenue)[0]
    : null;

  const cust = snapshot.customerSnapshot;
  let topSegment = "Returning Customers";
  if (cust) {
    topSegment =
      cust.returningCustomers30d >= cust.newCustomers30d
        ? "Returning Customers"
        : "New Customers";
  }

  const drivers: RevenueDriver[] = [];
  if (products[0]) {
    drivers.push({
      id: "product",
      label: "Top Selling Product",
      value: products[0].title,
      detail: fmt(products[0].revenue30d),
      contributionPct: Math.round((products[0].revenue30d / totalRev) * 100),
    });
  }
  if (collections[0]) {
    drivers.push({
      id: "collection",
      label: "Top Collection",
      value: collections[0].title,
      detail: fmt(collections[0].revenue30d),
      contributionPct: Math.round((collections[0].revenue30d / totalRev) * 100),
    });
  }
  drivers.push({
    id: "channel",
    label: "Top Sales Channel",
    value: topChannel,
    detail: channelDetail,
  });
  if (topCountry) {
    drivers.push({
      id: "country",
      label: "Top Country",
      value: topCountry.country,
      detail: fmt(topCountry.revenue),
      contributionPct: Math.round((topCountry.revenue / totalRev) * 100),
    });
  }
  if (topDevice) {
    drivers.push({
      id: "device",
      label: "Top Device",
      value: topDevice.device.charAt(0).toUpperCase() + topDevice.device.slice(1),
      detail: fmt(topDevice.revenue),
      contributionPct: Math.round((topDevice.revenue / totalRev) * 100),
    });
  }
  drivers.push({
    id: "segment",
    label: "Top Customer Segment",
    value: topSegment,
    detail: cust ? `${cust.repeatPurchaseRatePct.toFixed(1)}% repeat rate` : undefined,
  });

  return drivers;
}

function buildOrderIntelligence(
  snapshot: StoreSnapshot,
  profitDashboard: ProfitDashboard | null | undefined,
) {
  return buildOrderIntelligenceRows(snapshot, profitDashboard);
}

function buildSalesOpportunities(input: {
  snapshot: StoreSnapshot;
  profitDashboard: ProfitDashboard | null | undefined;
  aov: number;
  refundRatePct: number;
  repeatRatePct: number;
}): SalesOpportunity[] {
  const opps: SalesOpportunity[] = [];
  const revenue = input.snapshot.storeMetrics.revenue30d;
  const ga4 = input.snapshot.ga4Snapshot;

  const aovRecovery = estimateMonthlyRecovery({
    maxRecoverableMonthly: 0,
    gapSeverity: 0.55,
    confidencePct: 68,
    growthBaseMonthly: revenue * 0.08,
  });
  opps.push({
    id: "increase_aov",
    title: "Increase Average Order Value",
    estimatedProfitMonthly: aovRecovery.amountMonthly,
    recoveryProbabilityPct: aovRecovery.probabilityPct,
    reasons: [
      "Bundle complementary products at checkout.",
      "Add free-shipping threshold slightly above current AOV.",
      `Current AOV is ${fmt(input.aov)} — small lifts compound quickly.`,
    ],
  });

  if (input.refundRatePct > 2) {
    const refundRecovery = estimateMonthlyRecovery({
      maxRecoverableMonthly: revenue * (input.refundRatePct / 100) * 0.4,
      gapSeverity: input.refundRatePct / 10,
      confidencePct: 72,
    });
    opps.push({
      id: "reduce_refunds",
      title: "Reduce Refunds",
      estimatedProfitMonthly: refundRecovery.amountMonthly,
      recoveryProbabilityPct: refundRecovery.probabilityPct,
      reasons: [
        `Refund rate is ${input.refundRatePct.toFixed(1)}% — review sizing guides and product photos.`,
        "Add post-purchase quality checks for high-return SKUs.",
      ],
    });
  }

  const bundleRecovery = estimateMonthlyRecovery({
    maxRecoverableMonthly: 0,
    gapSeverity: 0.6,
    confidencePct: 65,
    growthBaseMonthly: revenue * 0.12,
  });
  opps.push({
    id: "bundle_products",
    title: "Bundle Products",
    estimatedProfitMonthly: bundleRecovery.amountMonthly,
    recoveryProbabilityPct: bundleRecovery.probabilityPct,
    reasons: [
      "Top products pair naturally — create bundle offers on collection pages.",
      "Bundles lift AOV without increasing acquisition cost.",
    ],
  });

  const sessions30d = ga4?.sessions30d ?? Math.round(input.snapshot.storeMetrics.orders30d / 0.025);
  const checkoutDrop =
    ga4?.funnelEvents?.verified && ga4.funnelEvents.checkout30d > 0
      ? ga4.funnelEvents.addToCart30d - ga4.funnelEvents.checkout30d
      : Math.round(sessions30d * 0.02);
  if (checkoutDrop > 0) {
    const cartRecovery = estimateMonthlyRecovery({
      maxRecoverableMonthly: revenue * 0.06,
      gapSeverity: 0.5,
      confidencePct: 70,
    });
    opps.push({
      id: "abandoned_carts",
      title: "Recover Abandoned Carts",
      estimatedProfitMonthly: cartRecovery.amountMonthly,
      recoveryProbabilityPct: cartRecovery.probabilityPct,
      reasons: [
        "Significant checkout abandonment detected in funnel data.",
        "Deploy email/SMS recovery for cart abandoners within 1 hour.",
      ],
    });
  }

  return opps.sort((a, b) => b.estimatedProfitMonthly - a.estimatedProfitMonthly);
}

function buildTrendCommentary(snapshot: StoreSnapshot): TrendCommentary {
  const analysis = analyzeSalesTrends(snapshot.salesTrends);
  const period = analysis.monthOverMonth ?? analysis.weekOverWeek;

  if (!period) {
    return {
      revenueLine: "Revenue trend requires more historical data.",
      ordersLine: "Order volume comparison unavailable.",
      insight: "Connect Shopify and sync at least 30 days of order history for AI trend commentary.",
    };
  }

  const revPct = period.changePct ?? 0;
  const revLine =
    period.direction === "flat"
      ? `Revenue held steady at ${fmt(period.currentRevenue)}.`
      : `Revenue ${period.direction === "up" ? "increased" : "decreased"} ${Math.abs(revPct).toFixed(0)}% compared with the previous period.`;

  const orderDelta = period.currentOrders - period.previousOrders;
  const ordersLine =
    Math.abs(orderDelta) <= 2
      ? "Order volume remained flat."
      : orderDelta > 0
        ? `Order volume increased by ${orderDelta} orders.`
        : `Order volume decreased by ${Math.abs(orderDelta)} orders.`;

  let insight = "Monitor daily sales for sustained momentum.";
  const aovCurrent =
    period.currentOrders > 0 ? period.currentRevenue / period.currentOrders : snapshot.storeMetrics.aov30d;
  const aovPrev =
    period.previousOrders > 0 ? period.previousRevenue / period.previousOrders : aovCurrent;

  if (period.direction === "up" && Math.abs(orderDelta) <= 2) {
    insight = "Growth was driven by higher Average Order Value, not more orders.";
  } else if (period.direction === "up" && orderDelta > 0) {
    insight = "Growth came from both higher order volume and strong order values.";
  } else if (period.direction === "down" && orderDelta < 0) {
    insight = "Decline is driven by fewer orders — review traffic and conversion.";
  } else if (aovCurrent > aovPrev * 1.05) {
    insight = "Average Order Value improved even as order count shifted.";
  }

  return { revenueLine: revLine, ordersLine, insight };
}

function buildCustomerValue(
  snapshot: StoreSnapshot,
  profitDashboard: ProfitDashboard | null | undefined,
): CustomerValueSummary {
  const cust = snapshot.customerSnapshot;
  const revenue = snapshot.storeMetrics.revenue30d;
  const returningPct = cust?.repeatPurchaseRatePct ?? 31;
  const returningRevenue = Math.round(revenue * (returningPct / 100));
  const newRevenue = revenue - returningRevenue;

  let ltv: number | null = null;
  let ltvStatus: CustomerValueSummary["ltvStatus"] = "unavailable";
  if (cust?.customers.length) {
    const withLtv = cust.customers.filter((c) => c.ltv != null);
    if (withLtv.length >= 5) {
      ltv = Math.round(withLtv.reduce((s, c) => s + (c.ltv ?? 0), 0) / withLtv.length);
      ltvStatus = "verified";
    } else if (withLtv.length > 0) {
      ltv = Math.round(withLtv.reduce((s, c) => s + (c.ltv ?? 0), 0) / withLtv.length);
      ltvStatus = "estimated";
    }
  }

  return {
    newCustomerRevenue: newRevenue,
    returningCustomerRevenue: returningRevenue,
    repeatPurchaseRatePct: returningPct,
    ltv,
    ltvStatus,
  };
}

function buildDiscountInsight(
  snapshot: StoreSnapshot,
  profitDashboard: ProfitDashboard | null | undefined,
): DiscountInsight {
  const revenue = snapshot.storeMetrics.revenue30d;
  let discountTotal = Math.round(revenue * 0.08);

  if (snapshot.productOrderStats) {
    discountTotal = Object.values(snapshot.productOrderStats).reduce(
      (s, stats) => s + stats.last30d.discounts,
      0,
    );
  }

  const discountRatePct = revenue > 0 ? (discountTotal / revenue) * 100 : 0;
  const additionalRevenue = Math.round(discountTotal * 2.4);
  const marginImpactPct = Math.round(discountRatePct * 0.75);
  const grossMargin = profitDashboard?.primary.profitMarginPct ?? 28;

  return {
    discountTotal,
    additionalRevenue,
    marginImpactPct,
    explanation: `Discounts generated approximately ${fmt(additionalRevenue)} in attributed revenue but reduced gross margin by ~${marginImpactPct}%. Current gross margin is ${grossMargin.toFixed(0)}%.`,
  };
}

function buildSalesBrief(input: {
  revenue: number;
  aov: number;
  refundRatePct: number;
  repeatRatePct: number;
  opportunities: SalesOpportunity[];
  trendCommentary: TrendCommentary;
}): SalesBrief {
  const lines: string[] = [
    `Revenue reached ${fmt(input.revenue)} over the selected period.`,
    `Average order value is ${fmt(input.aov)}.`,
  ];

  if (input.refundRatePct <= 3) {
    lines.push("Refund rate remains healthy.");
  } else {
    lines.push(`Refund rate is ${input.refundRatePct.toFixed(1)}% — worth monitoring.`);
  }

  if (input.repeatRatePct >= 25) {
    lines.push("Most revenue comes from repeat purchases.");
  } else {
    lines.push("New customers drive the majority of revenue — retention is an opportunity.");
  }

  lines.push(input.trendCommentary.insight);

  const top = input.opportunities[0];

  return {
    greeting: greetingForHour(),
    lines,
    todayPriority: top?.title ?? "Review order profitability",
    todayPriorityAction: top?.reasons[0] ?? null,
  };
}

function buildBusinessKpis(input: {
  revenue: number;
  netRevenue: number;
  orders: number;
  aov: number;
  grossMarginPct: number | null;
  refundRatePct: number;
  repeatRatePct: number;
}): SalesBusinessKpi[] {
  return [
    {
      id: "revenue",
      label: "Revenue",
      value: fmt(input.revenue),
      sublabel: "Last 30 days",
      tone: "default",
    },
    {
      id: "net_revenue",
      label: "Net Revenue",
      value: fmt(input.netRevenue),
      sublabel: "After refunds",
      tone: "positive",
    },
    {
      id: "orders",
      label: "Orders",
      value: input.orders.toLocaleString(),
      tone: "default",
    },
    {
      id: "aov",
      label: "Average Order Value",
      value: fmt(input.aov),
      tone: "default",
    },
    {
      id: "gross_margin",
      label: "Gross Margin",
      value: input.grossMarginPct != null ? `${input.grossMarginPct.toFixed(1)}%` : "—",
      tone:
        input.grossMarginPct != null && input.grossMarginPct >= 30
          ? "positive"
          : input.grossMarginPct != null && input.grossMarginPct < 20
            ? "negative"
            : "warning",
    },
    {
      id: "refund_rate",
      label: "Refund Rate",
      value: `${input.refundRatePct.toFixed(1)}%`,
      tone: input.refundRatePct <= 3 ? "positive" : input.refundRatePct <= 5 ? "warning" : "negative",
    },
    {
      id: "repeat_rate",
      label: "Repeat Purchase Rate",
      value: `${input.repeatRatePct.toFixed(1)}%`,
      tone: input.repeatRatePct >= 28 ? "positive" : input.repeatRatePct >= 18 ? "default" : "warning",
    },
  ];
}

export function buildSalesManagerV2(input: {
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
}): SalesManagerV2 {
  const { snapshot, profitDashboard } = input;
  const primary = profitDashboard?.primary;
  const m = snapshot.storeMetrics;
  const revenue = primary?.revenue ?? m.revenue30d;
  const refunds = primary?.refunds ?? snapshot.profitRollups?.last30d.refunds ?? revenue * 0.02;
  const netRevenue = revenue - refunds;
  const orders = primary?.orders ?? m.orders30d;
  const aov = m.aov30d;
  const refundRatePct = revenue > 0 ? (refunds / revenue) * 100 : 0;
  const repeatRatePct = snapshot.customerSnapshot?.repeatPurchaseRatePct ?? 31;
  const grossMarginPct =
    primary?.revenue && primary.cogs
      ? ((primary.revenue - primary.cogs) / primary.revenue) * 100
      : null;

  const discountTotal = buildDiscountInsight(snapshot, profitDashboard).discountTotal;
  const discountRatePct = revenue > 0 ? (discountTotal / revenue) * 100 : 0;

  const analysis = analyzeSalesTrends(snapshot.salesTrends);
  const aovChangePct = analysis.monthOverMonth
    ? ((analysis.monthOverMonth.currentRevenue / Math.max(analysis.monthOverMonth.currentOrders, 1) -
        analysis.monthOverMonth.previousRevenue / Math.max(analysis.monthOverMonth.previousOrders, 1)) /
        Math.max(
          analysis.monthOverMonth.previousRevenue / Math.max(analysis.monthOverMonth.previousOrders, 1),
          1,
        )) *
      100
    : null;

  const revenueQuality = computeRevenueQuality({
    aov,
    aovChangePct,
    refundRatePct,
    repeatRatePct,
    grossMarginPct,
    discountRatePct,
  });

  const trendCommentary = buildTrendCommentary(snapshot);
  const opportunities = buildSalesOpportunities({
    snapshot,
    profitDashboard,
    aov,
    refundRatePct,
    repeatRatePct,
  });
  const brief = buildSalesBrief({
    revenue,
    aov,
    refundRatePct,
    repeatRatePct,
    opportunities,
    trendCommentary,
  });

  const executive = buildExecutiveAnalytics({
    snapshot,
    profitDashboard,
    executiveSummary: null,
    trends: null,
  });
  const revenueChart = executive.charts.find((c) => c.id === "revenue");
  const ordersChart = executive.charts.find((c) => c.id === "orders");

  const shipping = primary?.shippingCost ?? Math.round(revenue * 0.04);
  const taxes = Math.round(revenue * 0.07);
  const orderIntel = buildOrderIntelligence(snapshot, profitDashboard);

  return {
    brief,
    businessKpis: buildBusinessKpis({
      revenue,
      netRevenue,
      orders,
      aov,
      grossMarginPct,
      refundRatePct,
      repeatRatePct,
    }),
    revenueQuality,
    drivers: buildRevenueDrivers(snapshot),
    opportunities,
    orders: orderIntel.orders,
    orderHighlights: orderIntel.highlights,
    trendCommentary,
    customerValue: buildCustomerValue(snapshot, profitDashboard),
    discountInsight: buildDiscountInsight(snapshot, profitDashboard),
    secondaryMetrics: [
      { id: "shipping", label: "Shipping", value: fmt(shipping) },
      { id: "taxes", label: "Taxes", value: fmt(taxes) },
      { id: "discounts", label: "Discounts", value: fmt(discountTotal) },
    ],
    charts: [revenueChart, ordersChart].filter(Boolean) as ChartDefinition[],
    totalRecoverableMonthly: opportunities.reduce((s, o) => s + o.estimatedProfitMonthly, 0),
  };
}
