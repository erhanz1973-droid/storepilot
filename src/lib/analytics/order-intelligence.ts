import type { ProfitDashboard } from "@/lib/profit/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import { isDemoStoreSnapshot } from "@/lib/demo/is-demo-store";
import { allowDemoData } from "@/lib/env/runtime";
import {
  peakOutfittersOrderIntelligenceSeeds,
  peakOrderMarginPct,
  peakOrderNetProfit,
} from "@/lib/demo/peak-outfitters/order-intelligence";
import {
  DEFAULT_TRANSACTION_FEE_FIXED,
  DEFAULT_TRANSACTION_FEE_RATE,
} from "@/lib/profit/constants";

export type OrderProfitBreakdown = {
  revenue: number;
  productCost: number;
  advertisingCost: number;
  shipping: number;
  paymentFees: number;
  discounts: number;
  refunds: number;
  netProfit: number;
};

export type OrderHealthStatus =
  | "Excellent"
  | "Healthy"
  | "Average"
  | "Needs Attention"
  | "Unprofitable";

export type OrderIntelligenceHighlight = {
  id: string;
  label: string;
  orderId: string;
  customer: string;
  value: string;
  detail: string;
};

export type SalesOrderRow = {
  id: string;
  externalId: string;
  customer: string;
  revenue: number;
  profit: number;
  marginPct: number;
  channel: string;
  customerType: "First-time" | "Returning";
  refundRisk: "Low" | "Medium" | "High";
  health: OrderHealthStatus;
  badges: string[];
  date: string;
  breakdown: OrderProfitBreakdown;
  customerLifetimeValue?: number;
  isBundle: boolean;
};

function orderHealth(marginPct: number): OrderHealthStatus {
  if (marginPct >= 35) return "Excellent";
  if (marginPct >= 18) return "Healthy";
  if (marginPct >= 5) return "Average";
  if (marginPct >= 0) return "Needs Attention";
  return "Unprofitable";
}

function buildBadges(input: {
  marginPct: number;
  channel: string;
  isNewCustomer: boolean;
  isReturning: boolean;
  isVip: boolean;
  isBundle: boolean;
  revenue: number;
  aov: number;
  advertisingCost: number;
}): string[] {
  const badges: string[] = [];
  if (input.marginPct >= 35) badges.push("High Margin");
  if (input.channel === "Organic Search" || input.channel === "Direct") badges.push("Organic");
  if (input.isVip) badges.push("VIP Customer");
  if (input.isReturning) badges.push("Returning Customer");
  if (input.isNewCustomer) badges.push("First Purchase");
  if (input.isBundle) badges.push("Bundle Order");
  if (input.revenue >= input.aov * 1.35) badges.push("High AOV");
  if (input.isReturning && !input.isNewCustomer) badges.push("Repeat Buyer");
  if (input.advertisingCost <= input.revenue * 0.08 && input.advertisingCost > 0) {
    badges.push("Low Acquisition Cost");
  }
  return badges.slice(0, 4);
}

function buildHighlights(orders: SalesOrderRow[]): OrderIntelligenceHighlight[] {
  if (!orders.length) return [];

  const highlights: OrderIntelligenceHighlight[] = [];
  const byProfit = [...orders].sort((a, b) => b.profit - a.profit);
  const byMargin = [...orders].sort((a, b) => b.marginPct - a.marginPct);
  const byAcq = [...orders].sort(
    (a, b) => a.breakdown.advertisingCost - b.breakdown.advertisingCost,
  );
  const returning = orders.filter((o) => o.customerType === "Returning");
  const byReturningProfit = [...returning].sort((a, b) => b.profit - a.profit);
  const byLtv = [...orders].sort(
    (a, b) => (b.customerLifetimeValue ?? 0) - (a.customerLifetimeValue ?? 0),
  );

  const topProfit = byProfit[0];
  if (topProfit) {
    highlights.push({
      id: "highest-profit",
      label: "Highest Profit Order",
      orderId: topProfit.id,
      customer: topProfit.customer,
      value: `$${topProfit.profit.toLocaleString()}`,
      detail: `${topProfit.channel} · ${topProfit.marginPct.toFixed(1)}% margin`,
    });
  }

  const topMargin = byMargin[0];
  if (topMargin && topMargin.id !== topProfit?.id) {
    highlights.push({
      id: "highest-margin",
      label: "Highest Margin Order",
      orderId: topMargin.id,
      customer: topMargin.customer,
      value: `${topMargin.marginPct.toFixed(1)}%`,
      detail: `${topMargin.channel} · $${topMargin.revenue.toLocaleString()} revenue`,
    });
  }

  const topAcq = [...orders]
    .filter((o) => o.breakdown.advertisingCost > 0)
    .sort((a, b) => b.breakdown.advertisingCost - a.breakdown.advertisingCost)[0];
  if (topAcq) {
    highlights.push({
      id: "expensive-acq",
      label: "Most Expensive Acquisition",
      orderId: topAcq.id,
      customer: topAcq.customer,
      value: `$${topAcq.breakdown.advertisingCost.toLocaleString()}`,
      detail: `${topAcq.channel} · ${topAcq.health} order health`,
    });
  }

  const bestReturning = byReturningProfit[0];
  if (bestReturning) {
    highlights.push({
      id: "best-returning",
      label: "Best Returning Customer Order",
      orderId: bestReturning.id,
      customer: bestReturning.customer,
      value: `$${bestReturning.profit.toLocaleString()}`,
      detail: `LTV $${(bestReturning.customerLifetimeValue ?? 0).toLocaleString()}`,
    });
  }

  const topLtv = byLtv[0];
  if (topLtv) {
    highlights.push({
      id: "highest-ltv",
      label: "Highest Lifetime Value",
      orderId: topLtv.id,
      customer: topLtv.customer,
      value: `$${(topLtv.customerLifetimeValue ?? 0).toLocaleString()}`,
      detail: `${topLtv.customerType} · ${topLtv.badges.includes("VIP Customer") ? "VIP" : "Core customer"}`,
    });
  }

  return highlights.slice(0, 5);
}

function fromDemoSeeds(aov: number): SalesOrderRow[] {
  return peakOutfittersOrderIntelligenceSeeds().map((seed) => {
    const profit = peakOrderNetProfit(seed);
    const margin = peakOrderMarginPct(seed.revenue, profit);
    const breakdown: OrderProfitBreakdown = {
      revenue: seed.revenue,
      productCost: seed.productCost,
      advertisingCost: seed.advertisingCost,
      shipping: seed.shipping,
      paymentFees: seed.paymentFees,
      discounts: seed.discounts,
      refunds: seed.refunds,
      netProfit: profit,
    };

    return {
      id: seed.id,
      externalId: seed.externalId,
      customer: seed.customerName,
      revenue: seed.revenue,
      profit,
      marginPct: margin,
      channel: seed.channelLabel,
      customerType: seed.isNewCustomer ? "First-time" : "Returning",
      refundRisk: seed.refundRisk,
      health: orderHealth(margin),
      badges: buildBadges({
        marginPct: margin,
        channel: seed.channelLabel,
        isNewCustomer: seed.isNewCustomer,
        isReturning: seed.isReturning,
        isVip: seed.isVip,
        isBundle: seed.isBundle,
        revenue: seed.revenue,
        aov,
        advertisingCost: seed.advertisingCost,
      }),
      date: seed.createdAt,
      breakdown,
      customerLifetimeValue: seed.lifetimeValue,
      isBundle: seed.isBundle,
    };
  });
}

function fromCustomerHistory(
  snapshot: StoreSnapshot,
  profitDashboard: ProfitDashboard | null | undefined,
): SalesOrderRow[] {
  const aov = snapshot.storeMetrics.aov30d;
  const storeAdRate =
    profitDashboard?.primary.adSpend && profitDashboard.primary.revenue
      ? profitDashboard.primary.adSpend / profitDashboard.primary.revenue
      : 0.18;

  const rows: SalesOrderRow[] = [];
  for (const c of snapshot.customerSnapshot?.customers ?? []) {
    for (const purchase of c.purchaseHistory.slice(0, 1)) {
      const revenue = purchase.amount;
      const productCost = Math.round(revenue * 0.42 * 100) / 100;
      const channel = c.acquisitionLabel;
      const isPaid = channel.includes("Meta") || channel.includes("Google");
      const advertisingCost = isPaid
        ? Math.round(revenue * storeAdRate * (channel.includes("Meta") ? 1.15 : 0.85) * 100) / 100
        : Math.round(revenue * 0.02 * 100) / 100;
      const shipping = 7.5;
      const paymentFees = Math.round((revenue * DEFAULT_TRANSACTION_FEE_RATE + DEFAULT_TRANSACTION_FEE_FIXED) * 100) / 100;
      const profit = Math.round(
        (revenue - productCost - advertisingCost - shipping - paymentFees) * 100,
      ) / 100;
      const margin = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;

      rows.push({
        id: `${c.id}-${purchase.date}`,
        externalId: `#${c.id.slice(-6)}`,
        customer: c.name,
        revenue,
        profit,
        marginPct: margin,
        channel,
        customerType: c.ordersCount > 1 ? "Returning" : "First-time",
        refundRisk: c.segment === "at_risk" ? "Medium" : c.segment === "inactive" ? "High" : "Low",
        health: orderHealth(margin),
        badges: buildBadges({
          marginPct: margin,
          channel,
          isNewCustomer: c.ordersCount <= 1,
          isReturning: c.ordersCount > 1,
          isVip: c.segment === "vip",
          isBundle: purchase.itemCount > 1,
          revenue,
          aov,
          advertisingCost,
        }),
        date: purchase.date,
        breakdown: {
          revenue,
          productCost,
          advertisingCost,
          shipping,
          paymentFees,
          discounts: 0,
          refunds: 0,
          netProfit: profit,
        },
        customerLifetimeValue: c.ltv ?? c.lifetimeRevenue,
        isBundle: purchase.itemCount > 1,
      });
    }
  }
  return rows.sort((a, b) => b.revenue - a.revenue).slice(0, 20);
}


function fromCommerceOrders(
  snapshot: StoreSnapshot,
  profitDashboard: ProfitDashboard | null | undefined,
): SalesOrderRow[] {
  const aov = snapshot.storeMetrics.aov30d;
  const storeAdRate =
    profitDashboard?.primary.adSpend && profitDashboard.primary.revenue
      ? profitDashboard.primary.adSpend / profitDashboard.primary.revenue
      : 0.18;

  const rows: SalesOrderRow[] = [];
  for (const order of snapshot.commerceOrders ?? []) {
    const revenue = order.revenue;
    if (revenue <= 0) continue;
    const productCost = order.cogs;
    const advertisingCost = Math.round(revenue * storeAdRate * 100) / 100;
    const shipping = order.shipping;
    const paymentFees =
      Math.round((revenue * DEFAULT_TRANSACTION_FEE_RATE + DEFAULT_TRANSACTION_FEE_FIXED) * 100) / 100;
    const discounts = order.discounts;
    const refunds = order.refunds;
    const profit =
      Math.round(
        (revenue - productCost - advertisingCost - shipping - paymentFees - discounts - refunds) * 100,
      ) / 100;
    const margin = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;
    const channel = "Shopify";
    const isBundle = order.lines.length > 1;

    rows.push({
      id: order.id,
      externalId: order.externalId,
      customer: order.customerEmail ?? "Customer",
      revenue,
      profit,
      marginPct: margin,
      channel,
      customerType: order.isNewCustomer ? "First-time" : "Returning",
      refundRisk: refunds > 0 ? "High" : "Low",
      health: orderHealth(margin),
      badges: buildBadges({
        marginPct: margin,
        channel,
        isNewCustomer: order.isNewCustomer,
        isReturning: !order.isNewCustomer,
        isVip: false,
        isBundle,
        revenue,
        aov,
        advertisingCost,
      }),
      date: order.createdAt,
      breakdown: {
        revenue,
        productCost,
        advertisingCost,
        shipping,
        paymentFees,
        discounts,
        refunds,
        netProfit: profit,
      },
      customerLifetimeValue: revenue,
      isBundle,
    });
  }
  return rows.sort((a, b) => b.revenue - a.revenue).slice(0, 20);
}

export function buildOrderIntelligenceRows(
  snapshot: StoreSnapshot,
  profitDashboard: ProfitDashboard | null | undefined,
): { orders: SalesOrderRow[]; highlights: OrderIntelligenceHighlight[] } {
  const aov = snapshot.storeMetrics.aov30d;

  let orders: SalesOrderRow[];
  // Demo fixtures — development only. Never inject Peak/Alpine rows for live merchants.
  if (allowDemoData() && isDemoStoreSnapshot(snapshot) && snapshot.demoScenario === "healthy_growth") {
    orders = fromAlpineProducts(snapshot, aov);
  } else if (allowDemoData() && isDemoStoreSnapshot(snapshot)) {
    orders = fromDemoSeeds(aov);
  } else if (snapshot.customerSnapshot?.customers.length) {
    orders = fromCustomerHistory(snapshot, profitDashboard);
  } else if (snapshot.commerceOrders?.length) {
    orders = fromCommerceOrders(snapshot, profitDashboard);
  } else {
    // Fresh / empty merchant — professional empty table, never fake Peak seeds.
    orders = [];
  }

  return {
    orders,
    highlights: buildHighlights(orders),
  };
}

function fromAlpineProducts(snapshot: StoreSnapshot, aov: number): SalesOrderRow[] {
  const demoToday = Date.UTC(2026, 6, 20);
  const channels = [
    "Meta Ads",
    "Google Ads",
    "Organic Search",
    "Direct",
    "Email",
  ] as const;

  return snapshot.products
    .filter((p) => p.unitsSold30d > 0)
    .sort((a, b) => b.revenue30d - a.revenue30d)
    .slice(0, 20)
    .map((p, i) => {
      const revenue = Math.round(p.price * 100) / 100;
      const productCost = p.unitCost ?? p.price * 0.38;
      const advertisingCost = Math.round(revenue * 0.12 * 100) / 100;
      const shipping = 8;
      const paymentFees = Math.round(revenue * 0.029 * 100) / 100;
      const profit = Math.round((revenue - productCost - advertisingCost - shipping - paymentFees) * 100) / 100;
      const marginPct = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;
      const channel = channels[i % channels.length]!;
      const isReturning = i % 3 !== 0;
      const breakdown: OrderProfitBreakdown = {
        revenue,
        productCost,
        advertisingCost,
        shipping,
        paymentFees,
        discounts: 0,
        refunds: 0,
        netProfit: profit,
      };

      return {
        id: `ao-order-${i + 1}`,
        externalId: `#AO${1000 + i}`,
        customer: ["Alex Chen", "Jordan Martinez", "Taylor Kim", "Morgan Lee", "Casey Brooks"][
          i % 5
        ]!,
        revenue,
        profit,
        marginPct,
        channel,
        customerType: isReturning ? ("Returning" as const) : ("First-time" as const),
        refundRisk: "Low" as const,
        health: orderHealth(marginPct),
        badges: buildBadges({
          marginPct,
          channel,
          isNewCustomer: !isReturning,
          isReturning,
          isVip: i % 7 === 0,
          isBundle: false,
          revenue,
          aov,
          advertisingCost,
        }),
        date: new Date(demoToday - i * 86_400_000).toISOString(),
        breakdown,
        customerLifetimeValue: Math.round(revenue * (isReturning ? 3.2 : 1)),
        isBundle: false,
      };
    });
}
