import { analyzeSalesTrends } from "@/lib/ai/sales-trends";
import { analyzeInventoryContext } from "@/lib/attribution/inventory-context";
import { resolveBreakEvenModel } from "@/lib/attribution/decision-engine";
import type { StoreSnapshot } from "@/lib/connectors/types";
import { estimateBreakEvenRoas } from "@/lib/profit/profit-recommendations";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { SupportingMetric } from "@/lib/types";
import type { TrendAnalysis } from "@/lib/insights/types";
import type { CommerceOpportunity } from "@/lib/insights/opportunity-schema";
import type { CopilotStructuredResponse } from "./types";
import type { CopilotDataBundle } from "./data";

export type InsightBottleneck =
  | "revenue"
  | "profit"
  | "roas"
  | "inventory"
  | "conversion"
  | "cash_flow"
  | "overview";

export type ValidatedStoreInsight = {
  title: string;
  summary: string;
  evidence: SupportingMetric[];
  confidencePct: number;
  bottleneck: InsightBottleneck;
  /** True when headline metrics disagree (e.g. user asked about revenue drop but revenue is up). */
  metricsConflict: boolean;
  recommendation: string;
};

export type InsightMetricInput = {
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  trends?: TrendAnalysis | null;
  opportunities?: CommerceOpportunity[];
};

function fmtPct(pct: number | null | undefined): string {
  if (pct == null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function collectAdRollups(snapshot: StoreSnapshot): { spend7d: number; revenue7d: number } {
  const ad = snapshot.adSpendSnapshot?.totalRollups.last7d;
  if (ad) {
    return { spend7d: ad.spend, revenue7d: ad.attributedRevenue };
  }
  const google = snapshot.googleAdsSnapshot?.rollups.last7d;
  const metaSpend = snapshot.campaigns.reduce((s, c) => s + c.spend7d, 0);
  const metaRev = snapshot.campaigns.reduce((s, c) => s + c.revenue7d, 0);
  if (google && google.spend > 0) {
    return {
      spend7d: google.spend + metaSpend,
      revenue7d: google.attributedRevenue + metaRev,
    };
  }
  return { spend7d: metaSpend, revenue7d: metaRev };
}

function resolveBreakEvenRoas(
  snapshot: StoreSnapshot,
  profitDashboard?: ProfitDashboard | null,
): number | null {
  if (profitDashboard) {
    const fromAttribution = resolveBreakEvenModel(profitDashboard, 0.58).breakEvenRoas;
    if (fromAttribution > 0) return fromAttribution;
    const estimated = estimateBreakEvenRoas(profitDashboard);
    if (estimated != null && estimated > 0) return estimated;
  }
  return null;
}

function resolveCurrentRoas(
  snapshot: StoreSnapshot,
  profitDashboard: ProfitDashboard | null | undefined,
  spend7d: number,
  revenue7d: number,
): number | null {
  if (spend7d > 0 && revenue7d > 0) {
    return Math.round((revenue7d / spend7d) * 100) / 100;
  }
  const blended = profitDashboard?.blendedRoas?.blendedRoas30d;
  if (blended != null && blended > 0) return blended;
  const p = profitDashboard?.primary;
  if (p && p.adSpend > 0 && p.revenue > 0) {
    return Math.round((p.revenue / p.adSpend) * 100) / 100;
  }
  return null;
}

function inventoryIsHighRisk(snapshot: StoreSnapshot): boolean {
  const ctx = analyzeInventoryContext(snapshot);
  return ctx.severity === "critical" || ctx.severity === "low";
}

function campaignGroupNames(snapshot: StoreSnapshot): { prospecting: string | null; retargeting: string | null } {
  let prospecting: string | null = null;
  let retargeting: string | null = null;
  for (const c of snapshot.campaigns) {
    const n = c.name.toLowerCase();
    if (!prospecting && n.includes("prospect")) prospecting = c.name;
    if (!retargeting && (n.includes("retarget") || n.includes("remarket") || n.includes("warm"))) {
      retargeting = c.name;
    }
  }
  return { prospecting, retargeting };
}

function advertisingRecommendation(snapshot: StoreSnapshot, opportunities: CommerceOpportunity[]): string {
  const adOpp = opportunities.find(
    (o) =>
      o.category === "roas" ||
      o.category === "spend_efficiency" ||
      o.category === "campaign_performance" ||
      o.title.toLowerCase().includes("roas"),
  );
  if (adOpp?.recommendation) return adOpp.recommendation;

  const { prospecting, retargeting } = campaignGroupNames(snapshot);
  const groups = [prospecting, retargeting].filter(Boolean) as string[];
  if (groups.length >= 2) {
    return `Pause only the lowest-performing ad sets in **${groups[0]}** and **${groups[1]}** instead of pausing entire campaigns. Reallocate budget toward campaigns, creatives, and audiences that consistently exceed the break-even ROAS to preserve learning while improving profitability.`;
  }
  if (groups.length === 1) {
    return `Pause only the lowest-performing ad sets in **${groups[0]}** instead of pausing the entire campaign. Reallocate budget toward audiences and creatives that exceed break-even ROAS.`;
  }
  return "Trim spend on the lowest-performing ad sets and creatives before pausing full campaigns. Shift budget to audiences and placements that consistently exceed break-even ROAS.";
}

/** Collect KPIs used by the insight decision engine. */
export function collectInsightMetrics(input: InsightMetricInput) {
  const salesTrends = analyzeSalesTrends(input.snapshot.salesTrends);
  const revenueWoW =
    salesTrends.weekOverWeek?.changePct ??
    input.trends?.metrics.find((m) => m.id === "revenue_7d")?.changePct ??
    null;
  const revenue30dChange =
    salesTrends.monthOverMonth?.changePct ??
    input.trends?.metrics.find((m) => m.id === "revenue_30d")?.changePct ??
    null;

  const revenue30d = input.profitDashboard?.primary.revenue ?? input.snapshot.storeMetrics.revenue30d;
  const profit = input.profitDashboard?.primary.netProfit ?? null;
  const { spend7d, revenue7d } = collectAdRollups(input.snapshot);
  const breakEvenRoas = resolveBreakEvenRoas(input.snapshot, input.profitDashboard);
  const currentRoas = resolveCurrentRoas(input.snapshot, input.profitDashboard, spend7d, revenue7d);
  const inventoryHighRisk = inventoryIsHighRisk(input.snapshot);

  return {
    revenueWoW,
    revenue30dChange,
    revenue30d,
    profit,
    spend7d,
    revenue7d,
    breakEvenRoas,
    currentRoas,
    inventoryHighRisk,
    hasSufficientHistory: salesTrends.hasSufficientHistory,
  };
}

/** Block contradictory "revenue drop" headlines when revenue trends are positive. */
export function validateInsightTitle(
  title: string,
  metrics: ReturnType<typeof collectInsightMetrics>,
): { title: string; metricsConflict: boolean } {
  const isRevenueDropTitle = /revenue drop/i.test(title);
  const revenuePositive =
    (metrics.revenueWoW != null && metrics.revenueWoW > 0) ||
    (metrics.revenue30dChange != null && metrics.revenue30dChange > 0);

  if (isRevenueDropTitle && revenuePositive) {
    return { title: generatePrimaryStoreInsight({ metrics, opportunities: [] }).title, metricsConflict: true };
  }
  return { title, metricsConflict: false };
}

type GenerateInput = {
  metrics: ReturnType<typeof collectInsightMetrics>;
  opportunities?: CommerceOpportunity[];
  snapshot?: StoreSnapshot;
};

function buildEvidence(metrics: ReturnType<typeof collectInsightMetrics>): SupportingMetric[] {
  const evidence: SupportingMetric[] = [];

  if (metrics.revenueWoW != null) {
    evidence.push({
      label: "Revenue WoW",
      value: fmtPct(metrics.revenueWoW),
      trend: metrics.revenueWoW >= 0 ? "up" : "down",
    });
  }
  if (metrics.revenue30dChange != null) {
    evidence.push({
      label: "Revenue (30d)",
      value: fmtPct(metrics.revenue30dChange),
      trend: metrics.revenue30dChange >= 0 ? "up" : "down",
    });
  }
  if (metrics.breakEvenRoas != null) {
    evidence.push({ label: "Break-even ROAS", value: metrics.breakEvenRoas.toFixed(2) });
  }
  if (metrics.currentRoas != null) {
    evidence.push({
      label: "Current ROAS",
      value: metrics.currentRoas.toFixed(2),
      trend:
        metrics.breakEvenRoas != null && metrics.currentRoas < metrics.breakEvenRoas ? "down" : "up",
    });
  }
  if (metrics.spend7d > 0) {
    evidence.push({ label: "7-day Spend", value: fmtMoney(metrics.spend7d) });
  }
  if (metrics.revenue7d > 0) {
    evidence.push({ label: "7-day Revenue", value: fmtMoney(metrics.revenue7d) });
  }
  if (metrics.profit != null) {
    evidence.push({
      label: "Net profit (30d)",
      value: fmtMoney(metrics.profit),
      trend: metrics.profit >= 0 ? "up" : "down",
    });
  }

  return evidence;
}

function baseConfidence(metrics: ReturnType<typeof collectInsightMetrics>): number {
  let confidence = metrics.hasSufficientHistory ? 88 : 62;
  if (metrics.breakEvenRoas == null || metrics.currentRoas == null) confidence -= 12;
  if (metrics.revenueWoW != null && metrics.revenue30dChange != null) {
    const wowUp = metrics.revenueWoW > 0;
    const m30Up = metrics.revenue30dChange > 0;
    if (wowUp !== m30Up) confidence -= 15;
  }
  return Math.max(45, Math.min(95, confidence));
}

/** Generate headline, summary, and evidence from validated KPIs. */
export function generatePrimaryStoreInsight(input: GenerateInput): ValidatedStoreInsight {
  const { metrics } = input;
  const opportunities = input.opportunities ?? [];
  const snapshot = input.snapshot;
  const evidence = buildEvidence(metrics);
  const metricsConflict =
    metrics.revenueWoW != null &&
    metrics.revenue30dChange != null &&
    metrics.revenueWoW > 0 &&
    metrics.revenue30dChange > 0 &&
    metrics.profit != null &&
    metrics.profit < 0;

  let confidencePct = baseConfidence(metrics);
  if (metricsConflict) confidencePct -= 10;

  const revenuePositive = metrics.revenue30d > 0;
  const roasBelowBreakEven =
    metrics.breakEvenRoas != null &&
    metrics.currentRoas != null &&
    metrics.currentRoas < metrics.breakEvenRoas;

  const revenueGrowing =
    (metrics.revenueWoW != null && metrics.revenueWoW > 0) ||
    (metrics.revenue30dChange != null && metrics.revenue30dChange > 0);

  // Decision rules (ordered)
  if (metrics.revenueWoW != null && metrics.revenueWoW < -5) {
    return {
      title: "Why did revenue drop?",
      summary: `Revenue fell ${Math.abs(metrics.revenueWoW).toFixed(1)}% week over week${metrics.revenue30dChange != null ? ` and ${metrics.revenue30dChange < 0 ? `${Math.abs(metrics.revenue30dChange).toFixed(1)}%` : "is still"} over the last 30 days` : ""}. Review traffic, conversion, and inventory availability to find the primary driver.`,
      evidence,
      confidencePct,
      bottleneck: "revenue",
      metricsConflict: false,
      recommendation:
        opportunities[0]?.recommendation ??
        "Compare channel and campaign performance for the decline window, then address the weakest step in the funnel before cutting profitable spend.",
    };
  }

  if (revenuePositive && roasBelowBreakEven && revenueGrowing) {
    return {
      title: "Advertising efficiency declined",
      summary:
        "Revenue continues to grow, but advertising efficiency has fallen below the break-even threshold. Additional ad spend is currently destroying profit instead of creating it.",
      evidence,
      confidencePct,
      bottleneck: "roas",
      metricsConflict,
      recommendation: snapshot
        ? advertisingRecommendation(snapshot, opportunities)
        : opportunities[0]?.recommendation ??
          "Trim spend on the lowest-performing ad sets and creatives before pausing full campaigns. Shift budget to audiences and placements that consistently exceed break-even ROAS.",
    };
  }

  if (revenuePositive && metrics.profit != null && metrics.profit < 0) {
    if (roasBelowBreakEven) {
      confidencePct = Math.max(confidencePct, 84);
    }
    return {
      title: "Why isn't revenue translating into profit?",
      summary:
        "Sales are still flowing, but costs — especially paid acquisition — are consuming margin faster than revenue is growing.",
      evidence,
      confidencePct,
      bottleneck: "profit",
      metricsConflict,
      recommendation:
        opportunities.find((o) => o.category === "roas" || o.category === "spend_efficiency")
          ?.recommendation ??
        "Audit ad spend against contribution margin and trim campaigns below break-even ROAS before scaling winners.",
    };
  }

  if (revenuePositive && roasBelowBreakEven) {
    return {
      title: "Advertising efficiency declined",
      summary:
        "Advertising efficiency has fallen below the break-even threshold — paid acquisition is not returning enough revenue to cover costs.",
      evidence,
      confidencePct,
      bottleneck: "roas",
      metricsConflict,
      recommendation: snapshot
        ? advertisingRecommendation(snapshot, opportunities)
        : opportunities[0]?.recommendation ??
          "Trim spend on the lowest-performing ad sets and creatives before pausing full campaigns. Shift budget to audiences and placements that consistently exceed break-even ROAS.",
    };
  }

  if (revenuePositive && metrics.inventoryHighRisk) {
    const ctx = snapshot ? analyzeInventoryContext(snapshot) : null;
    return {
      title: "Inventory is limiting growth",
      summary: ctx
        ? `${Math.round(ctx.oosPct)}% of tracked SKUs are out of stock or critically low — paid traffic may not convert while hero products are unavailable.`
        : "Stock pressure is capping conversion from existing demand and paid traffic.",
      evidence,
      confidencePct,
      bottleneck: "inventory",
      metricsConflict,
      recommendation:
        opportunities.find((o) => o.category === "inventory")?.recommendation ??
        "Restock top sellers before increasing ad spend, and pause prospecting on out-of-stock SKUs.",
    };
  }

  if (revenuePositive && metrics.profit != null && metrics.profit > 0) {
    return {
      title: "Revenue growth is healthy",
      summary: `Revenue is up ${fmtPct(metrics.revenueWoW)} week over week with positive net profit. Continue scaling what is working while monitoring efficiency.`,
      evidence,
      confidencePct,
      bottleneck: "revenue",
      metricsConflict: false,
      recommendation:
        opportunities[0]?.recommendation ??
        "Double down on campaigns and products above break-even ROAS while testing incremental budget increases.",
    };
  }

  return {
    title: "Store performance overview",
    summary:
      metrics.hasSufficientHistory
        ? "Here is a snapshot of revenue, profitability, and advertising efficiency based on your synced store data."
        : "Connect Shopify and your ad platforms, then sync more history for higher-confidence insights.",
    evidence,
    confidencePct: Math.min(confidencePct, 72),
    bottleneck: "overview",
    metricsConflict: false,
    recommendation:
      opportunities[0]?.recommendation ??
      "Review prioritized opportunities in the dashboard and approve the highest-confidence action first.",
  };
}

export function buildValidatedStoreInsight(input: InsightMetricInput): ValidatedStoreInsight {
  const metrics = collectInsightMetrics(input);
  return generatePrimaryStoreInsight({
    metrics,
    opportunities: input.opportunities,
    snapshot: input.snapshot,
  });
}

/** Apply dynamic title/summary when a static or user-provided headline conflicts with KPIs. */
export function reconcileInsightWithMetrics(
  requestedTitle: string | undefined,
  input: InsightMetricInput,
): ValidatedStoreInsight {
  const primary = buildValidatedStoreInsight(input);
  if (!requestedTitle) return primary;

  const validated = validateInsightTitle(requestedTitle, collectInsightMetrics(input));
  if (validated.metricsConflict || /revenue drop/i.test(requestedTitle)) {
    return { ...primary, metricsConflict: validated.metricsConflict || primary.metricsConflict };
  }

  return { ...primary, title: requestedTitle };
}

function isRevenueDropQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return (
    (q.includes("revenue") || q.includes("sales")) &&
    (q.includes("drop") || q.includes("decrease") || q.includes("down") || q.includes("why"))
  );
}

/** Attach validated title and reconcile sales-decrease responses with live KPIs. */
export function attachInsightMetadata(
  structured: CopilotStructuredResponse,
  bundle: CopilotDataBundle,
  userQuestion?: string,
): CopilotStructuredResponse {
  if (structured.intent === "what_changed_week") {
    return structured;
  }

  if (structured.intent === "customer_top" || structured.intent === "customer_intelligence") {
    return structured;
  }

  const insight = reconcileInsightWithMetrics(
    userQuestion && isRevenueDropQuestion(userQuestion) ? userQuestion : undefined,
    {
      snapshot: bundle.snapshot,
      profitDashboard: bundle.context.profitDashboard,
      trends: bundle.storeManager.trends,
      opportunities: bundle.storeManager.opportunityFeed,
    },
  );

  const useDynamicNarrative =
    structured.intent === "sales_decrease" ||
    (userQuestion != null && isRevenueDropQuestion(userQuestion));

  const recommendations =
    useDynamicNarrative && insight.recommendation
      ? [
          {
            action: insight.title,
            detail: insight.recommendation,
            available: false,
          },
          ...structured.recommendations,
        ].slice(0, 3)
      : structured.recommendations;

  return {
    ...structured,
    title: useDynamicNarrative ? insight.title : structured.title ?? insight.title,
    summary: useDynamicNarrative ? insight.summary : structured.summary,
    evidence: structured.evidence.length > 0 ? structured.evidence : insight.evidence,
    confidencePct: insight.metricsConflict
      ? Math.min(structured.confidencePct, insight.confidencePct)
      : Math.max(structured.confidencePct, insight.confidencePct),
    recommendations,
    bottleneck: insight.bottleneck,
    metricsConflict: insight.metricsConflict,
  };
}
