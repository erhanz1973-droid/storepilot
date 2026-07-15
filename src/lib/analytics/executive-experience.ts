import type { ChartDefinition, MetricCard } from "@/lib/analytics/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import {
  buildBusinessScaleContext,
  constrainRecoveryEstimate,
  constrainRecoveryTotal,
} from "@/lib/analytics/recovery-business-constraints";
import type { ExecutiveSummary } from "@/lib/insights/executive-summary";
import type { TrendAnalysis } from "@/lib/insights/types";
import type { MorningExecutiveBrief } from "@/lib/brief/morning-brief";
import type { DecisionItem } from "@/lib/decisions/center";
import type { CommerceOpportunity } from "@/lib/insights/opportunity-schema";
import type { PriorityQueueItem } from "@/lib/insights/types";
import type { PredictiveInsight } from "@/lib/predictions/engine";
import type { StoreHealthScore } from "@/lib/store-health/score";
import { calculateDecisionImpact } from "@/lib/impact/decision-impact";
import {
  candidatesFromOpenDecisions,
  selectTodaysExecutiveDecision,
} from "@/lib/analytics/executive-decision-ranking";
import { buildExecutiveAnalytics, type ExecutiveAnalytics } from "./executive";

export type ExecutiveBriefing = {
  greeting: string;
  paragraphs: string[];
  opportunityCount: number;
  opportunityValueMonthly: number;
  syncStatus: ExecutiveSummary["lastSyncStatus"];
  lastSyncAt: string;
};

export type BusinessForecast = {
  projectedMonthlyProfit: number;
  recoveryMonthly: number;
  confidencePct: number;
  trendLabel: string;
};

export type FeaturedRecommendation = {
  title: string;
  description: string;
  impactLabel: string;
  /** Business-scale recovery (Executive hero) */
  impactMonthly: number;
  /** Net profit improvement (secondary KPI) */
  netProfitMonthly: number;
  confidencePct: number;
  suggestedAction: string;
  decisionId?: string;
  recommendationId?: string;
  opportunityKey?: string;
  entityName?: string;
  futureAction?: string;
  primaryActionLabel: string;
  secondaryActionLabels: string[];
};

export type ExecutiveOpportunity = {
  id: string;
  title: string;
  impactLabel: string;
  /** Business-scale recovery for ranking / Executive hero */
  impactMonthly: number;
  netProfitMonthly: number;
  confidencePct: number;
  decisionId?: string;
  recommendationId?: string;
  opportunityKey?: string;
};

export type ExecutiveExperience = ExecutiveAnalytics & {
  briefing: ExecutiveBriefing;
  forecast: BusinessForecast;
  businessKpis: MetricCard[];
  storeKpis: MetricCard[];
  primaryCharts: ChartDefinition[];
  secondaryCharts: ChartDefinition[];
  featuredRecommendation: FeaturedRecommendation | null;
  opportunities: ExecutiveOpportunity[];
  storeHealth: StoreHealthScore | null;
};

function fmtCurrency(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function greetingForHour(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function decisionCategoryHint(d: Pick<DecisionItem, "entityType">): string | undefined {
  return d.entityType === "campaign" ? "campaign_review" : undefined;
}

function impactFromLabel(
  label: string,
  opts?: { category?: string; confidencePct?: number },
) {
  return calculateDecisionImpact({
    expectedImpactLabel: label,
    category: opts?.category,
    confidenceScore: opts?.confidencePct,
  });
}

function avgMetaRoas(snapshot: StoreSnapshot): number | null {
  const active = snapshot.campaigns.filter((c) => c.spend7d > 0);
  if (active.length === 0) return null;
  const totalSpend = active.reduce((s, c) => s + c.spend7d, 0);
  const totalRev = active.reduce((s, c) => s + c.revenue7d, 0);
  return totalSpend > 0 ? totalRev / totalSpend : null;
}

function avgGoogleRoas(snapshot: StoreSnapshot): number | null {
  const camps = snapshot.googleAdsSnapshot?.campaigns ?? [];
  if (camps.length === 0) return null;
  const spend = camps.reduce((s, c) => s + c.spend7d, 0);
  const rev = camps.reduce((s, c) => s + c.revenue7d, 0);
  return spend > 0 ? rev / spend : null;
}

function buildBriefing(input: {
  summary: ExecutiveSummary | null;
  trends: TrendAnalysis | null;
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  opportunities: ExecutiveOpportunity[];
}): ExecutiveBriefing {
  const { summary, trends, snapshot, profitDashboard, opportunities } = input;
  const profitChange = trends?.metrics.find((m) => m.id === "profit_7d")?.changePct ?? summary?.profitChangePct;
  const metaRoas = avgMetaRoas(snapshot);
  const googleRoas = avgGoogleRoas(snapshot);
  const paragraphs: string[] = [];

  if (profitChange != null) {
    const dir = profitChange >= 0 ? "increased" : "decreased";
    paragraphs.push(
      `Yesterday your profit ${dir} by ${Math.abs(profitChange).toFixed(0)}%.`,
    );
  } else if (profitDashboard?.primaryProfit.status !== "unavailable" && profitDashboard?.primary.netProfit != null) {
    const label =
      profitDashboard.primaryProfit.status === "estimated"
        ? "Estimated 30-day profit"
        : "30-day profit";
    const disclaimer =
      profitDashboard.primaryProfit.status === "estimated" &&
      profitDashboard.confidence.missingInputs.length > 0
        ? ` ${profitDashboard.confidence.notice ?? "This value may change after completing cost setup."}`
        : "";
    paragraphs.push(
      `${label} is ${fmtCurrency(profitDashboard.primary.netProfit)}.${disclaimer}`,
    );
  } else if (profitDashboard?.primaryProfit.status === "unavailable") {
    paragraphs.push(
      "Profit is not available yet — complete Profit Setup to unlock profitability insights.",
    );
  }

  if (metaRoas != null) {
    paragraphs.push(`Meta Ads generated a ROAS of ${metaRoas.toFixed(2)}.`);
  }

  if (metaRoas != null && googleRoas != null && metaRoas > 0) {
    const beat = ((googleRoas - metaRoas) / metaRoas) * 100;
    if (Math.abs(beat) >= 5) {
      const winner = beat > 0 ? "Google Ads outperformed Meta" : "Meta outperformed Google Ads";
      paragraphs.push(`${winner} by ${Math.abs(beat).toFixed(0)}%.`);
    }
  }

  const oppValue = opportunities.reduce((s, o) => s + o.impactMonthly, 0);
  const oppCount = opportunities.length;
  if (oppCount > 0) {
    paragraphs.push(
      `I identified ${oppCount} opportunit${oppCount === 1 ? "y" : "ies"} worth an estimated ${fmtCurrency(oppValue)}/month.`,
    );
  }

  if (paragraphs.length === 0) {
    paragraphs.push(
      summary?.headline ?? "Your store is synced — review opportunities below to grow profit.",
    );
  }

  return {
    greeting: greetingForHour(),
    paragraphs,
    opportunityCount: oppCount,
    opportunityValueMonthly: oppValue,
    syncStatus: summary?.lastSyncStatus ?? "healthy",
    lastSyncAt: summary?.lastSyncAt ?? snapshot.syncedAt,
  };
}

function buildForecast(input: {
  profitDashboard?: ProfitDashboard | null;
  opportunities: ExecutiveOpportunity[];
  predictiveInsights?: PredictiveInsight[];
  snapshot: StoreSnapshot;
}): BusinessForecast {
  const projected =
    input.profitDashboard?.primaryProfit.status !== "unavailable" &&
    input.profitDashboard?.primary.netProfit != null
      ? input.profitDashboard.primary.netProfit
      : 0;

  const businessContext = buildBusinessScaleContext(
    input.profitDashboard ?? null,
    input.snapshot,
  );
  const grossRecovery = input.opportunities.reduce((s, o) => s + o.impactMonthly, 0);
  const avgConfidence =
    input.opportunities.length > 0
      ? Math.round(
          input.opportunities.reduce((s, o) => s + o.confidencePct, 0) /
            input.opportunities.length,
        )
      : 72;
  const constrained = constrainRecoveryTotal(
    Math.round(grossRecovery * 0.65),
    avgConfidence,
    businessContext,
  );
  const recovery = constrained.amount;

  const revenueForecast = input.predictiveInsights?.find((p) => p.type === "profit_forecast");
  const confidence = constrained.confidencePct;

  return {
    projectedMonthlyProfit: projected,
    recoveryMonthly: recovery,
    confidencePct: Math.min(95, Math.max(35, confidence)),
    trendLabel:
      projected < 0
        ? "If performance continues unchanged"
        : "At current run rate",
  };
}

function fromDecision(d: DecisionItem): ExecutiveOpportunity {
  const impact = impactFromLabel(d.estimatedImpactLabel, {
    category: decisionCategoryHint(d),
    confidencePct: d.confidencePct,
  });
  return {
    id: d.id,
    title: d.summary,
    impactLabel: d.estimatedImpactLabel,
    impactMonthly: impact.businessRecovery,
    netProfitMonthly: impact.netProfitImpact,
    confidencePct: d.confidencePct,
    decisionId: d.id,
    recommendationId: d.recommendationId,
    opportunityKey: d.opportunityKey,
  };
}

function fromCommerceOpportunity(o: CommerceOpportunity): ExecutiveOpportunity {
  const net = o.expectedImpact.profitMonthly || 0;
  const recovery = o.expectedImpact.revenueMonthly || net;
  return {
    id: o.id,
    title: o.title,
    impactLabel: o.expectedImpact.label,
    impactMonthly: Math.max(recovery, net),
    netProfitMonthly: net || recovery,
    confidencePct: o.confidence,
    opportunityKey: o.groupKey ?? o.id,
  };
}

function fromPriorityItem(p: PriorityQueueItem): ExecutiveOpportunity {
  const impact = impactFromLabel(p.expectedImpactLabel ?? "", {
    category: p.source === "recommendation" ? "campaign_review" : undefined,
    confidencePct: p.confidence,
  });
  return {
    id: p.id,
    title: p.title,
    impactLabel: p.expectedImpactLabel ?? "See impact estimate",
    impactMonthly: impact.businessRecovery,
    netProfitMonthly: impact.netProfitImpact,
    confidencePct: p.confidence,
    opportunityKey: p.opportunityId,
    recommendationId: p.recommendationId,
  };
}

function constrainOpportunity(
  opp: ExecutiveOpportunity,
  ctx: ReturnType<typeof buildBusinessScaleContext>,
): ExecutiveOpportunity {
  // Keep recommendation-backed impacts canonical — Approvals uses the same model
  // without scale re-capping, so never recompute dollars for shared Decision objects.
  if (opp.recommendationId || opp.decisionId) {
    return opp;
  }
  const constrained = constrainRecoveryEstimate(
    opp.impactMonthly,
    opp.confidencePct,
    ctx,
  );
  return {
    ...opp,
    impactMonthly: constrained.amount,
    confidencePct: constrained.confidencePct,
    impactLabel:
      constrained.amount > 0
        ? `+${fmtCurrency(constrained.amount)}/month`
        : opp.impactLabel,
  };
}

function synthesizeOpportunities(snapshot: StoreSnapshot, need: number): ExecutiveOpportunity[] {
  const ctx = buildBusinessScaleContext(null, snapshot);
  const out: ExecutiveOpportunity[] = [];
  const worstCamp = [...snapshot.campaigns]
    .filter((c) => c.spend7d > 50 && c.roas7d < 1.2)
    .sort((a, b) => a.roas7d - b.roas7d)[0];
  if (worstCamp && out.length < need) {
    const savings = Math.round(worstCamp.spend7d * 4 * 0.35);
    const net = Math.round(savings * 0.55);
    out.push(
      constrainOpportunity(
        {
          id: `syn-pause-${worstCamp.id}`,
          title: `Pause low ROAS campaign — ${worstCamp.name}`,
          impactLabel: `+${fmtCurrency(savings)}/month savings`,
          impactMonthly: savings,
          netProfitMonthly: net,
          confidencePct: 88,
          opportunityKey: `camp-${worstCamp.id}`,
        },
        ctx,
      ),
    );
  }

  const bestCamp = [...snapshot.campaigns]
    .filter((c) => c.roas7d >= 2 && c.spend7d > 0)
    .sort((a, b) => b.roas7d - a.roas7d)[0];
  if (bestCamp && out.length < need) {
    const gain = Math.round(bestCamp.revenue7d * 0.15);
    out.push(
      constrainOpportunity(
        {
          id: `syn-scale-${bestCamp.id}`,
          title: `Increase budget on ${bestCamp.name}`,
          impactLabel: `+${fmtCurrency(gain)}/month`,
          impactMonthly: gain,
          netProfitMonthly: Math.round(gain * 0.38),
          confidencePct: 76,
          opportunityKey: `camp-scale-${bestCamp.id}`,
        },
        ctx,
      ),
    );
  }

  const deadProduct = snapshot.products.find((p) => p.inventoryQuantity > 5 && p.unitsSold30d < 2);
  if (deadProduct && out.length < need) {
    const recovery = Math.min(3400, ctx.monthlyProfit * 0.2 || 800);
    out.push(
      constrainOpportunity(
        {
          id: `syn-inv-${deadProduct.id}`,
          title: `Clear slow-moving inventory — ${deadProduct.title}`,
          impactLabel: `+${fmtCurrency(recovery)}/month`,
          impactMonthly: recovery,
          netProfitMonthly: Math.round(recovery * 0.38),
          confidencePct: 71,
          opportunityKey: `inv-${deadProduct.id}`,
        },
        ctx,
      ),
    );
  }

  const fallbacks = [
    { title: "Review ad spend efficiency", impact: Math.min(1200, ctx.monthlyAdSpend * 0.3 || 400), confidence: 68 },
    { title: "Optimize product margins", impact: Math.min(850, (ctx.monthlyProfit || 2000) * 0.15), confidence: 65 },
    { title: "Improve checkout conversion", impact: Math.min(2100, ctx.monthlyRevenue * 0.08 || 600), confidence: 62 },
  ];
  for (const f of fallbacks) {
    if (out.length >= need) break;
    if (out.some((o) => o.title === f.title)) continue;
    out.push(
      constrainOpportunity(
        {
          id: `syn-fb-${f.title}`,
          title: f.title,
          impactLabel: `+${fmtCurrency(f.impact)}/month`,
          impactMonthly: f.impact,
          netProfitMonthly: Math.round(f.impact * 0.4),
          confidencePct: f.confidence,
        },
        ctx,
      ),
    );
  }
  return out.map((o) => constrainOpportunity(o, ctx));
}

export function buildExecutiveOpportunities(input: {
  decisions: DecisionItem[];
  opportunityFeed: CommerceOpportunity[];
  priorityQueue: PriorityQueueItem[];
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  minCount?: number;
}): ExecutiveOpportunity[] {
  const min = input.minCount ?? 3;
  const seen = new Set<string>();
  const out: ExecutiveOpportunity[] = [];
  const ctx = buildBusinessScaleContext(input.profitDashboard ?? null, input.snapshot);

  const add = (o: ExecutiveOpportunity) => {
    const key = o.title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(constrainOpportunity(o, ctx));
  };

  for (const d of input.decisions.filter((x) => x.status === "open")) {
    add(fromDecision(d));
  }
  for (const o of input.opportunityFeed) add(fromCommerceOpportunity(o));
  for (const p of input.priorityQueue) add(fromPriorityItem(p));

  if (out.length < min) {
    for (const s of synthesizeOpportunities(input.snapshot, min - out.length)) {
      add(s);
    }
  }

  return out.slice(0, Math.max(min, 6));
}

function buildFeaturedRecommendation(input: {
  opportunities: ExecutiveOpportunity[];
  decisions: DecisionItem[];
  morningBrief?: MorningExecutiveBrief | null;
  summary: ExecutiveSummary | null;
}): FeaturedRecommendation | null {
  const fromDecisions = candidatesFromOpenDecisions(input.decisions);
  const fromOpps: ReturnType<typeof candidatesFromOpenDecisions> = input.opportunities.map(
    (o) => ({
      id: o.id,
      title: o.title,
      description: o.title,
      impactLabel: o.impactLabel,
      confidencePct: o.confidencePct,
      priority: "high" as const,
      risk: "medium" as const,
      decisionId: o.decisionId,
      recommendationId: o.recommendationId,
      opportunityKey: o.opportunityKey,
      knownBusinessRecovery: o.impactMonthly,
      knownNetProfit: o.netProfitMonthly,
      suggestedAction: "Approve",
    }),
  );

  const selection = selectTodaysExecutiveDecision([...fromDecisions, ...fromOpps]);
  if (selection.kind === "none") {
    return null;
  }

  const { candidate, impact } = selection.ranked;
  const isCampaign = candidate.entityType === "campaign";
  const fromBrief = input.morningBrief?.recommendationOfTheDay;
  const fromSummary = input.summary?.topRecommendation;

  return {
    title: candidate.title,
    description: candidate.description || fromBrief?.why || candidate.title,
    impactLabel:
      candidate.impactLabel ||
      `+$${impact.businessRecovery.toLocaleString()}/mo (~$${impact.netProfitImpact.toLocaleString()}/mo profit)`,
    impactMonthly: impact.businessRecovery,
    netProfitMonthly: impact.netProfitImpact,
    confidencePct:
      impact.confidence > 0
        ? impact.confidence
        : candidate.confidencePct <= 1
          ? Math.round(candidate.confidencePct * 100)
          : candidate.confidencePct,
    suggestedAction:
      candidate.suggestedAction ??
      fromSummary?.recommendation ??
      "Review in Decisions and approve the recommended action.",
    decisionId: candidate.decisionId,
    recommendationId: candidate.recommendationId,
    opportunityKey: candidate.opportunityKey,
    entityName: candidate.entityName,
    futureAction: candidate.futureAction,
    primaryActionLabel: isCampaign ? "Pause Campaign" : "Approve",
    secondaryActionLabels: isCampaign
      ? ["Reduce Budget", "Ignore"]
      : ["Defer", "Ignore"],
  };
}

function splitKpis(metrics: MetricCard[]): {
  businessKpis: MetricCard[];
  storeKpis: MetricCard[];
} {
  const pick = (id: string) => metrics.find((m) => m.id === id);
  const businessKpis = ["profit", "revenue", "orders", "roas", "break-even-roas", "cash-flow"]
    .map((id) => pick(id))
    .filter((m): m is MetricCard => Boolean(m));
  const storeKpis = ["ad-spend", "cvr", "aov", "returning", "sessions", "engagement-rate", "avg-session-duration"]
    .map((id) => pick(id))
    .filter((m): m is MetricCard => Boolean(m));
  return { businessKpis, storeKpis };
}

export function buildExecutiveExperience(input: {
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  executiveSummary?: ExecutiveSummary | null;
  trends?: TrendAnalysis | null;
  decisions: DecisionItem[];
  opportunityFeed: CommerceOpportunity[];
  priorityQueue: PriorityQueueItem[];
  morningBrief?: MorningExecutiveBrief | null;
  predictiveInsights?: PredictiveInsight[];
  storeHealth?: StoreHealthScore | null;
  metricSourceLabels?: Record<string, string>;
}): ExecutiveExperience {
  const base = buildExecutiveAnalytics({
    snapshot: input.snapshot,
    profitDashboard: input.profitDashboard,
    executiveSummary: input.executiveSummary,
    trends: input.trends,
    metricSourceLabels: input.metricSourceLabels,
  });

  const opportunities = buildExecutiveOpportunities({
    decisions: input.decisions,
    opportunityFeed: input.opportunityFeed,
    priorityQueue: input.priorityQueue,
    snapshot: input.snapshot,
    profitDashboard: input.profitDashboard,
  });

  const spend30 =
    input.snapshot.adSpendSnapshot?.totalRollups.last30d.spend ??
    input.snapshot.googleAdsSnapshot?.rollups.last30d.spend ??
    input.profitDashboard?.primary.adSpend ??
    0;
  void spend30;

  const metricsWithSpend = base.metrics;
  const { businessKpis, storeKpis } = splitKpis(metricsWithSpend);

  const primaryCharts = base.charts.filter((c) =>
    ["revenue", "profit", "roas"].includes(c.id),
  );
  const secondaryCharts = base.charts.filter(
    (c) => !["revenue", "profit", "roas"].includes(c.id),
  );

  return {
    ...base,
    metrics: metricsWithSpend,
    businessKpis,
    storeKpis,
    primaryCharts,
    secondaryCharts,
    briefing: buildBriefing({
      summary: input.executiveSummary ?? null,
      trends: input.trends ?? null,
      snapshot: input.snapshot,
      profitDashboard: input.profitDashboard,
      opportunities,
    }),
    forecast: buildForecast({
      profitDashboard: input.profitDashboard,
      opportunities,
      predictiveInsights: input.predictiveInsights,
      snapshot: input.snapshot,
    }),
    featuredRecommendation: buildFeaturedRecommendation({
      opportunities,
      decisions: input.decisions,
      morningBrief: input.morningBrief,
      summary: input.executiveSummary ?? null,
    }),
    opportunities,
    storeHealth: input.storeHealth ?? null,
  };
}

// Re-export chart builder for tests
export { buildChartsFromDaily } from "./executive";
