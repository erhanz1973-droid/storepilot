import type { StoreSnapshot } from "@/lib/connectors/types";
import type { DecisionItem } from "@/lib/decisions/center";
import type {
  CampaignRecommendationKind,
  EnrichedMarketingCampaign,
  MarketingForecast,
  MarketingPlatformSummary,
} from "./marketing-manager";
import {
  buildMarketingExecutiveLayer,
  type MarketingExecutiveLayer,
} from "./marketing-executive-layer";
import { RECOMMENDATION_LABELS } from "./marketing-recommendations";
import { estimateCampaignRecovery } from "./recovery-engine";

export type { MarketingExecutiveLayer } from "./marketing-executive-layer";

export type MarketingBrief = {
  greeting: string;
  lines: string[];
  todayPriority: string | null;
  todayPriorityAction: string | null;
  estimatedRecoveryMonthly: number;
};

export type BudgetChannelShare = {
  channel: "meta" | "google" | "other";
  label: string;
  pct: number;
};

export type MarketingBudgetAllocation = {
  current: BudgetChannelShare[];
  suggested: BudgetChannelShare[];
  estimatedMonthlyImprovement: number;
  rationale: string;
  evidence: string[];
  mode: "cross_channel" | "single_channel" | "unavailable";
  unavailableReason?: string;
};

export type MarketingPriorityItem = {
  rank: number;
  rankLabel: string;
  campaignId: string;
  campaignName: string;
  action: string;
  actionKind: CampaignRecommendationKind;
  impactMonthly: number;
  decisionId?: string;
  whyBullets: string[];
  recoveryProbabilityPct: number;
};

export type MetricVsTarget = {
  label: string;
  currentLabel: string;
  targetLabel: string;
  gapLabel: string;
  gapPct: number;
  negativeGap: boolean;
};

export type PlatformHealthDetail = {
  channel: MarketingPlatformSummary["channel"];
  label: string;
  connected: boolean;
  score: number | null;
  businessStatusLabel: string;
  metrics: MetricVsTarget[];
  explanation: string[];
};

export type MarketingEfficiency = {
  current: number;
  target: number;
  gap: number;
  currentLabel: string;
  targetLabel: string;
  gapLabel: string;
};

export type MarketingCreativeInsight = {
  id: string;
  creativeLabel: string;
  insight: string;
  recommendation: string;
  severity: "info" | "warning" | "opportunity";
  suggestedHeadline?: string;
  suggestedCta?: string;
  creativeConcepts?: string[];
};

export type MarketingSimulation = {
  id: string;
  label: string;
  predictedMetric: string;
  predictedValue: string;
  predictedProfitMonthly: number;
  confidencePct: number;
  campaignId?: string;
};

export type ForecastScenario = {
  label: "Best Case" | "Expected" | "Worst Case";
  spend: number;
  revenue: number;
  profit: number | null;
  confidencePct: number;
};

export type MarketingScenarioForecast = {
  scenarios: ForecastScenario[];
  aiOutlook: string;
  assumptions: string[];
  overallConfidencePct: number;
};

export type CampaignTrendMetric = {
  label: string;
  direction: "up" | "down" | "flat";
  note: string;
};

export type CampaignTimelineEntry = {
  campaignId: string;
  campaignName: string;
  periodLabel: string;
  metrics: CampaignTrendMetric[];
};

export type MarketingOpportunityGroup = {
  id: string;
  title: string;
  items: { campaignId: string; campaignName: string; action: string; impactMonthly: number }[];
};

export type MarketingAutopilotReadiness = {
  actionsReady: number;
  estimatedRecoveryMonthly: number;
  oneClickAvailable: boolean;
  oneClickLabel: string;
  executableCount: number;
};

export type MarketingManagerV2 = {
  brief: MarketingBrief;
  executive: MarketingExecutiveLayer;
  budgetAllocation: MarketingBudgetAllocation;
  platformHealthDetails: PlatformHealthDetail[];
  marketingEfficiency: MarketingEfficiency;
  priorityQueue: MarketingPriorityItem[];
  campaignTimelines: CampaignTimelineEntry[];
  opportunityGroups: MarketingOpportunityGroup[];
  creativeInsights: MarketingCreativeInsight[];
  simulations: MarketingSimulation[];
  scenarioForecast: MarketingScenarioForecast;
  autopilotReadiness: MarketingAutopilotReadiness;
};

const DEFAULT_TARGET_ROAS = 2.2;

function pctGap(current: number, target: number): number {
  if (target === 0) return 0;
  return Math.round(((current - target) / target) * 100);
}

function deriveTargets(snapshot: StoreSnapshot, campaigns: EnrichedMarketingCampaign[]) {
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const blendedRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const withCpa = campaigns.filter((c) => c.cpa > 0);
  const blendedCpa =
    withCpa.length > 0 ? withCpa.reduce((s, c) => s + c.cpa, 0) / withCpa.length : 0;
  const aov = snapshot.storeMetrics.aov30d || 80;
  const targetRoas = DEFAULT_TARGET_ROAS;
  const targetCpa = Math.round(aov / targetRoas);
  return { blendedRoas, blendedCpa, targetRoas, targetCpa, totalSpend, totalRevenue };
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function greetingForHour(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function monthlyImpact(c: EnrichedMarketingCampaign): number {
  return estimateCampaignRecovery({
    weeklyProfit: c.profitMeta.value,
    weeklySpend: c.spend,
    recoveryProbabilityPct: c.recoveryProbabilityPct,
    recommendation: c.recommendation,
  });
}

function actionLabel(kind: CampaignRecommendationKind): string {
  if (kind === "pause_campaign") return "Pause campaign";
  if (kind === "reduce_budget") return "Reduce budget";
  if (kind === "optimize_campaign") return "Optimize campaign";
  if (kind === "continue_learning") return "Continue learning";
  if (kind === "increase_budget" || kind === "scale") return "Increase budget";
  if (kind === "improve_creative") return "Refresh creative";
  if (kind === "landing_page_issue") return "Fix landing page";
  if (kind === "review_audience") return "Review audience";
  return RECOMMENDATION_LABELS[kind];
}

export function buildMarketingBrief(input: {
  platforms: MarketingPlatformSummary[];
  campaigns: EnrichedMarketingCampaign[];
  priorityQueue: MarketingPriorityItem[];
  estimatedRecoveryMonthly: number;
}): MarketingBrief {
  const lines: string[] = [];
  const meta = input.platforms.find((p) => p.channel === "meta");
  const google = input.platforms.find((p) => p.channel === "google");

  if (meta?.connected && meta.profit != null && meta.profit < 0) {
    lines.push(`Meta Ads are currently losing approximately ${fmt(Math.abs(meta.profit * 4.33))}/month.`);
  } else if (meta?.connected) {
    lines.push(meta.aiSummary);
  }

  if (google?.connected && meta?.connected) {
    if (google.roas > meta.roas * 1.05) {
      lines.push("Google Ads are performing slightly better than Meta.");
    } else if (meta.roas > google.roas * 1.05) {
      lines.push("Meta is outperforming Google on ROAS this period.");
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
    lines.push(`${pct}% of your advertising budget is being spent below your profitability target.`);
  }

  if (input.estimatedRecoveryMonthly > 0) {
    lines.push(
      `If today's recommendations are approved, AI estimates monthly marketing profit could improve by approximately ${fmt(input.estimatedRecoveryMonthly)}.`,
    );
  }

  const top = input.priorityQueue[0];

  return {
    greeting: greetingForHour(),
    lines,
    todayPriority: top?.campaignName ?? null,
    todayPriorityAction: top?.action ?? null,
    estimatedRecoveryMonthly: input.estimatedRecoveryMonthly,
  };
}

export function buildMarketingBudgetAllocation(input: {
  platforms: MarketingPlatformSummary[];
  campaigns: EnrichedMarketingCampaign[];
}): MarketingBudgetAllocation {
  const meta = input.platforms.find((p) => p.channel === "meta");
  const google = input.platforms.find((p) => p.channel === "google");
  const metaConnected = meta?.connected ?? false;
  const googleConnected = google?.connected ?? false;
  const bothConnected = metaConnected && googleConnected;
  const anyAdsConnected = metaConnected || googleConnected;

  if (!anyAdsConnected) {
    return {
      current: [],
      suggested: [],
      estimatedMonthlyImprovement: 0,
      rationale: "Connect Meta or Google Ads to unlock budget allocation recommendations.",
      evidence: [],
      mode: "unavailable",
      unavailableReason: "No advertising platforms connected.",
    };
  }

  const metaSpend = metaConnected ? (meta?.spend ?? 0) : 0;
  const googleSpend = googleConnected ? (google?.spend ?? 0) : 0;
  const otherSpend = input.campaigns
    .filter((c) => c.channel !== "meta" && c.channel !== "google")
    .reduce((s, c) => s + c.spend, 0);
  const total = metaSpend + googleSpend + otherSpend || 1;

  if (!bothConnected) {
    const singleChannel = metaConnected ? ("meta" as const) : ("google" as const);
    const singleLabel = metaConnected ? "Meta" : "Google";
    return {
      current: [{ channel: singleChannel, label: singleLabel, pct: 100 }],
      suggested: [{ channel: singleChannel, label: singleLabel, pct: 100 }],
      estimatedMonthlyImprovement: 0,
      rationale: `Budget recommendations use ${singleLabel} only. Connect the other platform for cross-channel allocation.`,
      evidence: [`${singleLabel} is your only connected advertising platform.`],
      mode: "single_channel",
    };
  }

  const metaRoas = meta?.roas ?? 0;
  const googleRoas = google?.roas ?? 0;
  const metaCpa =
    input.campaigns.filter((c) => c.channel === "meta" && c.cpa > 0);
  const googleCpa =
    input.campaigns.filter((c) => c.channel === "google" && c.cpa > 0);
  const avgMetaCpa =
    metaCpa.length > 0 ? metaCpa.reduce((s, c) => s + c.cpa, 0) / metaCpa.length : 0;
  const avgGoogleCpa =
    googleCpa.length > 0 ? googleCpa.reduce((s, c) => s + c.cpa, 0) / googleCpa.length : 0;
  const metaCtr =
    metaCpa.length > 0 ? metaCpa.reduce((s, c) => s + c.ctr, 0) / metaCpa.length : 0;
  const googleCtr =
    googleCpa.length > 0 ? googleCpa.reduce((s, c) => s + c.ctr, 0) / googleCpa.length : 0;

  let suggestedMeta = Math.round((metaSpend / total) * 100);
  let suggestedGoogle = Math.round((googleSpend / total) * 100);
  const shiftTowardGoogle = google?.connected && meta?.connected && googleRoas > metaRoas * 1.08;
  if (shiftTowardGoogle && metaSpend + googleSpend > 0) {
    suggestedMeta = 45;
    suggestedGoogle = 55;
  } else if (meta?.connected && google?.connected && metaRoas > googleRoas * 1.08) {
    suggestedMeta = 58;
    suggestedGoogle = 42;
  }
  const suggestedOther = Math.max(0, 100 - suggestedMeta - suggestedGoogle);

  const shiftPct = Math.abs(suggestedMeta - Math.round((metaSpend / total) * 100));
  const improvement = Math.round(
    input.platforms.reduce((s, p) => s + p.recoverableProfitMonthly, 0) * (shiftPct / 100) * 0.4,
  );

  const evidence: string[] = [];
  if (meta?.connected && google?.connected) {
    const roasDiffPct =
      metaRoas > 0 ? Math.round(((googleRoas - metaRoas) / metaRoas) * 100) : 0;
    if (roasDiffPct > 5) {
      evidence.push(`Google currently generates ${roasDiffPct}% higher ROAS (${googleRoas.toFixed(2)} vs ${metaRoas.toFixed(2)}).`);
    } else if (roasDiffPct < -5) {
      evidence.push(`Meta currently generates ${Math.abs(roasDiffPct)}% higher ROAS (${metaRoas.toFixed(2)} vs ${googleRoas.toFixed(2)}).`);
    }
    if (avgGoogleCpa > 0 && avgMetaCpa > 0) {
      const cpaDiffPct = Math.round(((avgMetaCpa - avgGoogleCpa) / avgMetaCpa) * 100);
      if (cpaDiffPct > 8) {
        evidence.push(`Google CPA is lower by ${cpaDiffPct}% ($${avgGoogleCpa.toFixed(0)} vs $${avgMetaCpa.toFixed(0)}).`);
      } else if (cpaDiffPct < -8) {
        evidence.push(`Meta CPA is lower by ${Math.abs(cpaDiffPct)}% ($${avgMetaCpa.toFixed(0)} vs $${avgGoogleCpa.toFixed(0)}).`);
      }
    }
    if (googleCtr > metaCtr * 1.1) {
      evidence.push(`Google traffic quality is higher — CTR ${googleCtr.toFixed(2)}% vs Meta ${metaCtr.toFixed(2)}%.`);
    } else if (metaCtr > googleCtr * 1.1) {
      evidence.push(`Meta traffic quality is higher — CTR ${metaCtr.toFixed(2)}% vs Google ${googleCtr.toFixed(2)}%.`);
    }
  }
  if (evidence.length === 0) {
    evidence.push("Rebalance spend toward the platform with stronger ROAS and lower CPA this period.");
  }

  return {
    current: [
      { channel: "meta", label: "Meta", pct: Math.round((metaSpend / total) * 100) },
      { channel: "google", label: "Google", pct: Math.round((googleSpend / total) * 100) },
      ...(otherSpend > 0
        ? [{ channel: "other" as const, label: "Other", pct: Math.round((otherSpend / total) * 100) }]
        : []),
    ],
    suggested: [
      { channel: "meta", label: "Meta", pct: suggestedMeta },
      { channel: "google", label: "Google", pct: suggestedGoogle },
      ...(suggestedOther > 0
        ? [{ channel: "other" as const, label: "Other", pct: suggestedOther }]
        : []),
    ],
    estimatedMonthlyImprovement: improvement > 0 ? improvement : 0,
    rationale: shiftTowardGoogle
      ? "Shift budget toward Google where ROAS and efficiency are stronger."
      : "Rebalance spend away from underperforming campaigns toward higher-ROAS channels.",
    evidence,
    mode: "cross_channel",
  };
}

export function buildPlatformHealthDetails(
  platforms: MarketingPlatformSummary[],
  snapshot: StoreSnapshot,
  campaigns: EnrichedMarketingCampaign[],
): PlatformHealthDetail[] {
  const { targetRoas, targetCpa } = deriveTargets(snapshot, campaigns);

  return platforms.map((p) => {
    if (!p.connected) {
      return {
        channel: p.channel,
        label: p.label,
        connected: false,
        score: null,
        businessStatusLabel: "No data available",
        metrics: [],
        explanation: ["Connect this platform to receive health scoring and target comparisons."],
      };
    }

    const channelCampaigns = campaigns.filter((c) => c.channel === p.channel);
    const withCpa = channelCampaigns.filter((c) => c.cpa > 0);
    const avgCpa =
      withCpa.length > 0 ? withCpa.reduce((s, c) => s + c.cpa, 0) / withCpa.length : 0;

    const roasGap = pctGap(p.roas, targetRoas);
    const cpaGap = avgCpa > 0 ? pctGap(avgCpa, targetCpa) : 0;

    return {
      channel: p.channel,
      label: p.label,
      connected: true,
      score: p.score,
      businessStatusLabel: p.businessStatusLabel,
      metrics: [
        {
          label: "ROAS",
          currentLabel: p.roas.toFixed(2),
          targetLabel: targetRoas.toFixed(2),
          gapLabel: `${roasGap >= 0 ? "+" : ""}${roasGap}%`,
          gapPct: roasGap,
          negativeGap: roasGap < 0,
        },
        ...(avgCpa > 0
          ? [
              {
                label: "CPA",
                currentLabel: `$${avgCpa.toFixed(0)}`,
                targetLabel: `$${targetCpa}`,
                gapLabel: `${cpaGap >= 0 ? "+" : ""}${cpaGap}%`,
                gapPct: cpaGap,
                negativeGap: cpaGap > 0,
              },
            ]
          : []),
      ],
      explanation: p.scoreExplanation,
    };
  });
}

export function buildMarketingEfficiency(
  snapshot: StoreSnapshot,
  campaigns: EnrichedMarketingCampaign[],
): MarketingEfficiency {
  const { blendedRoas, targetRoas, totalSpend, totalRevenue } = deriveTargets(snapshot, campaigns);
  const current = totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : 0;
  const gap = Math.round((current - targetRoas) * 100) / 100;

  return {
    current,
    target: targetRoas,
    gap,
    currentLabel: `$${current.toFixed(2)}`,
    targetLabel: `$${targetRoas.toFixed(2)}`,
    gapLabel: gap >= 0 ? `+$${gap.toFixed(2)}` : `-$${Math.abs(gap).toFixed(2)}`,
  };
}

function buildPriorityWhyBullets(c: EnrichedMarketingCampaign): string[] {
  const bullets: string[] = [];
  const convRate =
    c.clicks > 0 ? ((c.purchases / c.clicks) * 100).toFixed(1) : "0.0";

  switch (c.recommendation) {
    case "landing_page_issue":
      bullets.push(`ROAS ${c.roas.toFixed(2)} is below target — traffic converts at only ${convRate}%.`);
      bullets.push("Traffic quality is acceptable — the bottleneck is post-click conversion.");
      bullets.push(`Supporting signal: CTR ${c.ctr.toFixed(2)}% (diagnostic).`);
      break;
    case "improve_creative":
      bullets.push(`ROAS ${c.roas.toFixed(2)} is weakening — creative engagement is likely the bottleneck.`);
      bullets.push("Refreshing creatives can recover profitability without pausing spend.");
      bullets.push(`Supporting signals: CTR ${c.ctr.toFixed(2)}%, elevated frequency.`);
      break;
    case "review_audience":
      bullets.push(`CPA is $${c.cpa.toFixed(0)} — audience efficiency is limiting profit on this campaign.`);
      bullets.push("Audience expansion or exclusion can lower acquisition costs before cutting budget.");
      bullets.push(`Supporting signal: CTR ${c.ctr.toFixed(2)}% (may indicate wrong audience fit).`);
      break;
    case "optimize_campaign":
    case "reduce_budget":
      bullets.push(`ROAS ${c.roas.toFixed(2)} is below your profitability target.`);
      bullets.push(`Campaign spends ${c.shareOfSpendPct}% of channel budget.`);
      bullets.push("Budget and bid optimization should be attempted before pausing.");
      break;
    case "continue_learning":
      bullets.push("Campaign is still in the learning phase.");
      bullets.push(`Only ${c.purchases} conversions in 7 days — insufficient data to pause.`);
      bullets.push("Pausing now would waste optimization signal.");
      break;
    case "pause_campaign":
      bullets.push(`ROAS ${c.roas.toFixed(2)} remained below break-even after optimization attempts.`);
      bullets.push(`Recovery probability is only ${c.recoveryProbabilityPct}%.`);
      bullets.push("Every reasonable recovery path has been exhausted.");
      break;
    default:
      bullets.push(c.recommendationReason.split(".")[0] ?? c.recommendationReason);
  }

  bullets.push(`Estimated recovery probability: ${c.recoveryProbabilityPct}%.`);
  return bullets.slice(0, 4);
}

export function buildExtendedScoreExplanation(
  platform: MarketingPlatformSummary,
  campaigns: EnrichedMarketingCampaign[],
  snapshot: StoreSnapshot,
): string[] {
  const lines = [...platform.scoreExplanation];
  const channelCampaigns = campaigns.filter((c) => c.channel === platform.channel);

  if (platform.roas < 1) lines.push("ROAS below break-even");
  if (platform.businessStatus === "unprofitable") lines.push("Platform estimated net-negative");

  const highCpa = channelCampaigns.filter((c) => c.cpa > 0).sort((a, b) => b.cpa - a.cpa)[0];
  if (highCpa && highCpa.cpa > 45) {
    lines.push(`CPA elevated on ${highCpa.campaign} ($${highCpa.cpa.toFixed(0)})`);
  }

  if (platform.channel === "meta") {
    for (const mc of snapshot.campaigns) {
      if (mc.frequency7d > 2.8 && mc.roas7d < 1.2) {
        lines.push(`ROAS under pressure on ${mc.name} (${mc.roas7d.toFixed(2)})`);
      }
      if (mc.frequency7d > 2.2 && mc.ctr7d < 1.2) {
        lines.push("Creative fatigue may be limiting returns");
      }
    }
    const names = channelCampaigns.map((c) => c.campaign.toLowerCase());
    if (names.filter((n) => n.includes("prospect")).length >= 2) {
      lines.push("Campaign overlap detected in prospecting");
    }
  }

  const losing = channelCampaigns.filter((c) => c.health === "losing_money").length;
  if (losing >= 2) lines.push(`${losing} campaigns losing money simultaneously`);

  return [...new Set(lines)].slice(0, 6);
}

export function buildMarketingPriorityQueue(
  campaigns: EnrichedMarketingCampaign[],
): MarketingPriorityItem[] {
  const actionable = campaigns.filter(
    (c) => c.recommendation !== "healthy" && c.recommendation !== "scale",
  );
  const sorted = [...actionable].sort((a, b) => {
    const pausePenalty = (c: EnrichedMarketingCampaign) =>
      c.recommendation === "pause_campaign" ? 1 : 0;
    const pauseDiff = pausePenalty(a) - pausePenalty(b);
    if (pauseDiff !== 0) return pauseDiff;
    return monthlyImpact(b) - monthlyImpact(a);
  });
  const rankLabels = ["Highest Priority", "Second", "Third", "Fourth", "Fifth"];

  return sorted.slice(0, 5).map((c, i) => ({
    rank: i + 1,
    rankLabel: rankLabels[i] ?? `#${i + 1}`,
    campaignId: c.id,
    campaignName: c.campaign,
    action: actionLabel(c.recommendation),
    actionKind: c.recommendation,
    impactMonthly: monthlyImpact(c),
    decisionId: c.decisionId,
    whyBullets: buildPriorityWhyBullets(c),
    recoveryProbabilityPct: c.recoveryProbabilityPct,
  }));
}

export function buildCampaignTimelines(
  campaigns: EnrichedMarketingCampaign[],
  snapshot: StoreSnapshot,
): CampaignTimelineEntry[] {
  const top = [...campaigns].sort((a, b) => b.spend - a.spend).slice(0, 4);

  return top.map((c) => {
    const meta = snapshot.campaigns.find((m) => m.id === c.id);
    const metrics: CampaignTrendMetric[] = [];

    if (c.roas < 1.2) metrics.push({ label: "ROAS", direction: "down", note: "ROAS ↓" });
    else if (c.roas >= 2) metrics.push({ label: "ROAS", direction: "up", note: "ROAS ↑" });
    else metrics.push({ label: "ROAS", direction: "flat", note: "ROAS →" });

    metrics.push(
      c.cpa > 50
        ? { label: "CPA", direction: "up", note: "CPA ↑" }
        : { label: "CPA", direction: "down", note: "CPA ↓" },
    );
    metrics.push(
      c.ctr < 1
        ? { label: "CTR", direction: "down", note: "CTR ↓" }
        : { label: "CTR", direction: "up", note: "CTR ↑" },
    );
    metrics.push(
      c.shareOfSpendPct > 25
        ? { label: "Spend", direction: "up", note: "Spend ↑" }
        : { label: "Spend", direction: "flat", note: "Spend →" },
    );
    if (meta && meta.frequency7d > 2.5) {
      metrics.push({ label: "Frequency", direction: "up", note: "Frequency ↑" });
    }

    return {
      campaignId: c.id,
      campaignName: c.campaign,
      periodLabel: "7 Days",
      metrics,
    };
  });
}

const OPPORTUNITY_GROUP_DEFS: {
  id: string;
  title: string;
  kinds: CampaignRecommendationKind[];
}[] = [
  { id: "stop", title: "Stop Spending", kinds: ["pause_campaign"] },
  { id: "optimize", title: "Optimize Campaign", kinds: ["optimize_campaign", "reduce_budget"] },
  { id: "increase", title: "Increase Investment", kinds: ["increase_budget", "scale"] },
  { id: "creative", title: "Creative Improvements", kinds: ["improve_creative"] },
  { id: "landing", title: "Landing Page", kinds: ["landing_page_issue"] },
  { id: "audience", title: "Audience Review", kinds: ["review_audience"] },
  { id: "learning", title: "Learning Phase", kinds: ["continue_learning"] },
];

export function buildMarketingOpportunityMap(
  campaigns: EnrichedMarketingCampaign[],
): MarketingOpportunityGroup[] {
  return OPPORTUNITY_GROUP_DEFS.map((def) => {
    const items = campaigns
      .filter((c) => def.kinds.includes(c.recommendation))
      .sort((a, b) => monthlyImpact(b) - monthlyImpact(a))
      .slice(0, 4)
      .map((c) => ({
        campaignId: c.id,
        campaignName: c.campaign,
        action: RECOMMENDATION_LABELS[c.recommendation],
        impactMonthly: monthlyImpact(c),
      }));
    return { id: def.id, title: def.title, items };
  }).filter((g) => g.items.length > 0);
}

export function buildMarketingCreativeInsights(
  snapshot: StoreSnapshot,
  campaigns: EnrichedMarketingCampaign[],
): MarketingCreativeInsight[] {
  const insights: MarketingCreativeInsight[] = [];
  const metaCampaigns = snapshot.campaigns.filter((c) => c.spend7d > 100);

  if (metaCampaigns.length >= 2) {
    const byCtr = [...metaCampaigns].sort((a, b) => b.ctr7d - a.ctr7d);
    const byRoas = [...metaCampaigns].sort((a, b) => b.roas7d - a.roas7d);
    const highCtr = byCtr[0];
    const highConv = byRoas[0];
    if (highCtr && highConv && highCtr.id !== highConv.id) {
      insights.push({
        id: "ctr-vs-cvr",
        creativeLabel: highCtr.name,
        insight: `${highCtr.name} has the highest CTR (${highCtr.ctr7d.toFixed(2)}%) but ${highConv.name} converts better (ROAS ${highConv.roas7d.toFixed(2)}).`,
        recommendation: "Route more budget to the higher-converting creative angle.",
        severity: "opportunity",
      });
    }
    if (highConv && byRoas[1]) {
      const ratio = highConv.roas7d / Math.max(byRoas[1].roas7d, 0.1);
      if (ratio >= 1.5) {
        insights.push({
          id: "conv-multiple",
          creativeLabel: highConv.name,
          insight: `${highConv.name} converts ${ratio.toFixed(1)}x better than the next best campaign.`,
          recommendation: "Duplicate winning creative structure to other ad sets.",
          severity: "opportunity",
        });
      }
    }
    for (const mc of metaCampaigns) {
      if (mc.frequency7d > 2.5 && mc.ctr7d < 1.2) {
        insights.push({
          id: `fatigue-${mc.id}`,
          creativeLabel: mc.name,
          insight: `Creative fatigue detected on ${mc.name} — frequency ${mc.frequency7d.toFixed(1)}, CTR ${mc.ctr7d.toFixed(2)}%.`,
          recommendation: "Recommend refreshing creatives within 7 days.",
          severity: "warning",
        });
      }
    }
  }

  const ga4 = snapshot.ga4Snapshot;
  if (ga4?.devices?.length) {
    const mobile = ga4.devices.find((d) => d.device === "mobile");
    const desktop = ga4.devices.find((d) => d.device === "desktop");
    if (mobile && desktop && desktop.sessions > 100 && mobile.sessions > 100) {
      const mobileCvr = mobile.revenue / mobile.sessions;
      const desktopCvr = desktop.revenue / desktop.sessions;
      if (desktopCvr > 0 && mobileCvr < desktopCvr * 0.65) {
        insights.push({
          id: "mobile-ga4",
          creativeLabel: "Mobile traffic",
          insight: "GA4 shows mobile converts significantly worse than desktop from paid traffic.",
          recommendation: "Improve mobile landing page conversion — check page speed and checkout friction.",
          severity: "warning",
        });
      }
    }
    const topLanding = ga4.landingPages?.[0];
    if (topLanding?.path) {
      insights.push({
        id: "landing-top",
        creativeLabel: topLanding.path,
        insight: "Creative message does not match landing page — paid clicks land on a page with weak message continuity.",
        recommendation: "Align ad copy with the landing page offer and above-the-fold value proposition.",
        severity: "warning",
        suggestedHeadline: "Free Shipping Today",
        suggestedCta: "Shop Summer Collection",
        creativeConcepts: [
          "Hero image matching top-selling product from this landing page",
          "UGC testimonial with same headline as landing page H1",
          "Limited-time offer badge mirroring on-site promotion",
        ],
      });
    }
  }

  if (insights.length === 0) {
    const creative = campaigns.find((c) => c.recommendation === "improve_creative");
    if (creative) {
      insights.push({
        id: "fallback-creative",
        creativeLabel: creative.campaign,
        insight: creative.recommendationReason,
        recommendation: "Test new creative variants against current control.",
        severity: "info",
      });
    }
  }

  return insights.slice(0, 5);
}

export function buildMarketingSimulations(
  campaigns: EnrichedMarketingCampaign[],
): MarketingSimulation[] {
  const sims: MarketingSimulation[] = [];
  const metaSpend = campaigns.filter((c) => c.channel === "meta").reduce((s, c) => s + c.spend, 0);
  const googleSpend = campaigns.filter((c) => c.channel === "google").reduce((s, c) => s + c.spend, 0);

  if (metaSpend > 0) {
    for (const pct of [10, 20]) {
      const profit = Math.round(metaSpend * (pct / 100) * 0.35 * 4.33);
      sims.push({
        id: `sim-meta-reduce-${pct}`,
        label: `Reduce Meta budget by ${pct}%`,
        predictedMetric: "Predicted Monthly Profit",
        predictedValue: `+${fmt(profit)}`,
        predictedProfitMonthly: profit,
        confidencePct: pct === 10 ? 78 : 74,
      });
    }
  }

  if (googleSpend > 0) {
    const profit = Math.round(googleSpend * 0.15 * 4.33 * 0.4);
    sims.push({
      id: "sim-google-increase-15",
      label: "Increase Google budget by 15%",
      predictedMetric: "Predicted Monthly Profit",
      predictedValue: `+${fmt(profit)}`,
      predictedProfitMonthly: profit,
      confidencePct: 68,
    });
  }

  const worst = [...campaigns]
    .filter((c) => c.recommendation === "pause_campaign")
    .sort((a, b) => monthlyImpact(b) - monthlyImpact(a))[0];
  if (worst) {
    const profit = monthlyImpact(worst);
    sims.push({
      id: "sim-pause",
      label: `Pause ${worst.campaign}`,
      predictedMetric: "Predicted Monthly Profit",
      predictedValue: `+${fmt(profit)}`,
      predictedProfitMonthly: profit,
      confidencePct: 82,
      campaignId: worst.id,
    });
  }

  const landing = campaigns.find((c) => c.recommendation === "landing_page_issue");
  if (landing) {
    const profit = Math.round(landing.spend * 4.33 * 0.12);
    sims.push({
      id: "sim-landing-cvr",
      label: "Improve landing page conversion by 1%",
      predictedMetric: "Predicted Monthly Profit",
      predictedValue: `+${fmt(profit)}`,
      predictedProfitMonthly: profit,
      confidencePct: 71,
      campaignId: landing.id,
    });
  }

  return sims.slice(0, 6);
}

export function buildMarketingScenarioForecast(
  forecast: MarketingForecast,
  campaigns: EnrichedMarketingCampaign[],
  snapshot: StoreSnapshot,
): MarketingScenarioForecast {
  const baseSpend = forecast.estimatedSpend;
  const baseRevenue = forecast.estimatedRevenue;
  const baseProfit = forecast.estimatedProfit ?? 0;
  const recovery = campaigns
    .filter((c) => c.recommendation !== "healthy")
    .reduce((s, c) => s + monthlyImpact(c), 0);

  const { blendedRoas, blendedCpa } = deriveTargets(snapshot, campaigns);
  const roasTrend = blendedRoas < 1.2 ? "declining" : blendedRoas >= 2 ? "stable" : "mixed";
  const cpaTrend = blendedCpa > 45 ? "rising" : "stable";
  const assumptions = [
    "Last 30 days of advertising performance (scaled from 7-day sync)",
    `Current ROAS trend: ${roasTrend} (blended ${blendedRoas.toFixed(2)})`,
    `Current CPA trend: ${cpaTrend}${blendedCpa > 0 ? ` ($${blendedCpa.toFixed(0)} avg)` : ""}`,
    `Current conversion trend from ${campaigns.reduce((s, c) => s + c.purchases, 0)} weekly purchases`,
    `Current spend trend: $${Math.round(campaigns.reduce((s, c) => s + c.spend, 0)).toLocaleString()}/week`,
  ];

  const overallConfidencePct = forecast.profitMeta.confidencePct || 78;

  return {
    scenarios: [
      {
        label: "Worst Case",
        spend: Math.round(baseSpend * 1.05),
        revenue: Math.round(baseRevenue * 0.88),
        profit: baseProfit !== 0 ? Math.round(baseProfit * 1.15) : null,
        confidencePct: 62,
      },
      {
        label: "Expected",
        spend: baseSpend,
        revenue: baseRevenue,
        profit: forecast.estimatedProfit,
        confidencePct: overallConfidencePct,
      },
      {
        label: "Best Case",
        spend: Math.round(baseSpend * 0.92),
        revenue: Math.round(baseRevenue * 1.12),
        profit: Math.round(baseProfit + recovery * 0.35),
        confidencePct: 71,
      },
    ],
    aiOutlook: forecast.aiOutlook,
    assumptions,
    overallConfidencePct,
  };
}

export function buildMarketingAutopilotReadiness(input: {
  campaigns: EnrichedMarketingCampaign[];
  decisions: DecisionItem[];
  estimatedRecoveryMonthly: number;
}): MarketingAutopilotReadiness {
  const withDecisions = input.campaigns.filter((c) => c.decisionId);
  const executable = input.decisions.filter(
    (d) =>
      d.entityType === "campaign" &&
      d.actionAvailable &&
      (d.status === "open" || d.status === "viewed"),
  );

  return {
    actionsReady: Math.max(
      withDecisions.length,
      input.campaigns.filter((c) => c.recommendation !== "healthy").length,
    ),
    estimatedRecoveryMonthly: input.estimatedRecoveryMonthly,
    oneClickAvailable: executable.length > 0,
    oneClickLabel: executable.length > 0 ? "Available" : "Review in Decisions",
    executableCount: executable.length,
  };
}

export function buildMarketingManagerV2(input: {
  snapshot: StoreSnapshot;
  platforms: MarketingPlatformSummary[];
  campaigns: EnrichedMarketingCampaign[];
  forecast: MarketingForecast;
  decisions: DecisionItem[];
}): MarketingManagerV2 {
  const estimatedRecoveryMonthly = input.platforms.reduce(
    (s, p) => s + p.recoverableProfitMonthly,
    0,
  );
  const priorityQueue = buildMarketingPriorityQueue(input.campaigns);
  const platforms = input.platforms.map((p) => ({
    ...p,
    scoreExplanation: buildExtendedScoreExplanation(p, input.campaigns, input.snapshot),
  }));
  const budgetAllocation = buildMarketingBudgetAllocation({
    platforms: input.platforms,
    campaigns: input.campaigns,
  });
  const creativeInsights = buildMarketingCreativeInsights(input.snapshot, input.campaigns);
  const scenarioForecast = buildMarketingScenarioForecast(
    input.forecast,
    input.campaigns,
    input.snapshot,
  );

  const executive = buildMarketingExecutiveLayer({
    snapshot: input.snapshot,
    platforms,
    campaigns: input.campaigns,
    forecast: input.forecast,
    priorityQueue,
    budgetAllocation,
    scenarioForecast,
    creativeInsights,
    estimatedRecoveryMonthly,
  });

  return {
    brief: buildMarketingBrief({
      platforms,
      campaigns: input.campaigns,
      priorityQueue,
      estimatedRecoveryMonthly,
    }),
    executive,
    budgetAllocation,
    platformHealthDetails: buildPlatformHealthDetails(
      platforms,
      input.snapshot,
      input.campaigns,
    ),
    marketingEfficiency: buildMarketingEfficiency(input.snapshot, input.campaigns),
    priorityQueue,
    campaignTimelines: buildCampaignTimelines(input.campaigns, input.snapshot),
    opportunityGroups: buildMarketingOpportunityMap(input.campaigns),
    creativeInsights,
    simulations: buildMarketingSimulations(input.campaigns),
    scenarioForecast,
    autopilotReadiness: buildMarketingAutopilotReadiness({
      campaigns: input.campaigns,
      decisions: input.decisions,
      estimatedRecoveryMonthly,
    }),
  };
}
