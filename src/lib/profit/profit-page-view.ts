import { buildMarketingCampaigns } from "@/lib/analytics/marketing";
import type { ChartDefinition } from "@/lib/analytics/types";
import type { ProductAttributionDashboard } from "@/lib/attribution/product-types";
import { ATTRIBUTION_CONFIDENCE_LABELS } from "@/lib/attribution/product-types";
import type { DailyMetricPoint, StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitWaterfall } from "@/lib/decisions/product-economics";
import {
  enrichChannelProfitabilityCard,
  estimateChannelTrends,
  buildProfitChannelBreakdown,
  buildDisconnectedChannelCard,
  type ChannelProfitabilityCard,
} from "@/lib/analytics/channel-profitability-card";
import {
  buildStagedRecoveryOpportunities,
  channelOptimizationRecommendation,
  estimateBreakEvenRoas,
  type ProfitRecoveryOpportunity,
} from "@/lib/profit/profit-recommendations";
import type {
  ProductProfitRow,
  ProfitConfidence,
  ProfitDashboard,
  ProfitInputAvailability,
  ProfitInputId,
  ProfitPeriodMetrics,
} from "@/lib/profit/types";
import { PROFIT_INPUT_LABELS } from "@/lib/profit/types";

export type { ProfitRecoveryOpportunity } from "@/lib/profit/profit-recommendations";

export type ProfitAiSummary = {
  headline: string;
  primaryReason: string;
  topRecovery: ProfitRecoveryOpportunity | null;
  profitable: boolean;
  confidencePct: number;
  status: ProfitConfidence["status"];
};

export type ProfitConfidenceCategory = {
  id: ProfitInputId;
  label: string;
  state: "verified" | "estimated" | "missing";
  confidencePct: number;
};

export type EnrichedProductProfitRow = ProductProfitRow & {
  displayStatus: string;
  adSpend: number;
  roas: number | null;
  recommendation: string;
  attributionConfidencePct: number;
  attributionConfidenceLabel: string;
  attributionMethod: string;
  primaryTrafficSource: string;
  metaSpend: number | null;
  googleSpend: number | null;
  adCostEstimated: boolean;
  attributedNetProfit: number;
};

export type ChannelProfitCard = ChannelProfitabilityCard;

export type WhyLosingMoney = {
  title: string;
  paragraphs: string[];
  daysToProfitability: number | null;
};

export type ProfitPageView = {
  aiSummary: ProfitAiSummary;
  recovery: {
    totalMonthlyRecovery: number;
    opportunities: ProfitRecoveryOpportunity[];
  };
  waterfall: ProfitWaterfall;
  confidenceCategories: ProfitConfidenceCategory[];
  timelineCharts: Record<"today" | "last7d" | "last30d" | "last90d", ChartDefinition>;
  channelCards: ChannelProfitCard[];
  enrichedProducts: EnrichedProductProfitRow[];
  whyLosingMoney: WhyLosingMoney | null;
  setupComplete: boolean;
  productAttribution: ProductAttributionDashboard | null;
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function inputConfidenceState(
  input: ProfitInputAvailability,
): { state: ProfitConfidenceCategory["state"]; confidencePct: number } {
  if (!input.available || input.source === "missing") {
    return { state: "missing", confidencePct: 0 };
  }
  if (input.estimated || input.source === "estimated") {
    return { state: "estimated", confidencePct: 70 };
  }
  return { state: "verified", confidencePct: 100 };
}

export function buildConfidenceCategories(
  confidence: ProfitConfidence,
): ProfitConfidenceCategory[] {
  const order: ProfitInputId[] = [
    "revenue",
    "product_costs",
    "shipping_costs",
    "payment_fees",
    "packaging_costs",
    "advertising",
    "refunds",
    "taxes",
  ];
  const byId = new Map(confidence.inputs.map((i) => [i.id, i]));
  return order
    .map((id) => {
      const input = byId.get(id);
      if (!input) return null;
      const { state, confidencePct } = inputConfidenceState(input);
      return {
        id,
        label: PROFIT_INPUT_LABELS[id],
        state,
        confidencePct,
      };
    })
    .filter((row): row is ProfitConfidenceCategory => row != null);
}

export function buildProfitWaterfall(period: ProfitPeriodMetrics): ProfitWaterfall {
  return {
    revenue: period.revenue,
    productCost: period.cogs,
    advertising: period.adSpend,
    shipping: period.shippingCost,
    processingFees: period.transactionFees,
    netProfit: period.netProfit ?? 0,
    refunds: period.refunds,
  };
}

export function buildRecoveryOpportunities(
  dashboard: ProfitDashboard,
  snapshot: StoreSnapshot,
): ProfitRecoveryOpportunity[] {
  return buildStagedRecoveryOpportunities(dashboard, snapshot);
}

function primaryLossReason(dashboard: ProfitDashboard): string {
  const p = dashboard.primary;
  const net = p.netProfit ?? 0;
  if (net >= 0) {
    if (p.adSpend > p.grossProfit * 0.6) {
      return "Advertising spend is consuming a large share of gross profit.";
    }
    return "Revenue exceeds total costs with healthy unit economics.";
  }

  const costs = [
    { label: "advertising spend exceeding gross profit", value: p.adSpend - p.grossProfit, check: p.adSpend > p.grossProfit },
    { label: "high product costs (COGS)", value: p.cogs - p.revenue * 0.35, check: p.cogs > p.revenue * 0.45 },
    { label: "shipping and fulfillment costs", value: p.shippingCost, check: p.shippingCost > p.revenue * 0.08 },
    { label: "payment processing fees", value: p.transactionFees, check: p.transactionFees > p.revenue * 0.04 },
    { label: "refunds and returns", value: p.refunds, check: p.refunds > p.revenue * 0.03 },
  ];
  const top = costs.filter((c) => c.check).sort((a, b) => b.value - a.value)[0];
  return top
    ? `The primary reason is ${top.label}.`
    : "Multiple cost factors are compressing margin below break-even.";
}

export function buildAiSummary(
  dashboard: ProfitDashboard,
  recovery: ProfitRecoveryOpportunity[],
): ProfitAiSummary {
  const net = dashboard.primary.netProfit ?? 0;
  const profitable = net >= 0 && dashboard.primaryProfit.status !== "unavailable";
  const topRecovery = recovery[0] ?? null;

  return {
    headline: profitable
      ? dashboard.primaryProfit.status === "estimated"
        ? "Your store appears profitable, but profit is estimated."
        : "Your store is currently profitable."
      : dashboard.primaryProfit.status === "unavailable"
        ? "Profit cannot be calculated yet."
        : "Your store is currently unprofitable.",
    primaryReason: primaryLossReason(dashboard),
    topRecovery,
    profitable,
    confidencePct: dashboard.confidence.scorePct,
    status: dashboard.confidence.status,
  };
}

export function buildWhyLosingMoney(
  dashboard: ProfitDashboard,
  recoveryTotal: number,
): WhyLosingMoney | null {
  const p = dashboard.primary;
  const net = p.netProfit ?? 0;
  if (net >= 0 || dashboard.primaryProfit.status === "unavailable") return null;

  const adPctOfGross =
    p.grossProfit > 0 ? Math.round((p.adSpend / p.grossProfit) * 100) : null;
  const paragraphs: string[] = [];

  if (adPctOfGross != null && adPctOfGross > 100) {
    paragraphs.push(
      `Advertising costs currently represent ${adPctOfGross}% of your gross profit.`,
      "Your products are profitable before advertising, but paid acquisition is eliminating all margin.",
    );
  } else if (p.cogs > p.revenue * 0.5) {
    paragraphs.push(
      "Product costs are consuming more than half of revenue.",
      "Review COGS, supplier pricing, or retail prices on low-margin SKUs.",
    );
  } else {
    paragraphs.push(
      `Net loss of ${formatMoney(Math.abs(net))} over the last 30 days after all cost deductions.`,
      primaryLossReason(dashboard).replace("The primary reason is ", "The main driver is "),
    );
  }

  let daysToProfitability: number | null = null;
  if (recoveryTotal > 0 && net < 0) {
    const dailyLoss = Math.abs(net) / 30;
    const dailyRecovery = recoveryTotal / 30;
    if (dailyRecovery > dailyLoss * 0.3) {
      daysToProfitability = Math.min(90, Math.round((Math.abs(net) / dailyRecovery) * 7));
    }
  }

  if (daysToProfitability != null) {
    paragraphs.push(
      `If the top recommendations are applied, AI estimates profitability can return within approximately ${daysToProfitability} days.`,
    );
  }

  return {
    title: "Why are you losing money?",
    paragraphs,
    daysToProfitability,
  };
}

function estimateDailyNetProfit(
  point: DailyMetricPoint,
  period: ProfitPeriodMetrics,
): number {
  if (period.revenue <= 0) return 0;
  const cogsRate = period.cogs / period.revenue;
  const refundRate = period.refunds / period.revenue;
  const feePerOrder = period.orders > 0 ? period.transactionFees / period.orders : 0;
  const shipPerOrder = period.orders > 0 ? period.shippingCost / period.orders : 0;
  return round(
    point.revenue -
      point.revenue * cogsRate -
      point.revenue * refundRate -
      point.orders * (feePerOrder + shipPerOrder) -
      point.adSpend,
  );
}

function sliceDailyMetrics(
  metrics: DailyMetricPoint[],
  days: number,
): DailyMetricPoint[] {
  if (metrics.length <= days) return metrics;
  return metrics.slice(metrics.length - days);
}

export function buildProfitTimelineCharts(
  snapshot: StoreSnapshot,
  dashboard: ProfitDashboard,
): ProfitPageView["timelineCharts"] {
  const metrics = snapshot.dailyMetrics ?? [];
  const period = dashboard.primary;
  const ranges = {
    today: 1,
    last7d: 7,
    last30d: 30,
    last90d: 90,
  } as const;

  const charts = {} as ProfitPageView["timelineCharts"];

  for (const [key, days] of Object.entries(ranges) as [
    keyof ProfitPageView["timelineCharts"],
    number,
  ][]) {
    const current = sliceDailyMetrics(metrics, days);
    const previous = sliceDailyMetrics(metrics, days * 2).slice(
      0,
      Math.max(0, metrics.length - days),
    );

    const currentPoints = current.map((p) => ({
      date: p.date.slice(5),
      value: estimateDailyNetProfit(p, period),
    }));

    const prevPoints = previous.map((p) => ({
      date: p.date.slice(5),
      value: estimateDailyNetProfit(p, period),
    }));

    charts[key] = {
      id: `profit-timeline-${key}`,
      title: "Profit Trend",
      format: "currency",
      series: [
        {
          id: "current",
          label: "Current period",
          color: "#2563eb",
          points: currentPoints,
        },
        ...(prevPoints.length >= 2
          ? [
              {
                id: "previous",
                label: "Previous period",
                color: "#94a3b8",
                points: prevPoints.slice(-currentPoints.length),
              },
            ]
          : []),
      ],
    };
  }

  return charts;
}

function channelRecommendation(
  card: Pick<ChannelProfitabilityCard, "connected" | "revenue" | "adSpend" | "roas" | "netContribution" | "contributionMarginPct" | "channelLabel">,
  breakEvenRoas: number | null,
): string {
  return channelOptimizationRecommendation(
    {
      connected: card.connected,
      revenue: card.revenue,
      adSpend: card.adSpend,
      roas: card.roas,
      netProfit: card.netContribution,
      marginPct: card.contributionMarginPct,
      channel: card.channelLabel,
    },
    breakEvenRoas,
  );
}

export function buildChannelProfitCards(
  dashboard: ProfitDashboard,
  snapshot: StoreSnapshot,
): ChannelProfitCard[] {
  const p = dashboard.primary;
  const storeRevenue = p.revenue;
  const storeNetContribution = p.netProfit ?? 0;
  const storeAov = p.orders > 0 ? p.revenue / p.orders : snapshot.storeMetrics.aov30d || 80;

  const cards: ChannelProfitCard[] = [];
  const campaigns = buildMarketingCampaigns(snapshot);
  const metaRevenue = campaigns
    .filter((c) => c.channel === "meta")
    .reduce((s, c) => s + c.revenue, 0);
  const metaSpend = campaigns
    .filter((c) => c.channel === "meta")
    .reduce((s, c) => s + c.spend, 0);
  const googleRevenue = campaigns
    .filter((c) => c.channel === "google")
    .reduce((s, c) => s + c.revenue, 0);
  const googleSpend = campaigns
    .filter((c) => c.channel === "google")
    .reduce((s, c) => s + c.spend, 0);

  const scale = 30 / 7;
  const breakEvenRoas = estimateBreakEvenRoas(dashboard);
  const trends = estimateChannelTrends({
    dailyMetrics: snapshot.dailyMetrics,
    channelRevenueShare: 1,
  });

  type Draft = {
    channelId: string;
    channelLabel: string;
    revenue: number;
    adSpend: number;
    connected: boolean;
    isPaid: boolean;
  };

  const drafts: Draft[] = [];

  if (metaSpend > 0 || metaRevenue > 0) {
    drafts.push({
      channelId: "meta",
      channelLabel: "Meta Ads",
      revenue: Math.round(metaRevenue * scale),
      adSpend: Math.round(metaSpend * scale),
      connected: true,
      isPaid: true,
    });
  }
  if (googleSpend > 0 || googleRevenue > 0) {
    drafts.push({
      channelId: "google",
      channelLabel: "Google Ads",
      revenue: Math.round(googleRevenue * scale),
      adSpend: Math.round(googleSpend * scale),
      connected: true,
      isPaid: true,
    });
  }

  const paidRevenue30d =
    campaigns
      .filter((c) => c.channel === "meta" || c.channel === "google")
      .reduce((s, c) => s + c.revenue, 0) * scale;
  const organicRevenue = Math.max(0, Math.round((p.revenue - paidRevenue30d) * 100) / 100);
  drafts.push({
    channelId: "organic",
    channelLabel: "Organic",
    revenue: organicRevenue,
    adSpend: 0,
    connected: true,
    isPaid: false,
  });

  if (snapshot.klaviyoSnapshot) {
    const k = snapshot.klaviyoSnapshot;
    drafts.push({
      channelId: "email",
      channelLabel: "Email",
      revenue: k.emailAttributedRevenue30d,
      adSpend: k.rollups.last30d.spend,
      connected: true,
      isPaid: false,
    });
  } else {
    drafts.push({
      channelId: "email",
      channelLabel: "Email",
      revenue: 0,
      adSpend: 0,
      connected: false,
      isPaid: false,
    });
  }

  drafts.push({
    channelId: "referral",
    channelLabel: "Referral",
    revenue: 0,
    adSpend: 0,
    connected: false,
    isPaid: false,
  });

  const enriched = drafts
    .map((draft) => {
      const profitBreakdown = buildProfitChannelBreakdown({
        channelRevenue: draft.revenue,
        storeRevenue,
        profitDashboard: dashboard,
        advertisingCost: draft.adSpend,
      });
      const orders =
        draft.revenue > 0 && storeAov > 0 ? Math.max(1, Math.round(draft.revenue / storeAov)) : 0;
      const aov = orders > 0 ? Math.round(draft.revenue / orders) : Math.round(storeAov);

      const card = enrichChannelProfitabilityCard({
        channelId: draft.channelId,
        channelLabel: draft.channelLabel,
        sessions: 0,
        revenue: draft.revenue,
        orders,
        aov,
        isPaid: draft.isPaid,
        connected: draft.connected,
        profitBreakdown: draft.revenue > 0 ? profitBreakdown : null,
        storeTotals: {
          revenue: storeRevenue,
          netContribution: storeNetContribution,
          sessions: 0,
        },
        trends,
        adSpend: draft.adSpend,
        roas: draft.adSpend > 0 ? round((draft.revenue / draft.adSpend) * 100) / 100 : null,
        existingRecommendation: "",
      });

      if (!card) {
        if (!draft.connected) {
          return buildDisconnectedChannelCard({
            channelId: draft.channelId,
            channelLabel: draft.channelLabel,
          });
        }
        return null;
      }

      return card;
    })
    .filter((c): c is ChannelProfitCard => c != null);

  const topMargin = Math.max(
    ...enriched.filter((c) => c.revenue > 0).map((c) => c.contributionMarginPct),
    -Infinity,
  );

  for (const card of enriched) {
    if (card.revenue > 0 && card.contributionMarginPct >= topMargin - 0.1) {
      card.narrative = `${card.channelLabel} generated the highest profit margin in your acquisition mix.`;
    }
    if (!card.recommendedAction) {
      card.recommendedAction = channelRecommendation(card, breakEvenRoas);
    }
  }

  cards.push(...enriched);

  return cards.sort((a, b) => b.netContribution - a.netContribution);
}

function productDisplayStatus(row: ProductProfitRow): string {
  if (row.inventory > 20 && row.unitsSold < 3) return "Dead Inventory";
  if (row.netProfit > 0 && row.marginPct >= 35 && row.unitsSold >= 15) return "Winner";
  return row.status;
}

function productRecommendation(row: EnrichedProductProfitRow): string {
  if (row.displayStatus === "Dead Inventory") return "Clearance or bundle to move stock";
  if (row.displayStatus === "Winner") return "Scale ads and protect inventory";
  if (row.losingMoney) return "Raise price or reduce COGS";
  if (row.displayStatus === "Low Margin") return "Test price increase or reduce ad spend";
  if (row.displayStatus === "Out of Stock") return "Restock high-velocity SKU";
  if (row.displayStatus === "Low Stock") return "Reorder before stockout";
  return "Maintain current strategy";
}

export function enrichProductRows(
  dashboard: ProfitDashboard,
  attribution: ProductAttributionDashboard | null,
): EnrichedProductProfitRow[] {
  const totalRevenue = Math.max(1, dashboard.byProduct.reduce((s, p) => s + p.revenue, 0));
  const totalAdSpend = dashboard.primary.adSpend;

  return dashboard.byProduct.map((row) => {
    const attr = attribution?.byProductId[row.productId];
    const adSpend = attr?.adCost.totalSpend ?? round(totalAdSpend * (row.revenue / totalRevenue));
    const roas = attr?.roas ?? (adSpend > 0 ? round((row.revenue / adSpend) * 100) / 100 : null);
    const attributedNetProfit = attr?.netProfit ?? row.netProfit;
    const enriched: EnrichedProductProfitRow = {
      ...row,
      netProfit: attributedNetProfit,
      grossProfit: attr?.grossProfit ?? row.grossProfit,
      marginPct: attr?.marginPct ?? row.marginPct,
      adSpend,
      roas,
      displayStatus: productDisplayStatus({ ...row, netProfit: attributedNetProfit }),
      recommendation: attr?.recommendation ?? "",
      attributionConfidencePct: attr?.confidencePct ?? 0,
      attributionConfidenceLabel: attr
        ? ATTRIBUTION_CONFIDENCE_LABELS[attr.confidenceLevel]
        : "Unknown",
      attributionMethod: attr?.methodLabel ?? "Revenue Allocation",
      primaryTrafficSource: attr?.primaryTrafficSource ?? "Unknown",
      metaSpend: attr?.adCost.metaSpend ?? null,
      googleSpend: attr?.adCost.googleSpend ?? null,
      adCostEstimated: attr?.adCost.isEstimated ?? true,
      attributedNetProfit,
      losingMoney: attributedNetProfit < 0,
    };
    if (!enriched.recommendation) {
      enriched.recommendation = productRecommendation(enriched);
    }
    return enriched;
  });
}

export function assembleProfitPageView(
  dashboard: ProfitDashboard,
  snapshot: StoreSnapshot,
  productAttribution: ProductAttributionDashboard | null = null,
): ProfitPageView {
  const recoveryOps = buildRecoveryOpportunities(dashboard, snapshot);
  const totalMonthlyRecovery = recoveryOps.reduce(
    (s, o) => s + o.estimatedMonthlyRecovery,
    0,
  );

  return {
    aiSummary: buildAiSummary(dashboard, recoveryOps),
    recovery: {
      totalMonthlyRecovery,
      opportunities: recoveryOps.slice(0, 5),
    },
    waterfall: buildProfitWaterfall(dashboard.primary),
    confidenceCategories: buildConfidenceCategories(dashboard.confidence),
    timelineCharts: buildProfitTimelineCharts(snapshot, dashboard),
    channelCards: buildChannelProfitCards(dashboard, snapshot),
    enrichedProducts: enrichProductRows(dashboard, productAttribution),
    whyLosingMoney: buildWhyLosingMoney(dashboard, totalMonthlyRecovery),
    setupComplete: !dashboard.confidence.setupRequired,
    productAttribution,
  };
}
