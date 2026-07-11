import type { ShopMetrics } from "./shop-metrics";

export type LiveInsightItem = {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
};

export type LiveAiRecommendation = {
  title: string;
  reason: string;
  summary: string;
  confidencePct: number;
  expectedImpactMonthly: string;
  sourceNote: string;
};

function fmtCurrency(amount: number, currencyCode: string, compact = false): string {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: compact ? 0 : 2,
  });
}

function fmtNumber(n: number): string {
  return n.toLocaleString();
}

/** Critical issues & opportunities from live Supabase metrics. */
export function buildLiveInsights(metrics: ShopMetrics): {
  criticalIssues: LiveInsightItem[];
  opportunities: LiveInsightItem[];
} {
  const criticalIssues: LiveInsightItem[] = [];
  const opportunities: LiveInsightItem[] = [];

  for (const product of metrics.lowStockProducts.slice(0, 3)) {
    criticalIssues.push({
      id: `low-stock-${product.productGid ?? product.title}`,
      title: `Low inventory: ${product.title}`,
      description: `Only ${fmtNumber(product.inventory)} units on hand. Reorder to prevent stockouts on active SKUs.`,
      severity: product.inventory <= 2 ? "critical" : "warning",
    });
  }

  if (metrics.orders30d === 0 && metrics.productCount > 0) {
    criticalIssues.push({
      id: "no-recent-orders",
      title: "No orders in the last 30 days",
      description:
        "Products are synced but order volume is zero. Review checkout, pricing, and traffic sources.",
      severity: "critical",
    });
  }

  const revenueChange =
    metrics.revenuePrev30d > 0
      ? ((metrics.revenue30d - metrics.revenuePrev30d) / metrics.revenuePrev30d) * 100
      : null;

  if (revenueChange != null && revenueChange <= -10) {
    criticalIssues.push({
      id: "revenue-decline",
      title: "Revenue declined vs prior 30 days",
      description: `30-day revenue is down ${Math.abs(revenueChange).toFixed(1)}% compared to the previous period (${fmtCurrency(metrics.revenue30d, metrics.currencyCode)} vs ${fmtCurrency(metrics.revenuePrev30d, metrics.currencyCode)}).`,
      severity: "warning",
    });
  }

  if (metrics.topProducts[0]) {
    const hero = metrics.topProducts[0];
    opportunities.push({
      id: "hero-merchandising",
      title: `Promote top SKU: ${hero.title}`,
      description: `${hero.title} generated ${fmtCurrency(hero.revenue, metrics.currencyCode)} across ${fmtNumber(hero.units)} units. Test homepage placement and retargeting.`,
      severity: "info",
    });
  }

  if (metrics.lapsedCustomers > 0) {
    opportunities.push({
      id: "winback-segment",
      title: "Re-engage customers with zero orders",
      description: `${fmtNumber(metrics.lapsedCustomers)} synced customers have not purchased yet. Segment for welcome or education flows.`,
      severity: "info",
    });
  }

  if (metrics.inventoryUnits > 0 && metrics.productCount > 0) {
    opportunities.push({
      id: "inventory-optimization",
      title: "Balance inventory across catalog",
      description: `${fmtNumber(metrics.inventoryUnits)} total units across ${fmtNumber(metrics.productCount)} products. Review slow movers to free working capital.`,
      severity: "info",
    });
  }

  return { criticalIssues, opportunities };
}

/** Top AI recommendation from live Supabase metrics. */
export function buildLiveAiRecommendation(
  metrics: ShopMetrics,
): LiveAiRecommendation | null {
  if (metrics.orders30d === 0 && metrics.productCount === 0) {
    return null;
  }

  const top = metrics.topProducts[0];

  if (
    top &&
    top.revenue > 0 &&
    metrics.lowStockProducts.some((p) => p.title === top.title)
  ) {
    const low = metrics.lowStockProducts.find((p) => p.title === top.title)!;
    return {
      title: `Replenish "${top.title}" before scaling traffic`,
      reason: `Top SKU (${fmtCurrency(top.revenue, metrics.currencyCode)}) has only ${low.inventory} units remaining.`,
      summary: `${top.title} drives the most revenue but inventory is critically low. Restock to avoid stockouts on your highest-converting product.`,
      confidencePct: 92,
      expectedImpactMonthly: `+${fmtCurrency(top.revenue * 0.25, metrics.currencyCode, true)} protected revenue`,
      sourceNote: "Rule engine — order line items + product inventory in Supabase",
    };
  }

  if (metrics.lapsedCustomers >= 25 && metrics.revenue30d > 0) {
    return {
      title: "Launch a win-back campaign for dormant customers",
      reason: `${metrics.lapsedCustomers} synced customers have zero recorded orders.`,
      summary:
        "These buyers are already in your CRM. A targeted email with a modest incentive could reactivate high-intent customers.",
      confidencePct: 78,
      expectedImpactMonthly: `+${fmtCurrency(metrics.revenue30d * 0.08, metrics.currencyCode, true)}/mo if 5% convert`,
      sourceNote: "Rule engine — shopify_customers.orders_count in Supabase",
    };
  }

  if (top && top.revenue > 100) {
    return {
      title: `Double down on "${top.title}" in merchandising`,
      reason: `Leads 30-day revenue at ${fmtCurrency(top.revenue, metrics.currencyCode)} (${top.units} units).`,
      summary:
        "Feature this SKU on the homepage collection and test a bundle with complementary items to lift conversion.",
      confidencePct: 85,
      expectedImpactMonthly: `+${fmtCurrency(top.revenue * 0.12, metrics.currencyCode, true)}/mo estimated uplift`,
      sourceNote: "Rule engine — shopify_orders.line_items aggregated in Supabase",
    };
  }

  const revenueChange =
    metrics.revenuePrev30d > 0
      ? ((metrics.revenue30d - metrics.revenuePrev30d) / metrics.revenuePrev30d) * 100
      : null;

  if (revenueChange != null && revenueChange <= -10 && metrics.revenue30d > 0) {
    return {
      title: "Investigate revenue decline before increasing ad spend",
      reason: `30-day revenue down ${Math.abs(revenueChange).toFixed(1)}% vs prior period.`,
      summary:
        "Review pricing, conversion rate, and top SKU performance. Stabilize core metrics before scaling paid acquisition.",
      confidencePct: 88,
      expectedImpactMonthly: "Avoid wasted ad spend during downturn",
      sourceNote: "Rule engine — shopify_orders 30d vs prior 30d in Supabase",
    };
  }

  return null;
}
