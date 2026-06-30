import { hasActiveAdsConnector } from "@/lib/connectors/active";
import type {
  MetaCampaign,
  ProfitOrderRollups,
  ShopifyCollection,
  ShopifyProduct,
  StoreSnapshot,
} from "@/lib/connectors/types";
import type { ProductCostRecord } from "@/lib/db/product-costs";
import { productCostMap } from "@/lib/db/product-costs";
import { totalSpendForWindow } from "@/lib/ads/spend";
import { computeProfitConfidence } from "@/lib/profit/confidence";
import { resolveCostSource } from "@/lib/profit/cost-source";
import { buildProfitMetricMeta } from "@/lib/profit/metric-value";
import { buildProfitKpis } from "@/lib/profit/kpi";
import { computeBlendedRoasDashboard } from "@/lib/profit/roas";
import {
  DEFAULT_TRANSACTION_FEE_FIXED,
  DEFAULT_TRANSACTION_FEE_RATE,
  ESTIMATED_COGS_RATE,
  PROFIT_WINDOW_LABELS,
} from "@/lib/profit/constants";
import type {
  ChannelProfitRow,
  CollectionProfitRow,
  ProductProfitRow,
  ProductProfitStatus,
  ProfitAssumptions,
  ProfitConfidence,
  ProfitDashboard,
  ProfitPeriodMetrics,
  ProfitWindow,
} from "@/lib/profit/types";

function resolveUnitCost(
  product: ShopifyProduct,
  costs: Map<string, ProductCostRecord>,
): { unitCost: number; source: ProductProfitRow["costSource"] } {
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
  product: ShopifyProduct,
  grossProfit: number,
  marginPct: number,
  daysOfCover: number | null,
): ProductProfitStatus {
  if (product.inventoryQuantity === 0) return "Out of Stock";
  if (grossProfit < 0) return "Losing Money";
  if (daysOfCover != null && daysOfCover <= 7) return "Low Stock";
  if (marginPct < 20) return "Low Margin";
  return "Healthy";
}

function sumMetaSpend(campaigns: MetaCampaign[], window: ProfitWindow): number {
  const spend7d = campaigns.reduce((s, c) => s + c.spend7d, 0);
  switch (window) {
    case "today":
    case "yesterday":
      return Math.round((spend7d / 7) * 100) / 100;
    case "last7d":
      return Math.round(spend7d * 100) / 100;
    case "last30d":
      return Math.round(spend7d * (30 / 7) * 100) / 100;
  }
}

function sumMetaRevenue(campaigns: MetaCampaign[], window: ProfitWindow): number {
  const rev7d = campaigns.reduce((s, c) => s + c.revenue7d, 0);
  switch (window) {
    case "today":
    case "yesterday":
      return Math.round((rev7d / 7) * 100) / 100;
    case "last7d":
      return Math.round(rev7d * 100) / 100;
    case "last30d":
      return Math.round(rev7d * (30 / 7) * 100) / 100;
  }
}

function adSpendForWindow(snapshot: StoreSnapshot, window: ProfitWindow): number {
  if (snapshot.adSpendSnapshot) {
    return totalSpendForWindow(snapshot.adSpendSnapshot, window);
  }
  if (hasActiveAdsConnector(snapshot.connectorStates)) {
    return sumMetaSpend(snapshot.campaigns, window);
  }
  return 0;
}

function operationalCostForWindow(
  snapshot: StoreSnapshot,
  window: ProfitWindow,
): number {
  const ops = snapshot.operationalCosts;
  if (!ops) return 0;
  const monthly =
    ops.supportCost30d + ops.warehouseCost30d + (ops.packingCost30d ?? 0);
  switch (window) {
    case "today":
    case "yesterday":
      return Math.round((monthly / 30) * 100) / 100;
    case "last7d":
      return Math.round(((monthly * 7) / 30) * 100) / 100;
    case "last30d":
      return Math.round(monthly * 100) / 100;
  }
}

function buildPeriodMetrics(
  window: ProfitWindow,
  rollups: ProfitOrderRollups,
  adSpend: number,
  usesEstimatedCogs: boolean,
  confidence: ProfitConfidence,
  operationalCost = 0,
): ProfitPeriodMetrics {
  const bucket = rollups[window];
  const transactionFees =
    Math.round(
      (bucket.revenue * DEFAULT_TRANSACTION_FEE_RATE +
        bucket.orders * DEFAULT_TRANSACTION_FEE_FIXED) *
        100,
    ) / 100;

  const grossProfit = Math.round((bucket.revenue - bucket.cogs) * 100) / 100;
  const rawNetProfit =
    Math.round(
      (bucket.revenue -
        bucket.cogs -
        bucket.shipping -
        bucket.refunds -
        transactionFees -
        adSpend -
        operationalCost) *
        100,
    ) / 100;

  const blocked = confidence.status === "unavailable";
  const netProfit = blocked ? null : rawNetProfit;
  const profitMarginPct =
    !blocked && bucket.revenue > 0
      ? Math.round((rawNetProfit / bucket.revenue) * 1000) / 10
      : null;

  const netProfitMeta = buildProfitMetricMeta(rawNetProfit, confidence);

  return {
    window,
    label: PROFIT_WINDOW_LABELS[window],
    revenue: bucket.revenue,
    grossProfit,
    netProfit,
    netProfitMeta,
    profitMarginPct,
    cogs: bucket.cogs,
    adSpend,
    shippingCost: bucket.shipping,
    transactionFees,
    refunds: bucket.refunds,
    orders: bucket.orders,
    usesEstimatedCogs,
  };
}

function buildProductRows(
  products: ShopifyProduct[],
  costs: Map<string, ProductCostRecord>,
): ProductProfitRow[] {
  return products
    .filter((p) => p.unitsSold30d > 0 || p.revenue30d > 0)
    .map((p) => {
      const { unitCost, source } = resolveUnitCost(p, costs);
      const cogs = Math.round(unitCost * p.unitsSold30d * 100) / 100;
      const grossProfit = Math.round((p.revenue30d - cogs) * 100) / 100;
      const marginPct =
        p.revenue30d > 0
          ? Math.round((grossProfit / p.revenue30d) * 1000) / 10
          : 0;
      const dailyVelocity = p.unitsSold30d / 30;
      const daysOfCover =
        dailyVelocity > 0 ? p.inventoryQuantity / dailyVelocity : null;

      return {
        productId: p.id,
        title: p.title,
        revenue: p.revenue30d,
        cogs,
        grossProfit,
        netProfit: grossProfit,
        marginPct,
        unitsSold: p.unitsSold30d,
        inventory: p.inventoryQuantity,
        daysOfCover: daysOfCover != null ? Math.round(daysOfCover * 10) / 10 : null,
        status: productStatus(p, grossProfit, marginPct, daysOfCover),
        unitCost: source === "estimated" ? null : unitCost,
        costSource: source,
        losingMoney: grossProfit < 0,
      };
    })
    .sort((a, b) => b.netProfit - a.netProfit);
}

function buildCollectionRows(
  collections: ShopifyCollection[],
  products: ShopifyProduct[],
  costs: Map<string, ProductCostRecord>,
): CollectionProfitRow[] {
  return collections
    .map((c) => {
      const inCollection = products.filter((p) => p.collectionIds.includes(c.id));
      let revenue = 0;
      let cogs = 0;
      for (const p of inCollection) {
        revenue += p.revenue30d;
        const { unitCost } = resolveUnitCost(p, costs);
        cogs += unitCost * p.unitsSold30d;
      }
      cogs = Math.round(cogs * 100) / 100;
      const grossProfit = Math.round((revenue - cogs) * 100) / 100;
      const marginPct = revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0;
      return {
        collectionId: c.id,
        title: c.title,
        revenue: Math.round(revenue * 100) / 100,
        cogs,
        grossProfit,
        netProfit: grossProfit,
        marginPct,
      };
    })
    .filter((c) => c.revenue > 0)
    .sort((a, b) => b.grossProfit - a.grossProfit);
}

function buildChannelRows(
  snapshot: StoreSnapshot,
  window: ProfitWindow,
): ChannelProfitRow[] {
  const rollups = snapshot.profitRollups;
  if (!rollups) return [];

  const bucket = rollups.last30d;
  const adsConnected = hasActiveAdsConnector(snapshot.connectorStates);
  const metaSpend = adsConnected ? sumMetaSpend(snapshot.campaigns, window) : 0;
  const metaRevenue = adsConnected ? sumMetaRevenue(snapshot.campaigns, window) : 0;
  const totalRevenue = rollups[window].revenue;
  const organicRevenue = Math.max(0, Math.round((totalRevenue - metaRevenue) * 100) / 100);

  const channels: ChannelProfitRow[] = [];

  if (adsConnected && metaSpend > 0) {
    channels.push({
      channel: "Meta Ads",
      revenue: metaRevenue,
      adSpend: metaSpend,
      grossProfit: Math.round((metaRevenue - metaSpend) * 100) / 100,
      roas: metaSpend > 0 ? Math.round((metaRevenue / metaSpend) * 100) / 100 : null,
    });
  }

  channels.push({
    channel: "Shopify (Organic & Direct)",
    revenue: organicRevenue,
    adSpend: 0,
    grossProfit: organicRevenue,
    roas: null,
  });

  return channels;
}

function countCostGaps(
  products: ShopifyProduct[],
  costs: Map<string, ProductCostRecord>,
): Pick<ProfitAssumptions, "productsMissingCost" | "productsWithEstimatedCost"> {
  let productsMissingCost = 0;
  let productsWithEstimatedCost = 0;
  for (const p of products) {
    if (p.unitsSold30d === 0) continue;
    const resolved = resolveUnitCost(p, costs);
    if (resolved.source === "estimated") productsWithEstimatedCost += 1;
    if (p.unitCost == null && !costs.has(p.id)) productsMissingCost += 1;
  }
  return { productsMissingCost, productsWithEstimatedCost };
}

export function computeProfitDashboard(
  snapshot: StoreSnapshot,
  costRecords: ProductCostRecord[],
  options?: { currency?: string },
): ProfitDashboard | null {
  if (!snapshot.profitRollups) return null;

  const costs = productCostMap(costRecords);
  const confidence = computeProfitConfidence(snapshot.products, costs, snapshot);
  const windows: ProfitWindow[] = ["today", "yesterday", "last7d", "last30d"];
  const adsConnected = hasActiveAdsConnector(snapshot.connectorStates);

  const periods = windows.map((w) =>
    buildPeriodMetrics(
      w,
      snapshot.profitRollups!,
      adsConnected ? adSpendForWindow(snapshot, w) : 0,
      confidence.usesEstimatedCogs,
      confidence,
      operationalCostForWindow(snapshot, w),
    ),
  );

  const byProduct = buildProductRows(snapshot.products, costs);
  const byCollection = buildCollectionRows(
    snapshot.collections,
    snapshot.products,
    costs,
  );
  const byChannel = buildChannelRows(snapshot, "last30d");
  const costGaps = countCostGaps(snapshot.products, costs);

  const primary = periods.find((p) => p.window === "last30d") ?? periods[periods.length - 1];
  const primaryProfit = primary.netProfitMeta;

  const blendedRoas = computeBlendedRoasDashboard(snapshot);
  const adSpendScaled =
    snapshot.adSpendSnapshot?.spendScaled ??
    !snapshot.metaAccountRollups;

  const partial: ProfitDashboard = {
    syncedAt: snapshot.syncedAt,
    currency: options?.currency ?? "USD",
    confidence,
    primaryProfit,
    periods,
    primary,
    kpis: [],
    blendedRoas,
    byProduct,
    byCollection,
    byChannel,
    assumptions: {
      transactionFeeRate: DEFAULT_TRANSACTION_FEE_RATE,
      transactionFeeFixed: DEFAULT_TRANSACTION_FEE_FIXED,
      adSpendScaled,
      ...costGaps,
    },
    topProfitableProducts: byProduct.filter((p) => p.netProfit > 0).slice(0, 5),
    losingProducts: byProduct.filter((p) => p.losingMoney).slice(0, 5),
  };

  partial.kpis = buildProfitKpis(partial, snapshot.salesTrends, blendedRoas);

  return partial;
}

/** Lightweight summary for AI context */
export function summarizeProfitForAi(dashboard: ProfitDashboard): string {
  const p = dashboard.primary;
  const meta = dashboard.primaryProfit;
  const top = dashboard.topProfitableProducts[0];
  const losing = dashboard.losingProducts[0];
  const lines: string[] = [];

  if (meta.status === "unavailable") {
    lines.push(
      "Profit is not available — required cost data is missing.",
      `Missing: ${dashboard.confidence.missingInputs.join(", ") || "revenue or product costs"}.`,
      dashboard.confidence.notice ?? "Complete Profit Setup before analyzing profitability.",
    );
    return lines.join(" ");
  }

  const profitLabel = meta.status === "estimated" ? "Estimated monthly profit" : "Net profit (30d)";
  lines.push(
    `${profitLabel}: ${formatMoney(meta.value ?? 0)} on ${formatMoney(p.revenue)} revenue${p.profitMarginPct != null ? ` (${p.profitMarginPct}% margin)` : ""}.`,
    `Profit confidence: ${dashboard.confidence.scorePct}% (${dashboard.confidence.status}) — ${dashboard.confidence.reason}`,
  );

  if (meta.status === "estimated" && dashboard.confidence.missingInputs.length > 0) {
    lines.push(
      `This analysis uses incomplete cost data. Missing or estimated: ${dashboard.confidence.missingInputs.join(", ")}.`,
    );
    if (dashboard.confidence.notice) lines.push(dashboard.confidence.notice);
  }

  lines.push(
    `COGS: ${formatMoney(p.cogs)}, Ad spend: ${formatMoney(p.adSpend)}, Fees: ${formatMoney(p.transactionFees)}, Refunds: ${formatMoney(p.refunds)}.`,
  );
  if (top) lines.push(`Top profit SKU: ${top.title} (+${formatMoney(top.netProfit)}).`);
  if (losing) lines.push(`Losing SKU: ${losing.title} (${formatMoney(losing.netProfit)}).`);
  if (dashboard.assumptions.productsWithEstimatedCost > 0) {
    lines.push(
      `${dashboard.assumptions.productsWithEstimatedCost} products use estimated costs — add real COGS for accuracy.`,
    );
  }
  return lines.join(" ");
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function compareProfitPeriods(
  dashboard: ProfitDashboard,
): { decreased: boolean; changePct: number | null; message: string } {
  const today = dashboard.periods.find((p) => p.window === "today");
  const yesterday = dashboard.periods.find((p) => p.window === "yesterday");
  if (!today || !yesterday || yesterday.netProfit == null || yesterday.netProfit === 0) {
    return {
      decreased: false,
      changePct: null,
      message: "Not enough daily profit history to compare today vs yesterday.",
    };
  }
  const changePct =
    today.netProfit != null
      ? Math.round(((today.netProfit - yesterday.netProfit) / Math.abs(yesterday.netProfit)) * 1000) /
        10
      : null;
  const decreased = (today.netProfit ?? 0) < yesterday.netProfit;
  return {
    decreased,
    changePct,
    message:
      today.netProfit == null
        ? "Profit is not available for today — complete cost setup first."
        : decreased
          ? `Profit decreased ${Math.abs(changePct ?? 0)}% vs yesterday (${formatMoney(today.netProfit)} today vs ${formatMoney(yesterday.netProfit)} yesterday).`
          : `Profit is up ${changePct}% vs yesterday.`,
  };
}
