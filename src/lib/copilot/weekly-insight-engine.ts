import { analyzeInventoryContext } from "@/lib/attribution/inventory-context";
import { resolveBreakEvenModel } from "@/lib/attribution/decision-engine";
import type { StoreSnapshot } from "@/lib/connectors/types";
import { estimateBreakEvenRoas } from "@/lib/profit/profit-recommendations";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { SupportingMetric } from "@/lib/types";
import type { TrendAnalysis } from "@/lib/insights/types";
import type { CommerceOpportunity } from "@/lib/insights/opportunity-schema";
import type { InsightBottleneck } from "./insight-engine";

export type WeeklyChangeInsight = {
  title: string;
  summary: string;
  whyItHappened: string;
  evidence: SupportingMetric[];
  confidencePct: number;
  bottleneck: InsightBottleneck;
  riskLevel: "High" | "Medium" | "Low";
  recommendation: string;
};

export type WeeklyInsightInput = {
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  trends?: TrendAnalysis | null;
  opportunities?: CommerceOpportunity[];
};

const FLAT_THRESHOLD = 2;

function fmtPct(pct: number | null | undefined): string {
  if (pct == null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function trendPct(trends: TrendAnalysis | null | undefined, id: string): number | null {
  return trends?.metrics.find((m) => m.id === id)?.changePct ?? null;
}

function isUp(pct: number | null): boolean {
  return pct != null && pct > FLAT_THRESHOLD;
}

function isDown(pct: number | null): boolean {
  return pct != null && pct < -FLAT_THRESHOLD;
}

function isFlat(pct: number | null): boolean {
  return pct == null || Math.abs(pct) <= FLAT_THRESHOLD;
}

function resolveBreakEvenRoas(
  snapshot: StoreSnapshot,
  profitDashboard?: ProfitDashboard | null,
): number | null {
  if (profitDashboard) {
    const fromAttribution = resolveBreakEvenModel(profitDashboard, null).breakEvenRoas;
    if (fromAttribution > 0) return fromAttribution;
    const estimated = estimateBreakEvenRoas(profitDashboard);
    if (estimated != null && estimated > 0) return estimated;
  }
  return null;
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

function weeklyAdRecommendation(snapshot: StoreSnapshot, opportunities: CommerceOpportunity[]): string {
  const adOpp = opportunities.find(
    (o) =>
      o.category === "roas" ||
      o.category === "spend_efficiency" ||
      o.category === "campaign_performance",
  );
  if (adOpp?.recommendation) return adOpp.recommendation;

  const { prospecting, retargeting } = campaignGroupNames(snapshot);
  const groups = [prospecting, retargeting].filter(Boolean);
  const groupLabel =
    groups.length >= 2
      ? `weakest ${groups[0]} and ${groups[1]} ad sets`
      : groups.length === 1
        ? `weakest ${groups[0]} ad sets`
        : "weakest Prospecting and Retargeting ad sets";

  return `Pause only the ${groupLabel}. Shift budget toward campaigns, audiences, and creatives that consistently exceed the break-even ROAS.`;
}

function computeAovChange(snapshot: StoreSnapshot, trends: TrendAnalysis | null | undefined): number | null {
  const explicit = trendPct(trends, "aov_7d");
  if (explicit != null) return explicit;

  const daily = snapshot.dailyMetrics ?? [];
  if (daily.length < 14) return null;

  const sumWindow = (slice: typeof daily) => ({
    revenue: slice.reduce((s, d) => s + (d.revenue ?? 0), 0),
    orders: slice.reduce((s, d) => s + (d.orders ?? 0), 0),
  });

  const recent = sumWindow(daily.slice(-7));
  const prior = sumWindow(daily.slice(-14, -7));
  if (prior.orders <= 0 || recent.orders <= 0) return null;

  const aovRecent = recent.revenue / recent.orders;
  const aovPrior = prior.revenue / prior.orders;
  if (aovPrior <= 0) return null;
  return Math.round(((aovRecent - aovPrior) / aovPrior) * 1000) / 10;
}

/** Collect week-over-week metric changes for causal analysis. */
export function collectWeeklyChangeMetrics(input: WeeklyInsightInput) {
  const trends = input.trends;
  const revenueChange = trendPct(trends, "revenue_7d");
  const spendChange = trendPct(trends, "spend_7d");
  const conversionChange = trendPct(trends, "conversion_rate_7d");
  const profitChange = trendPct(trends, "profit_7d");
  const ordersChange = trendPct(trends, "orders_7d");
  const roasChange = trendPct(trends, "roas_7d");
  const aovChange = computeAovChange(input.snapshot, trends);

  const breakEvenRoas = resolveBreakEvenRoas(input.snapshot, input.profitDashboard);
  const inventoryCtx = analyzeInventoryContext(input.snapshot);
  const inventoryHighRisk =
    inventoryCtx.severity === "critical" || inventoryCtx.severity === "low";

  const profit =
    input.profitDashboard?.primary.netProfit ??
    (profitChange != null && revenueChange != null ? null : null);

  return {
    revenueChange,
    spendChange,
    conversionChange,
    profitChange,
    ordersChange,
    roasChange,
    aovChange,
    breakEvenRoas,
    inventoryHighRisk,
    inventoryOosPct: inventoryCtx.oosPct,
    profit,
    hasTrendData: trends != null && trends.metrics.length > 0,
  };
}

function deriveRiskLevel(metrics: ReturnType<typeof collectWeeklyChangeMetrics>): WeeklyChangeInsight["riskLevel"] {
  if (
    metrics.spendChange != null &&
    metrics.revenueChange != null &&
    metrics.spendChange > metrics.revenueChange + 3 &&
    isDown(metrics.conversionChange)
  ) {
    return "High";
  }
  if (isDown(metrics.revenueChange) && isUp(metrics.spendChange)) return "High";
  if (isDown(metrics.roasChange) || isDown(metrics.profitChange)) return "Medium";
  return "Low";
}

function buildWeeklyEvidence(
  metrics: ReturnType<typeof collectWeeklyChangeMetrics>,
): SupportingMetric[] {
  const evidence: SupportingMetric[] = [];

  if (metrics.revenueChange != null) {
    evidence.push({
      label: "Revenue",
      value: fmtPct(metrics.revenueChange),
      trend: metrics.revenueChange >= 0 ? "up" : "down",
    });
  }
  if (metrics.spendChange != null) {
    evidence.push({
      label: "Ad Spend",
      value: fmtPct(metrics.spendChange),
      trend: metrics.spendChange >= 0 ? "up" : "down",
    });
  }
  if (metrics.conversionChange != null) {
    evidence.push({
      label: "Conversion Rate",
      value: fmtPct(metrics.conversionChange),
      trend: metrics.conversionChange >= 0 ? "up" : "down",
    });
  }
  if (metrics.breakEvenRoas != null) {
    evidence.push({ label: "Break-even ROAS", value: metrics.breakEvenRoas.toFixed(2) });
  }
  if (metrics.roasChange != null) {
    evidence.push({
      label: "Blended ROAS",
      value: fmtPct(metrics.roasChange),
      trend: metrics.roasChange >= 0 ? "up" : "down",
    });
  }
  if (metrics.ordersChange != null) {
    evidence.push({
      label: "Orders",
      value: fmtPct(metrics.ordersChange),
      trend: metrics.ordersChange >= 0 ? "up" : "down",
    });
  }
  if (metrics.aovChange != null) {
    evidence.push({
      label: "AOV",
      value: fmtPct(metrics.aovChange),
      trend: metrics.aovChange >= 0 ? "up" : "down",
    });
  }

  const risk = deriveRiskLevel(metrics);
  evidence.push({ label: "Risk", value: risk });

  return evidence;
}

function baseWeeklyConfidence(metrics: ReturnType<typeof collectWeeklyChangeMetrics>): number {
  let confidence = metrics.hasTrendData ? 86 : 58;
  const signals = [
    metrics.revenueChange,
    metrics.spendChange,
    metrics.conversionChange,
  ].filter((v) => v != null);
  if (signals.length < 2) confidence -= 18;
  if (
    metrics.revenueChange != null &&
    metrics.spendChange != null &&
    isUp(metrics.revenueChange) &&
    isUp(metrics.spendChange) &&
    metrics.spendChange > metrics.revenueChange
  ) {
    confidence += 4;
  }
  return Math.max(48, Math.min(94, confidence));
}

function conversionRecoveryLine(): string {
  return "Investigate landing pages, product pages, and checkout friction to recover the declining conversion rate.";
}

/** Generate a multi-metric weekly change insight with causal reasoning. */
export function generateWeeklyChangeInsight(input: WeeklyInsightInput): WeeklyChangeInsight {
  const metrics = collectWeeklyChangeMetrics(input);
  const opportunities = input.opportunities ?? [];
  const snapshot = input.snapshot;
  const evidence = buildWeeklyEvidence(metrics);
  const confidencePct = baseWeeklyConfidence(metrics);
  const riskLevel = deriveRiskLevel(metrics);

  const rev = metrics.revenueChange;
  const spend = metrics.spendChange;
  const conv = metrics.conversionChange;
  const profitChg = metrics.profitChange;
  const orders = metrics.ordersChange;
  const aov = metrics.aovChange;

  const spendOutpacedRevenue =
    spend != null && rev != null && spend > rev + FLAT_THRESHOLD && isUp(spend);
  const conversionDown = isDown(conv);

  // 1. Spend grew faster than revenue + conversion declined
  if (spendOutpacedRevenue && conversionDown) {
    const adRec = weeklyAdRecommendation(snapshot, opportunities);
    return {
      title: "Advertising spend outpaced revenue growth",
      summary: `Revenue increased by ${fmtPct(rev)}, but advertising spend grew even faster at ${fmtPct(spend)} while conversion rate declined by ${Math.abs(conv!).toFixed(1)}%. This suggests that additional marketing investment generated lower incremental returns and reduced advertising efficiency.`,
      whyItHappened:
        "Traffic acquisition increased through higher ad spend, but fewer visitors converted into customers. The additional budget is producing diminishing returns, pushing ROAS closer to or below the break-even threshold.",
      evidence,
      confidencePct,
      bottleneck: "roas",
      riskLevel,
      recommendation: `${adRec} ${conversionRecoveryLine()}`,
    };
  }

  // 2. Revenue down + spend up
  if (isDown(rev) && isUp(spend)) {
    return {
      title: "Marketing efficiency deteriorated",
      summary: `Revenue declined ${fmtPct(rev)} while ad spend increased ${fmtPct(spend)}. Paid acquisition is consuming budget without producing proportional sales.`,
      whyItHappened:
        "Higher media spend failed to offset weaker demand or conversion. Campaigns may be reaching less qualified audiences, or on-site conversion is not keeping pace with traffic costs.",
      evidence,
      confidencePct,
      bottleneck: "roas",
      riskLevel: "High",
      recommendation: `${weeklyAdRecommendation(snapshot, opportunities)} Review audience targeting and pause spend on campaigns below break-even ROAS immediately.`,
    };
  }

  // 3. Revenue up + inventory risk
  if (isUp(rev) && metrics.inventoryHighRisk) {
    return {
      title: "Demand increased but inventory is becoming a constraint",
      summary: `Revenue grew ${fmtPct(rev)} this week, but ${Math.round(metrics.inventoryOosPct)}% of tracked SKUs are out of stock or critically low — growth may stall if hero products remain unavailable.`,
      whyItHappened:
        "Stronger demand or marketing is pulling more traffic, but stockouts and low inventory are likely suppressing conversion on best sellers.",
      evidence,
      confidencePct,
      bottleneck: "inventory",
      riskLevel: "Medium",
      recommendation:
        opportunities.find((o) => o.category === "inventory")?.recommendation ??
        "Prioritize restocking top revenue SKUs before scaling ad spend further.",
    };
  }

  // 4. Revenue flat + conversion down
  if (isFlat(rev) && conversionDown) {
    return {
      title: "Store conversion is weakening",
      summary: `Conversion rate declined ${fmtPct(Math.abs(conv!))} while revenue held relatively flat. The store is attracting traffic but converting fewer visitors into buyers.`,
      whyItHappened:
        "Fewer sessions are completing purchases — pricing, page experience, shipping costs, or product availability may be creating friction in the funnel.",
      evidence,
      confidencePct,
      bottleneck: "conversion",
      riskLevel: "Medium",
      recommendation: `${conversionRecoveryLine()} Test urgency offers on cart abandoners and review mobile checkout performance.`,
    };
  }

  // 5. Healthy growth: revenue > spend growth and profit up
  const profitGrowing = profitChg != null ? isUp(profitChg) : metrics.profit != null && metrics.profit > 0;
  if (
    rev != null &&
    spend != null &&
    rev > spend + FLAT_THRESHOLD &&
    profitGrowing
  ) {
    return {
      title: "Healthy growth",
      summary: `Revenue increased ${fmtPct(rev)} while ad spend rose only ${fmtPct(spend)} — efficiency improved or held steady, and profit trends are positive.`,
      whyItHappened:
        "Growth is coming from productive traffic and/or improving unit economics rather than brute-force spend increases.",
      evidence,
      confidencePct,
      bottleneck: "revenue",
      riskLevel: "Low",
      recommendation:
        opportunities[0]?.recommendation ??
        "Scale campaigns and products above break-even ROAS while monitoring conversion weekly.",
    };
  }

  // 6. Revenue up + AOV up (orders not the primary driver)
  if (isUp(rev) && isUp(aov) && !isUp(orders)) {
    return {
      title: "Larger customer orders drove growth",
      summary: `Revenue rose ${fmtPct(rev)} with average order value up ${fmtPct(aov)}. Customers are spending more per transaction this week.`,
      whyItHappened:
        "Higher basket sizes — bundles, upsells, or mix shift toward premium SKUs — are lifting revenue without requiring proportionally more orders.",
      evidence,
      confidencePct,
      bottleneck: "revenue",
      riskLevel: "Low",
      recommendation:
        "Merchandise high-AOV bundles on the homepage and retarget recent buyers with complementary add-ons.",
    };
  }

  // 7. Revenue up + orders up
  if (isUp(rev) && isUp(orders)) {
    return {
      title: "More customers drove growth",
      summary: `Revenue increased ${fmtPct(rev)} alongside ${fmtPct(orders)} more orders. Volume growth is the primary driver this week.`,
      whyItHappened:
        "Traffic and conversion combined to produce more transactions — acquisition or retention campaigns may be bringing in additional buyers.",
      evidence,
      confidencePct,
      bottleneck: "revenue",
      riskLevel: spendOutpacedRevenue ? "Medium" : "Low",
      recommendation:
        opportunities[0]?.recommendation ??
        "Protect cohort quality by monitoring new vs returning customer mix and CAC payback.",
    };
  }

  // Spend outpaced revenue without conversion data
  if (spendOutpacedRevenue) {
    return {
      title: "Advertising spend outpaced revenue growth",
      summary: `Revenue increased ${fmtPct(rev)}, but ad spend rose faster at ${fmtPct(spend)}. Marginal returns on additional budget are likely declining.`,
      whyItHappened:
        "More budget is buying traffic and sales, but each incremental dollar of spend is producing less revenue than before — a sign of diminishing advertising efficiency.",
      evidence,
      confidencePct,
      bottleneck: "roas",
      riskLevel,
      recommendation: weeklyAdRecommendation(snapshot, opportunities),
    };
  }

  // Revenue decline
  if (isDown(rev)) {
    return {
      title: "Revenue declined this week",
      summary: `Revenue decreased ${fmtPct(rev)} week over week${spend != null ? ` while ad spend changed ${fmtPct(spend)}` : ""}${conv != null && conversionDown ? ` and conversion fell ${fmtPct(Math.abs(conv))}` : ""}.`,
      whyItHappened:
        "Weaker demand, conversion, or traffic quality likely combined to pull revenue down — compare channel and campaign performance before making budget cuts.",
      evidence,
      confidencePct,
      bottleneck: "revenue",
      riskLevel: "Medium",
      recommendation:
        opportunities[0]?.recommendation ??
        "Diagnose whether the drop is traffic-, conversion-, or inventory-driven before reducing spend.",
    };
  }

  // Fallback: synthesize from available metrics (never single-metric)
  const parts: string[] = [];
  if (rev != null) parts.push(`revenue ${isUp(rev) ? "rose" : isDown(rev) ? "fell" : "held steady"} (${fmtPct(rev)})`);
  if (spend != null) parts.push(`ad spend ${isUp(spend) ? "increased" : isDown(spend) ? "decreased" : "was flat"} (${fmtPct(spend)})`);
  if (conv != null) parts.push(`conversion ${isUp(conv) ? "improved" : isDown(conv) ? "declined" : "was stable"} (${fmtPct(conv)})`);

  return {
    title: "Weekly performance shifted across multiple metrics",
    summary:
      parts.length > 0
        ? `This week, ${parts.join("; ")}. No single metric dominates — review the combined effect on profitability.`
        : "Connect more historical data to compare this week against the prior period with higher confidence.",
    whyItHappened:
      input.trends?.interpretation ??
      "Trend relationships are inconclusive with the current data window — sync Shopify and ad platforms for a fuller weekly comparison.",
    evidence,
    confidencePct: Math.min(confidencePct, 70),
    bottleneck: "overview",
    riskLevel: "Medium",
    recommendation:
      opportunities[0]?.recommendation ??
      "Open the executive dashboard to review prioritized opportunities for this week's biggest lever.",
  };
}

export function buildWeeklyChangeInsight(input: WeeklyInsightInput): WeeklyChangeInsight {
  return generateWeeklyChangeInsight(input);
}
