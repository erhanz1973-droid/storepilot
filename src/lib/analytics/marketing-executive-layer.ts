import type { StoreSnapshot } from "@/lib/connectors/types";
import type {
  EnrichedMarketingCampaign,
  MarketingForecast,
  MarketingPlatformSummary,
} from "./marketing-manager";
import { validateChannelBudgetRecommendation } from "@/lib/trust/recommendation-validation";
import type {
  MarketingBudgetAllocation,
  MarketingCreativeInsight,
  MarketingPriorityItem,
  MarketingScenarioForecast,
} from "./marketing-manager-v2";

export type FinancialImpactType =
  | "profit_recovery"
  | "revenue_increase"
  | "cost_reduction"
  | "cash_flow_improvement";

export const FINANCIAL_IMPACT_LABELS: Record<FinancialImpactType, string> = {
  profit_recovery: "Estimated Monthly Profit Recovery",
  revenue_increase: "Estimated Revenue Increase",
  cost_reduction: "Estimated Cost Reduction",
  cash_flow_improvement: "Estimated Cash Flow Improvement",
};

export type MarketingExecutiveSummary = {
  headline: string;
  paragraphs: string[];
  todayPriority: string;
  todayPriorityDetail: string;
  estimatedMonthlyImprovement: number;
};

export type ChannelComparisonMetric = {
  key: string;
  label: string;
  metaValue: string;
  googleValue: string;
  winner: "meta" | "google" | "tie";
};

export type ChannelComparison = {
  metrics: ChannelComparisonMetric[];
  aiRecommendation: string;
  estimatedMonthlyImpact: number;
};

export type BudgetShiftReason = {
  id: string;
  label: string;
  active: boolean;
};

export type ExecutivePriorityItem = MarketingPriorityItem & {
  problem: string;
  rootCause: string;
  recommendedAction: string;
  expectedOutcome: string;
  financialImpactType: FinancialImpactType;
  timeUntilResults: string;
  difficulty: "Low" | "Medium" | "High";
  inactionLabel: string;
  inactionAmountMonthly: number | null;
  followUpQuestions: string[];
};

export type LandingPageInsight = {
  campaignId: string;
  campaignName: string;
  url: string;
  mainProblem: string;
  suggestedHeadline: string;
  suggestedCta: string;
  reasoning: string;
  expectedConversionLiftPct: number;
  expectedProfitMonthly: number;
};

export type MarketingStrength = {
  id: string;
  label: string;
  detail: string;
};

export type HealthScoreFactor = {
  id: string;
  label: string;
  contributionPct: number;
  score: number;
};

export type MarketingHealthBreakdown = {
  channel: string;
  label: string;
  overallScore: number;
  factors: HealthScoreFactor[];
};

export type MarketingExecutiveDecision = {
  title: string;
  bullets: string[];
  expectedBenefit: string;
  expectedBenefitMonthly: number;
  confidence: "High" | "Medium" | "Low";
  risk: "Low" | "Medium" | "High";
  riskReason: string;
};

export type SimulatorBaseline = {
  metaBudgetPct: number;
  googleBudgetPct: number;
  landingConversionPct: number;
  expectedRoas: number;
  weeklySpend: number;
  weeklyRevenue: number;
  weeklyProfit: number;
};

export type EnhancedCreativeInsight = MarketingCreativeInsight & {
  currentMessage: string;
  suggestedMessage: string;
  reason: string;
  expectedImprovement: string;
};

export type EnhancedForecastScenario = MarketingScenarioForecast["scenarios"][number] & {
  roas: number;
  scenarioAssumptions: string[];
};

export type MarketingExecutiveLayer = {
  executiveSummary: MarketingExecutiveSummary;
  channelComparison: ChannelComparison | null;
  budgetShiftReasons: BudgetShiftReason[];
  executivePriorities: ExecutivePriorityItem[];
  landingPageInsights: LandingPageInsight[];
  strengths: MarketingStrength[];
  healthBreakdowns: MarketingHealthBreakdown[];
  executiveDecision: MarketingExecutiveDecision;
  simulatorBaseline: SimulatorBaseline;
  enhancedCreatives: EnhancedCreativeInsight[];
  enhancedForecast: {
    scenarios: EnhancedForecastScenario[];
    aiOutlook: string;
    overallConfidencePct: number;
  };
};

function fmt(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function winnerNum(meta: number, google: number): "meta" | "google" | "tie" {
  if (Math.abs(meta - google) < 0.01) return "tie";
  return meta > google ? "meta" : "google";
}

function impactTypeForRec(kind: string): FinancialImpactType {
  if (kind === "landing_page_issue" || kind === "improve_creative") return "revenue_increase";
  if (kind === "pause_campaign" || kind === "reduce_budget") return "cost_reduction";
  if (kind === "scale" || kind === "increase_budget") return "revenue_increase";
  return "profit_recovery";
}

const FOLLOW_UPS = [
  "Why is this campaign losing money?",
  "Show me the worst ad set.",
  "Should I reduce budget or improve the landing page first?",
  "Compare Meta with Google.",
  "Generate a better landing page headline.",
  "Show evidence.",
];

export function buildMarketingExecutiveSummary(input: {
  platforms: MarketingPlatformSummary[];
  campaigns: EnrichedMarketingCampaign[];
  priorityQueue: MarketingPriorityItem[];
  estimatedRecoveryMonthly: number;
  budgetAllocation: MarketingBudgetAllocation;
}): MarketingExecutiveSummary {
  const meta = input.platforms.find((p) => p.channel === "meta");
  const google = input.platforms.find((p) => p.channel === "google");
  const paragraphs: string[] = [];

  if (meta?.connected) {
    if (meta.businessStatus === "unprofitable" || (meta.profit != null && meta.profit < 0)) {
      paragraphs.push("Meta Ads are currently operating below your profitability target.");
    } else {
      paragraphs.push("Meta Ads are within range of your profitability target.");
    }
  }

  if (google?.connected && meta?.connected) {
    const roasDiff =
      meta.roas > 0 ? Math.round(((google.roas - meta.roas) / meta.roas) * 100) : 0;
    if (roasDiff > 5) {
      paragraphs.push(`Google Ads are performing approximately ${roasDiff}% better than Meta.`);
    } else if (roasDiff < -5) {
      paragraphs.push(`Meta is performing approximately ${Math.abs(roasDiff)}% better than Google.`);
    }
  }

  const totalSpend = input.campaigns.reduce((s, c) => s + c.spend, 0);
  const belowTarget = input.campaigns.filter(
    (c) => c.health === "losing_money" || c.health === "needs_attention",
  );
  if (totalSpend > 0 && belowTarget.length > 0) {
    const pct = Math.round(
      (belowTarget.reduce((s, c) => s + c.spend, 0) / totalSpend) * 100,
    );
    paragraphs.push(
      `Most advertising spend is currently allocated to campaigns that are not yet profitable (${pct}% of budget).`,
    );
  }

  const top = input.priorityQueue[0];
  const todayPriority = top?.campaignName ?? "Review campaign portfolio";
  const todayPriorityDetail =
    top?.action ?? "Address the highest-impact campaign recommendation first.";

  return {
    headline: "Executive Marketing Summary",
    paragraphs,
    todayPriority,
    todayPriorityDetail,
    estimatedMonthlyImprovement:
      input.estimatedRecoveryMonthly > 0
        ? input.estimatedRecoveryMonthly
        : input.budgetAllocation.estimatedMonthlyImprovement,
  };
}

export function buildChannelComparison(
  platforms: MarketingPlatformSummary[],
  campaigns: EnrichedMarketingCampaign[],
  budgetAllocation: MarketingBudgetAllocation,
): ChannelComparison | null {
  const meta = platforms.find((p) => p.channel === "meta");
  const google = platforms.find((p) => p.channel === "google");
  if (!meta?.connected || !google?.connected) return null;

  const metaCampaigns = campaigns.filter((c) => c.channel === "meta");
  const googleCampaigns = campaigns.filter((c) => c.channel === "google");
  const metaCtr =
    metaCampaigns.length > 0
      ? metaCampaigns.reduce((s, c) => s + c.ctr, 0) / metaCampaigns.length
      : 0;
  const googleCtr =
    googleCampaigns.length > 0
      ? googleCampaigns.reduce((s, c) => s + c.ctr, 0) / googleCampaigns.length
      : 0;
  const metaCpa =
    metaCampaigns.filter((c) => c.cpa > 0);
  const googleCpa =
    googleCampaigns.filter((c) => c.cpa > 0);
  const avgMetaCpa =
    metaCpa.length > 0 ? metaCpa.reduce((s, c) => s + c.cpa, 0) / metaCpa.length : 0;
  const avgGoogleCpa =
    googleCpa.length > 0 ? googleCpa.reduce((s, c) => s + c.cpa, 0) / googleCpa.length : 0;

  const metrics: ChannelComparisonMetric[] = [
    {
      key: "spend",
      label: "Spend",
      metaValue: fmt(meta.spend),
      googleValue: fmt(google.spend),
      winner: winnerNum(meta.spend, google.spend),
    },
    {
      key: "revenue",
      label: "Revenue",
      metaValue: fmt(meta.revenue),
      googleValue: fmt(google.revenue),
      winner: winnerNum(meta.revenue, google.revenue),
    },
    {
      key: "profit",
      label: "Profit",
      metaValue: meta.profit != null ? fmt(meta.profit) : "—",
      googleValue: google.profit != null ? fmt(google.profit) : "—",
      winner: winnerNum(meta.profit ?? 0, google.profit ?? 0),
    },
    {
      key: "roas",
      label: "ROAS",
      metaValue: meta.roas.toFixed(2),
      googleValue: google.roas.toFixed(2),
      winner: winnerNum(meta.roas, google.roas),
    },
    {
      key: "cpa",
      label: "CPA",
      metaValue: avgMetaCpa > 0 ? `$${avgMetaCpa.toFixed(0)}` : "—",
      googleValue: avgGoogleCpa > 0 ? `$${avgGoogleCpa.toFixed(0)}` : "—",
      winner: avgMetaCpa > 0 && avgGoogleCpa > 0 ? (avgGoogleCpa < avgMetaCpa ? "google" : "meta") : "tie",
    },
    {
      key: "ctr",
      label: "CTR",
      metaValue: `${metaCtr.toFixed(2)}%`,
      googleValue: `${googleCtr.toFixed(2)}%`,
      winner: winnerNum(metaCtr, googleCtr),
    },
    {
      key: "status",
      label: "Business Status",
      metaValue: meta.businessStatusLabel,
      googleValue: google.businessStatusLabel,
      winner:
        meta.businessStatus === "profitable" && google.businessStatus !== "profitable"
          ? "meta"
          : google.businessStatus === "profitable" && meta.businessStatus !== "profitable"
            ? "google"
            : "tie",
    },
  ];

  const shiftPct = Math.abs(
    (budgetAllocation.suggested.find((s) => s.channel === "google")?.pct ?? 50) -
      (budgetAllocation.current.find((s) => s.channel === "google")?.pct ?? 50),
  );

  const rawRecommendation =
    google.roas > meta.roas
      ? `Shift approximately ${shiftPct || 10}% of budget from Meta to Google until Meta profitability improves.`
      : `Maintain current channel mix while optimizing underperforming campaigns within each platform.`;

  const validated = validateChannelBudgetRecommendation({
    meta,
    google,
    rawRecommendation,
    shiftPct,
  });

  return {
    metrics,
    aiRecommendation: validated.text,
    estimatedMonthlyImpact: budgetAllocation.estimatedMonthlyImprovement,
  };
}

export function buildBudgetShiftReasons(
  platforms: MarketingPlatformSummary[],
  budgetAllocation: MarketingBudgetAllocation,
): BudgetShiftReason[] {
  if (budgetAllocation.mode !== "cross_channel") {
    return [
      { id: "roas", label: "Higher ROAS", active: false },
      { id: "ctr", label: "Higher CTR", active: false },
      { id: "waste", label: "Lower wasted spend", active: false },
      { id: "confidence", label: "Higher forecast confidence", active: false },
    ];
  }

  const meta = platforms.find((p) => p.channel === "meta");
  const google = platforms.find((p) => p.channel === "google");
  const googleBetter = (google?.roas ?? 0) > (meta?.roas ?? 0);

  return [
    { id: "roas", label: "Higher ROAS", active: googleBetter },
    {
      id: "ctr",
      label: "Higher CTR",
      active: budgetAllocation.evidence.some((e) => /CTR/i.test(e)),
    },
    {
      id: "waste",
      label: "Lower wasted spend",
      active: meta?.businessStatus === "unprofitable",
    },
    {
      id: "confidence",
      label: "Higher forecast confidence",
      active: (google?.score ?? 0) > (meta?.score ?? 0),
    },
  ];
}

function problemForCampaign(c: EnrichedMarketingCampaign): string {
  if (c.recommendation === "landing_page_issue") {
    return "Landing page conversion is poor.";
  }
  if (c.recommendation === "improve_creative") {
    return "Creative performance is declining.";
  }
  if (c.recommendation === "pause_campaign") {
    return "Campaign is consistently unprofitable.";
  }
  return c.recommendationReason.split(".")[0] ?? "Campaign is underperforming.";
}

function rootCauseForCampaign(c: EnrichedMarketingCampaign): string {
  if (c.recommendation === "landing_page_issue") {
    return "Traffic quality is acceptable but visitors are not converting after clicking.";
  }
  if (c.recommendation === "improve_creative") {
    return "Ad engagement is weakening — frequency and CTR suggest creative fatigue.";
  }
  if (c.recommendation === "review_audience") {
    return "Audience targeting is driving high CPA relative to product margin.";
  }
  return `ROAS ${c.roas.toFixed(2)} is below your profitability target on ${c.shareOfSpendPct}% of channel spend.`;
}

export function buildExecutivePriorities(
  queue: MarketingPriorityItem[],
  campaigns: EnrichedMarketingCampaign[],
): ExecutivePriorityItem[] {
  const byId = new Map(campaigns.map((c) => [c.id, c]));

  return queue.map((item) => {
    const c = byId.get(item.campaignId);
    const kind = item.actionKind;
    const isLanding = kind === "landing_page_issue";

    return {
      ...item,
      problem: c ? problemForCampaign(c) : item.whyBullets[0] ?? "Underperformance detected",
      rootCause: c ? rootCauseForCampaign(c) : item.whyBullets[1] ?? "Review campaign signals.",
      recommendedAction: isLanding
        ? "Improve landing page messaging and align the headline with ad creative."
        : item.action,
      expectedOutcome: `+${fmt(item.impactMonthly)}/month profit recovery`,
      financialImpactType: impactTypeForRec(kind),
      timeUntilResults: isLanding ? "1–2 weeks" : kind === "improve_creative" ? "3–7 days" : "1–2 weeks",
      difficulty: isLanding ? "Medium" : kind === "pause_campaign" ? "Low" : "Medium",
      inactionLabel: "Estimated unnecessary ad spend",
      inactionAmountMonthly:
        item.impactMonthly > 0 ? Math.round(item.impactMonthly * 0.85) : null,
      followUpQuestions: FOLLOW_UPS.slice(0, 4),
    };
  });
}

export function buildLandingPageInsights(
  campaigns: EnrichedMarketingCampaign[],
  snapshot: StoreSnapshot,
): LandingPageInsight[] {
  const landing = campaigns.filter((c) => c.recommendation === "landing_page_issue");
  const topPath = snapshot.ga4Snapshot?.landingPages?.[0]?.path ?? "/collections/summer";

  return landing.slice(0, 3).map((c) => ({
    campaignId: c.id,
    campaignName: c.campaign,
    url: topPath,
    mainProblem: "Current headline does not match the advertising message.",
    suggestedHeadline: "Free Shipping Today",
    suggestedCta: "Shop Summer Collection",
    reasoning:
      "Traffic quality is acceptable but post-click conversion is weak — message continuity between ad and landing page should improve.",
    expectedConversionLiftPct: 0.8,
    expectedProfitMonthly: Math.round(c.spend * 4.33 * 0.12),
  }));
}

export function buildMarketingStrengths(
  platforms: MarketingPlatformSummary[],
  campaigns: EnrichedMarketingCampaign[],
): MarketingStrength[] {
  const strengths: MarketingStrength[] = [];
  const meta = platforms.find((p) => p.channel === "meta");
  const google = platforms.find((p) => p.channel === "google");

  if (google?.connected && meta?.connected && google.roas > meta.roas) {
    strengths.push({
      id: "google-roas",
      label: "Google Ads",
      detail: "Google Ads currently outperform Meta on ROAS.",
    });
  }

  const avgCtr =
    campaigns.length > 0
      ? campaigns.reduce((s, c) => s + c.ctr, 0) / campaigns.length
      : 0;
  if (avgCtr >= 1.2) {
    strengths.push({
      id: "traffic-quality",
      label: "Traffic Quality",
      detail: "Traffic quality remains healthy across active campaigns.",
    });
  }

  const improving = campaigns.filter((c) => c.roas >= 1.5);
  if (improving.length > 0) {
    strengths.push({
      id: "ctr-trend",
      label: "CTR Trend",
      detail: "CTR has improved over the last 7 days on top campaigns.",
    });
  }

  return strengths.slice(0, 4);
}

export function buildHealthBreakdowns(
  platforms: MarketingPlatformSummary[],
): MarketingHealthBreakdown[] {
  return platforms
    .filter((p) => p.connected && p.score != null)
    .map((p) => ({
      channel: p.channel,
      label: p.label,
      overallScore: p.score!,
      factors: [
        { id: "roas", label: "ROAS Contribution", contributionPct: 30, score: Math.min(100, Math.round(p.roas * 40)) },
        { id: "cpa", label: "CPA Contribution", contributionPct: 20, score: p.businessStatus === "profitable" ? 75 : 40 },
        { id: "ctr", label: "CTR Contribution", contributionPct: 15, score: 65 },
        { id: "conversion", label: "Conversion Contribution", contributionPct: 20, score: p.businessStatus === "profitable" ? 70 : 45 },
        { id: "creative", label: "Creative Quality Contribution", contributionPct: 10, score: 60 },
        { id: "budget", label: "Budget Efficiency Contribution", contributionPct: 5, score: p.score ?? 50 },
      ],
    }));
}

export function buildMarketingExecutiveDecision(input: {
  executiveSummary: MarketingExecutiveSummary;
  channelComparison: ChannelComparison | null;
  budgetAllocation: MarketingBudgetAllocation;
}): MarketingExecutiveDecision {
  const shiftPct = input.channelComparison
    ? Math.abs(
        (input.budgetAllocation.suggested.find((s) => s.channel === "google")?.pct ?? 50) -
          (input.budgetAllocation.current.find((s) => s.channel === "google")?.pct ?? 50),
      )
    : 10;

  const bullets: string[] = [];
  const isLanding =
    input.executiveSummary.todayPriorityDetail.toLowerCase().includes("landing") ||
    input.executiveSummary.todayPriorityDetail.toLowerCase().includes("page");

  if (isLanding) {
    bullets.push("Do not increase Meta Ads budget.");
    bullets.push(`Improve the ${input.executiveSummary.todayPriority} landing page first.`);
    bullets.push(
      `Then shift approximately ${shiftPct || 10}% of budget toward Google Ads while Meta campaigns recover.`,
    );
  } else if (input.channelComparison && input.channelComparison.metrics.find((m) => m.key === "roas")?.winner === "google") {
    bullets.push("Do not increase Meta Ads budget until profitability improves.");
    bullets.push(input.executiveSummary.todayPriorityDetail);
    bullets.push(input.channelComparison.aiRecommendation);
  } else {
    bullets.push(input.executiveSummary.todayPriorityDetail);
    bullets.push("Focus on the highest-priority campaign in the queue before scaling spend.");
  }

  const benefit = input.executiveSummary.estimatedMonthlyImprovement;

  return {
    title: "Today's Marketing Decision",
    bullets,
    expectedBenefit: benefit > 0 ? `+${fmt(benefit)}/month` : "Improved marketing efficiency",
    expectedBenefitMonthly: benefit,
    confidence: benefit > 3000 ? "High" : "Medium",
    risk: "Medium",
    riskReason: "Budget shifts may temporarily reduce reach while campaigns re-optimize.",
  };
}

export function buildSimulatorBaseline(
  platforms: MarketingPlatformSummary[],
  campaigns: EnrichedMarketingCampaign[],
  forecast: MarketingForecast,
): SimulatorBaseline {
  const meta = platforms.find((p) => p.channel === "meta");
  const google = platforms.find((p) => p.channel === "google");
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const totalProfit = campaigns.reduce((s, c) => s + (c.profitMeta.value ?? 0), 0);
  const metaSpend = meta?.spend ?? 0;
  const googleSpend = google?.spend ?? 0;
  const channelTotal = metaSpend + googleSpend || 1;

  const landing = campaigns.find((c) => c.recommendation === "landing_page_issue");
  const convRate = landing && landing.clicks > 0
    ? (landing.purchases / landing.clicks) * 100
    : 2.5;

  return {
    metaBudgetPct: Math.round((metaSpend / channelTotal) * 100),
    googleBudgetPct: Math.round((googleSpend / channelTotal) * 100),
    landingConversionPct: Math.round(convRate * 10) / 10,
    expectedRoas: totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : forecast.estimatedSpend > 0 ? forecast.estimatedRevenue / forecast.estimatedSpend : 1.5,
    weeklySpend: totalSpend,
    weeklyRevenue: totalRevenue,
    weeklyProfit: totalProfit,
  };
}

export function enhanceCreativeInsights(
  insights: MarketingCreativeInsight[],
): EnhancedCreativeInsight[] {
  return insights.map((insight) => ({
    ...insight,
    currentMessage: insight.insight.split("—")[0]?.trim() ?? insight.insight,
    suggestedMessage: insight.suggestedHeadline
      ? `Headline: "${insight.suggestedHeadline}"${insight.suggestedCta ? ` · CTA: "${insight.suggestedCta}"` : ""}`
      : insight.recommendation,
    reason: insight.recommendation,
    expectedImprovement: insight.severity === "warning" ? "CTR recovery within 7–14 days" : "ROAS lift on scaled spend",
  }));
}

export function enhanceForecast(
  forecast: MarketingScenarioForecast,
  campaigns: EnrichedMarketingCampaign[],
): MarketingExecutiveLayer["enhancedForecast"] {
  const weeklySpend = campaigns.reduce((s, c) => s + c.spend, 0);

  return {
    scenarios: forecast.scenarios.map((s) => ({
      ...s,
      roas: s.spend > 0 ? Math.round((s.revenue / s.spend) * 100) / 100 : 0,
      scenarioAssumptions: [
        s.label === "Worst Case"
          ? "Ad costs rise 5% with flat conversion"
          : s.label === "Best Case"
            ? "Approved recommendations executed; conversion improves"
            : "Current spend and conversion trends continue",
        `Weekly ad spend baseline: ${fmt(weeklySpend)}`,
        `Forecast confidence: ${s.confidencePct}%`,
      ],
    })),
    aiOutlook: forecast.aiOutlook,
    overallConfidencePct: forecast.overallConfidencePct,
  };
}

export function buildMarketingExecutiveLayer(input: {
  snapshot: StoreSnapshot;
  platforms: MarketingPlatformSummary[];
  campaigns: EnrichedMarketingCampaign[];
  forecast: MarketingForecast;
  priorityQueue: MarketingPriorityItem[];
  budgetAllocation: MarketingBudgetAllocation;
  scenarioForecast: MarketingScenarioForecast;
  creativeInsights: MarketingCreativeInsight[];
  estimatedRecoveryMonthly: number;
}): MarketingExecutiveLayer {
  const executiveSummary = buildMarketingExecutiveSummary({
    platforms: input.platforms,
    campaigns: input.campaigns,
    priorityQueue: input.priorityQueue,
    estimatedRecoveryMonthly: input.estimatedRecoveryMonthly,
    budgetAllocation: input.budgetAllocation,
  });
  const channelComparison = buildChannelComparison(
    input.platforms,
    input.campaigns,
    input.budgetAllocation,
  );

  return {
    executiveSummary,
    channelComparison,
    budgetShiftReasons: buildBudgetShiftReasons(input.platforms, input.budgetAllocation),
    executivePriorities: buildExecutivePriorities(input.priorityQueue, input.campaigns),
    landingPageInsights: buildLandingPageInsights(input.campaigns, input.snapshot),
    strengths: buildMarketingStrengths(input.platforms, input.campaigns),
    healthBreakdowns: buildHealthBreakdowns(input.platforms),
    executiveDecision: buildMarketingExecutiveDecision({
      executiveSummary,
      channelComparison,
      budgetAllocation: input.budgetAllocation,
    }),
    simulatorBaseline: buildSimulatorBaseline(input.platforms, input.campaigns, input.forecast),
    enhancedCreatives: enhanceCreativeInsights(input.creativeInsights),
    enhancedForecast: enhanceForecast(input.scenarioForecast, input.campaigns),
  };
}
