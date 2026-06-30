import type { ProductAttributionDashboard } from "@/lib/attribution/product-types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProductCostRecord } from "@/lib/db/product-costs";
import { productCostMap } from "@/lib/db/product-costs";
import { resolveCostSource } from "@/lib/profit/confidence";
import {
  DEFAULT_TRANSACTION_FEE_FIXED,
  DEFAULT_TRANSACTION_FEE_RATE,
  ESTIMATED_COGS_RATE,
} from "@/lib/profit/constants";
import type { ProductProfitStatus, ProfitDashboard } from "@/lib/profit/types";
import { allocateOrderCosts, estimateProductOrderStats } from "./enrich";
import { detectHeroProducts } from "./heroes";
import { detectHiddenWinners } from "./hidden-winners";
import { evaluateProductGrowthOpportunities } from "./opportunities";
import { computeProductLifecycleStage } from "./lifecycle";
import { computeProductHealthBreakdown, computeProductHealthScore } from "./score";
import type {
  ProductIntelligenceDashboard,
  ProductIntelligenceProfile,
  ProductTrendMetrics,
  ProductWidgetRow,
} from "./types";

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

function resolveUnitCost(
  product: StoreSnapshot["products"][0],
  costs: Map<string, ProductCostRecord>,
): { unitCost: number; source: ProductIntelligenceProfile["costSource"] } {
  const source = resolveCostSource(product, costs);
  if (source === "shopify" && product.unitCost != null) {
    return { unitCost: product.unitCost, source };
  }
  if (source === "manual") {
    return { unitCost: costs.get(product.id)!.unitCost, source };
  }
  return {
    unitCost: Math.round(product.price * ESTIMATED_COGS_RATE * 100) / 100,
    source: "estimated",
  };
}

function productStatus(
  netProfit: number,
  marginPct: number,
  inventory: number,
  daysUntilStockout: number | null,
): ProductProfitStatus {
  if (inventory === 0) return "Out of Stock";
  if (netProfit < 0) return "Losing Money";
  if (daysUntilStockout != null && daysUntilStockout <= 7) return "Low Stock";
  if (marginPct < 20) return "Low Margin";
  return "Healthy";
}

function inventoryRiskLevel(
  inventory: number,
  units30d: number,
): ProductIntelligenceProfile["inventoryRisk"] {
  const daily = units30d / 30;
  if (units30d === 0 && inventory > 20) return "dead";
  if (daily > 0 && inventory / daily <= 14) return "low_stock";
  if (inventory > 60 && units30d < 20) return "overstock";
  return "none";
}

function buildTrendWindow(
  stats: { units: number; revenue: number; discounts: number; refunds: number },
  unitCost: number,
  allocated: { shipping: number; transactionFees: number; adCost: number },
): ProductTrendMetrics {
  const cogs = Math.round(unitCost * stats.units * 100) / 100;
  const netProfit =
    Math.round(
      (stats.revenue - cogs - stats.discounts - stats.refunds - allocated.shipping - allocated.transactionFees - allocated.adCost) *
        100,
    ) / 100;
  const marginPct =
    stats.revenue > 0 ? Math.round((netProfit / stats.revenue) * 1000) / 10 : 0;
  const roas = allocated.adCost > 0 ? Math.round((stats.revenue / allocated.adCost) * 100) / 100 : null;
  return {
    revenue: stats.revenue,
    netProfit,
    marginPct,
    units: stats.units,
    roas,
  };
}

function toWidget(
  p: ProductIntelligenceProfile,
  value: number,
  valueLabel: string,
  sublabel?: string,
): ProductWidgetRow {
  return {
    productId: p.productId,
    title: p.title,
    imageUrl: p.imageUrl,
    value,
    valueLabel,
    sublabel,
  };
}

function salesTrendLabel(growth: number | null): string {
  if (growth == null) return "Stable";
  if (growth > 15) return "Strong growth";
  if (growth > 5) return "Growing";
  if (growth > -5) return "Stable";
  if (growth > -15) return "Softening";
  return "Declining";
}

function estimateLastSaleDaysAgo(units30d: number, inventory: number): number | null {
  if (units30d <= 0) return inventory > 0 ? 45 : null;
  const daily = units30d / 30;
  return Math.max(1, Math.min(28, Math.round(1 / Math.max(daily, 0.05))));
}

function estimateDaysOutOfStock(productId: string, inventory: number): number | null {
  if (inventory > 0) return null;
  const hash = productId.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return 3 + (hash % 6);
}

function buildProductProfile(
  p: StoreSnapshot["products"][0],
  snapshot: StoreSnapshot,
  costs: Map<string, import("@/lib/db/product-costs").ProductCostRecord>,
  storeRevenue: number,
  storeCosts: { shipping: number; transactionFees: number; adSpend: number },
  productAttribution?: ProductAttributionDashboard | null,
): ProductIntelligenceProfile {
  const catalogOnly = p.unitsSold30d <= 0 && p.revenue30d <= 0;
  const orderStats =
    snapshot.productOrderStats?.[p.id] ??
    estimateProductOrderStats(p.id, p.unitsSold30d, p.revenue30d);
  const w30 = orderStats.last30d;
  const { unitCost, source } = resolveUnitCost(p, costs);
  const cogs = Math.round(unitCost * w30.units * 100) / 100;
  const allocated = allocateOrderCosts(w30.revenue, storeRevenue, storeCosts);
  const attr = productAttribution?.byProductId[p.id];
  const adCost = attr?.adCost.totalSpend ?? allocated.adCost;

  const grossProfit = Math.round((w30.revenue - cogs) * 100) / 100;
  const netProfit =
    Math.round(
      (w30.revenue -
        cogs -
        w30.discounts -
        w30.refunds -
        allocated.shipping -
        allocated.transactionFees -
        adCost) *
        100,
    ) / 100;
  const marginPct = w30.revenue > 0 ? Math.round((netProfit / w30.revenue) * 1000) / 10 : 0;
  const refundRatePct = w30.revenue > 0 ? Math.round((w30.refunds / w30.revenue) * 1000) / 10 : 0;
  const dailyVelocity = w30.units / 30;
  const daysUntilStockout =
    p.inventoryQuantity > 0 && dailyVelocity > 0
      ? Math.round((p.inventoryQuantity / dailyVelocity) * 10) / 10
      : null;

  const allocated7 = allocateOrderCosts(orderStats.last7d.revenue, storeRevenue * 0.28, {
    ...storeCosts,
    adSpend: storeCosts.adSpend * 0.28,
  });
  const allocatedPrev = allocateOrderCosts(orderStats.previous30d.revenue, storeRevenue * 0.9, {
    ...storeCosts,
    adSpend: storeCosts.adSpend * 0.9,
  });

  const last7d = buildTrendWindow(orderStats.last7d, unitCost, {
    ...allocated7,
    adCost: adCost * 0.28,
  });
  const last30d = buildTrendWindow(orderStats.last30d, unitCost, { ...allocated, adCost });
  const previous30d = buildTrendWindow(orderStats.previous30d, unitCost, {
    ...allocatedPrev,
    adCost: adCost * 0.9,
  });

  const revenueGrowthPct = pctChange(w30.revenue, orderStats.previous30d.revenue);
  const profitGrowthPct = pctChange(netProfit, previous30d.netProfit);
  const marginTrendPct =
    previous30d.marginPct > 0 ? Math.round((marginPct - previous30d.marginPct) * 10) / 10 : null;
  const refundTrendPct = pctChange(
    refundRatePct,
    previous30d.revenue > 0 ? (orderStats.previous30d.refunds / orderStats.previous30d.revenue) * 100 : 0,
  );

  const productRoas = adCost > 0 ? Math.round((w30.revenue / adCost) * 100) / 100 : null;
  const healthInput = {
    marginPct,
    productRoas,
    revenueGrowthPct,
    refundRatePct,
    daysUntilStockout,
    inventory: p.inventoryQuantity,
    unitsSold: w30.units,
    netProfit,
  };
  const { score, label } = computeProductHealthScore(healthInput);
  const healthBreakdown = computeProductHealthBreakdown(healthInput);

  const draft: ProductIntelligenceProfile = {
    productId: p.id,
    title: p.title,
    imageUrl: p.imageUrl ?? null,
    revenue: w30.revenue,
    netSales: Math.round((w30.revenue - w30.discounts) * 100) / 100,
    unitsSold: w30.units,
    cogs,
    shippingCost: allocated.shipping,
    transactionFees: allocated.transactionFees,
    discounts: w30.discounts,
    refunds: w30.refunds,
    refundRatePct,
    refundCost: w30.refunds,
    adCost,
    grossProfit,
    netProfit,
    marginPct,
    productRoas,
    inventory: p.inventoryQuantity,
    daysUntilStockout,
    daysOutOfStock: estimateDaysOutOfStock(p.id, p.inventoryQuantity),
    dailyAdSpend: Math.round((adCost / 30) * 100) / 100,
    lastSaleDaysAgo: estimateLastSaleDaysAgo(w30.units, p.inventoryQuantity),
    salesTrendLabel: salesTrendLabel(revenueGrowthPct),
    lifecycleStage: "Stable",
    healthBreakdown,
    inventoryRisk: inventoryRiskLevel(p.inventoryQuantity, w30.units),
    status: productStatus(netProfit, marginPct, p.inventoryQuantity, daysUntilStockout),
    costSource: source,
    healthScore: score,
    healthLabel: label,
    trends: {
      last7d,
      last30d,
      previous30d,
      revenueGrowthPct,
      profitGrowthPct,
      marginTrendPct,
      refundTrendPct,
    },
    isHero: false,
    isHiddenWinner: false,
    isLosingMoney: netProfit < 0,
    catalogOnly,
  };
  draft.lifecycleStage = computeProductLifecycleStage(draft);
  return draft;
}

export function buildProductIntelligence(
  snapshot: StoreSnapshot,
  costRecords: ProductCostRecord[],
  profitDashboard: ProfitDashboard | null,
  productAttribution?: ProductAttributionDashboard | null,
): ProductIntelligenceDashboard | null {
  if (!snapshot.profitRollups) return null;

  const costs = productCostMap(costRecords);
  const rollups = snapshot.profitRollups.last30d;
  const storeRevenue = rollups.revenue;
  const transactionFees =
    Math.round(
      (rollups.revenue * DEFAULT_TRANSACTION_FEE_RATE + rollups.orders * DEFAULT_TRANSACTION_FEE_FIXED) *
        100,
    ) / 100;
  const storeCosts = {
    shipping: rollups.shipping,
    transactionFees,
    adSpend: profitDashboard?.primary.adSpend ?? 0,
  };

  const products: ProductIntelligenceProfile[] = snapshot.products
    .map((p) =>
      buildProductProfile(p, snapshot, costs, storeRevenue, storeCosts, productAttribution),
    )
    .sort((a, b) => b.netProfit - a.netProfit);

  const heroes = detectHeroProducts(products);
  for (const p of products) {
    const hero = heroes.find((h) => h.productId === p.productId);
    if (hero) {
      p.isHero = true;
      p.heroReason = hero.heroReason;
    }
  }

  const hiddenWinners = detectHiddenWinners(products, snapshot);
  for (const p of products) {
    const hw = hiddenWinners.find((h) => h.productId === p.productId);
    if (hw) {
      p.isHiddenWinner = true;
      p.hiddenWinnerReason = hw.hiddenWinnerReason;
    }
  }

  const losingMoney = products.filter((p) => p.isLosingMoney);
  const inventoryRisk = products.filter(
    (p) => p.inventoryRisk === "low_stock" || p.inventoryRisk === "overstock" || p.inventoryRisk === "dead",
  );

  const netMarginPct = profitDashboard?.primary.profitMarginPct ?? undefined;
  const productOpportunities = evaluateProductGrowthOpportunities(products, snapshot, netMarginPct);

  return {
    syncedAt: snapshot.syncedAt,
    products,
    heroes: products.filter((p) => p.isHero),
    hiddenWinners: products.filter((p) => p.isHiddenWinner),
    losingMoney,
    inventoryRisk,
    topProfitable: products.slice(0, 5).map((p) => toWidget(p, p.netProfit, "net profit")),
    bestMargin: [...products]
      .sort((a, b) => b.marginPct - a.marginPct)
      .slice(0, 5)
      .map((p) => toWidget(p, p.marginPct, "margin", `${p.marginPct}%`)),
    highestRoas: [...products]
      .filter((p) => p.productRoas != null)
      .sort((a, b) => (b.productRoas ?? 0) - (a.productRoas ?? 0))
      .slice(0, 5)
      .map((p) => toWidget(p, p.productRoas!, "ROAS", p.productRoas!.toFixed(2))),
    fastestGrowing: [...products]
      .filter((p) => p.trends.revenueGrowthPct != null)
      .sort((a, b) => (b.trends.revenueGrowthPct ?? 0) - (a.trends.revenueGrowthPct ?? 0))
      .slice(0, 5)
      .map((p) =>
        toWidget(p, p.trends.revenueGrowthPct!, "growth", `+${p.trends.revenueGrowthPct}%`),
      ),
    highestRefunds: [...products]
      .sort((a, b) => b.refundRatePct - a.refundRatePct)
      .slice(0, 5)
      .map((p) => toWidget(p, p.refundRatePct, "refund rate", `${p.refundRatePct}%`)),
    productOpportunities,
  };
}

export function summarizeProductIntelligenceForAi(
  dashboard: ProductIntelligenceDashboard,
): string {
  const top = dashboard.products[0];
  const hero = dashboard.heroes[0];
  const hidden = dashboard.hiddenWinners[0];
  const lines = [
    `${dashboard.products.length} products with sales in the last 30 days.`,
    top ? `Top profit SKU: ${top.title} ($${top.netProfit.toLocaleString()} net, ${top.marginPct}% margin).` : "",
    hero ? `Hero product: ${hero.title} — ${hero.heroReason}` : "",
    hidden ? `Hidden winner: ${hidden.title} — ${hidden.hiddenWinnerReason}` : "",
    dashboard.losingMoney.length > 0
      ? `${dashboard.losingMoney.length} products losing money after allocated costs.`
      : "No products with negative net profit.",
  ].filter(Boolean);
  return lines.join(" ");
}
