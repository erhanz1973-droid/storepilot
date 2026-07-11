import type { BusinessGoal } from "@/lib/business-goals/types";
import type { DailyMetricPoint } from "@/lib/connectors/types";
import { formatRoas } from "./format-roas";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { Opportunity } from "@/lib/types";
import {
  breakEvenFromProfitPeriod,
  computeDynamicBreakEvenRoas,
  estimateBreakEvenRoas as legacyEstimateBreakEvenRoas,
  roasGapPct as computeRoasGapPct,
} from "./break-even-roas";
import {
  buildDecisionSignals,
  buildPreconditions,
  buildWhyNotForStrategy,
  computeStability,
  mapBusinessGoalToObjective,
  objectiveLabel,
  scoreAllStrategies,
  strategyShortLabel,
} from "./decision-context";
import { consolidateCampaignActions } from "./action-packages";
import { sortActionsByPriority, type PrioritizedActionCore, type UnrankedStrategyAction } from "./action-priority";
import type {
  ActionRiskLevel,
  AttributionBusinessObjective,
  AttributionSimulationCore,
  AttributionStrategyActionCore,
  AttributionStrategyId,
  AttributionStrategyPlan,
  AttributionStrategyPlanCore,
  SimulationScenario,
  StrategyAlternative,
} from "./decision-engine-types";
import type {
  AcquisitionMetrics,
  CampaignAttributionRow,
  ChannelAttributionRow,
  CreativeAttributionRow,
} from "./models";

export type {
  ActionRiskLevel,
  AttributionBusinessObjective,
  AttributionExecutiveSummary,
  AttributionHistoryEntry,
  AttributionSimulation,
  AttributionSimulationCore,
  AttributionStrategyAction,
  AttributionStrategyActionCore,
  AttributionStrategyId,
  AttributionStrategyPlan,
  AttributionStrategyPlanCore,
  ConfidenceBreakdown,
  CrossModuleImpact,
  DecisionPrecondition,
  ImpactVerificationStatus,
  LearningFeedback,
  RecommendationExpiration,
  RecommendationStability,
  StrategyAlternative,
} from "./decision-engine-types";

export type { BreakEvenRoasModel } from "./break-even-roas";
export { breakEvenFromProfitPeriod, computeDynamicBreakEvenRoas, roasGapPct } from "./break-even-roas";

/** @deprecated Use computeDynamicBreakEvenRoas */
export function estimateBreakEvenRoas(grossMarginRate: number): number | null {
  return legacyEstimateBreakEvenRoas(grossMarginRate);
}

export function resolveBreakEvenModel(
  profitDashboard: ProfitDashboard | null,
  grossMarginRate: number,
  targetProfitMarginPct?: number,
): import("./break-even-roas").BreakEvenRoasModel {
  if (profitDashboard?.primary) {
    const dynamic = breakEvenFromProfitPeriod(profitDashboard.primary, targetProfitMarginPct);
    if (dynamic) return dynamic;
  }
  const legacy = legacyEstimateBreakEvenRoas(grossMarginRate);
  if (legacy != null) {
    return {
      breakEvenRoas: legacy,
      grossMarginPct: Math.round(grossMarginRate * 1000) / 10,
      shippingPct: 0,
      feesPct: 0,
      refundPct: 0,
      targetProfitMarginPct: targetProfitMarginPct ?? 10,
      contributionMarginPct: Math.round(grossMarginRate * 1000) / 10,
      summary: `Break-even ROAS ${legacy.toFixed(2)} estimated from gross margin only — connect shipping, fees, and refunds for a dynamic model.`,
    };
  }
  return {
    breakEvenRoas: 1.85,
    grossMarginPct: 58,
    shippingPct: 0,
    feesPct: 0,
    refundPct: 0,
    targetProfitMarginPct: targetProfitMarginPct ?? 10,
    contributionMarginPct: 54,
    summary: "Break-even ROAS 1.85 (default estimate — connect profit data for a dynamic model).",
  };
}

export function enrichCampaignBreakEven(
  campaigns: CampaignAttributionRow[],
  breakEvenRoas: number | null,
): Array<CampaignAttributionRow & { breakEvenRoas: number | null; roasGapPct: number | null }> {
  return campaigns.map((c) => {
    const gap =
      breakEvenRoas != null && c.roas != null
        ? computeRoasGapPct(c.roas, breakEvenRoas)
        : null;
    return { ...c, breakEvenRoas, roasGapPct: gap };
  });
}

function campaignTone(name: string): "prospecting" | "retargeting" | "general" {
  const n = name.toLowerCase();
  if (n.includes("prospect")) return "prospecting";
  if (n.includes("retarget") || n.includes("remarket") || n.includes("warm")) {
    return "retargeting";
  }
  return "general";
}

function strategyLabel(id: AttributionStrategyId): string {
  const labels: Record<AttributionStrategyId, string> = {
    scale: "Scale Paid Acquisition",
    optimize: "Optimize Advertising",
    reallocate: "Reallocate Ad Budget",
    reduce_budget: "Reduce Ad Budget",
    pause: "Pause Underperforming Campaigns",
  };
  return labels[id];
}

function buildReasonSnippet(
  campaign: CampaignAttributionRow | undefined,
  breakEven: number,
  acquisition: AcquisitionMetrics,
): string {
  const parts: string[] = [];
  if (campaign && campaign.roas != null) {
    const gap = computeRoasGapPct(campaign.roas, breakEven);
    parts.push(
      `Current ROAS ${formatRoas(campaign.roas)} vs break-even ${formatRoas(breakEven)} (gap ${gap > 0 ? "-" : "+"}${Math.abs(gap)}%).`,
    );
  }
  if (acquisition.cac != null) {
    parts.push(
      `CAC $${acquisition.cac.toLocaleString()} must align with contribution margin to reach profitability.`,
    );
  }
  return parts.join(" ");
}

function actionRiskProfile(
  action: Pick<AttributionStrategyActionCore, "id" | "title" | "isLastResort">,
  strategy: AttributionStrategyId,
): Pick<
  AttributionStrategyActionCore,
  "riskLevel" | "expectedRevenueImpactPct" | "cashFlowImpact"
> {
  const title = action.title.toLowerCase();
  if (action.isLastResort || title.startsWith("pause ")) {
    return {
      riskLevel: "High",
      expectedRevenueImpactPct: strategy === "pause" ? -48 : -12,
      cashFlowImpact: "Positive",
    };
  }
  if (title.includes("reduce") && title.includes("budget")) {
    const match = title.match(/(\d+)%/);
    const pct = match ? Number(match[1]) : 25;
    return {
      riskLevel: pct >= 35 ? "Medium" : "Low",
      expectedRevenueImpactPct: -Math.round(pct * 0.2),
      cashFlowImpact: "Positive",
    };
  }
  if (title.includes("increase") && title.includes("budget")) {
    return {
      riskLevel: "Medium",
      expectedRevenueImpactPct: 8,
      cashFlowImpact: "Negative",
    };
  }
  if (title.includes("shift") || title.includes("reallocate") || title.includes("move budget")) {
    return {
      riskLevel: "Low",
      expectedRevenueImpactPct: 2,
      cashFlowImpact: "Neutral",
    };
  }
  return {
    riskLevel: "Low",
    expectedRevenueImpactPct: -2,
    cashFlowImpact: "Positive",
  };
}

function buildActionsForStrategy(input: {
  strategy: AttributionStrategyId;
  businessObjective: AttributionBusinessObjective;
  campaigns: CampaignAttributionRow[];
  channels: ChannelAttributionRow[];
  creatives: CreativeAttributionRow[];
  acquisition: AcquisitionMetrics;
  breakEvenRoas: number;
}): PrioritizedActionCore[] {
  const { strategy, businessObjective, campaigns, channels, creatives, acquisition, breakEvenRoas } = input;
  const breakEven = breakEvenRoas;
  const actions: UnrankedStrategyAction[] = [];
  const paid = campaigns.filter((c) => c.adSpend > 50);
  const prospecting = paid.filter((c) => campaignTone(c.campaignName) === "prospecting");
  const retargeting = paid.filter((c) => campaignTone(c.campaignName) === "retargeting");
  const worst = [...paid].sort((a, b) => a.netProfit - b.netProfit)[0];
  const best = [...paid]
    .filter((c) => c.netProfit > 0)
    .sort((a, b) => b.netProfit - a.netProfit)[0];
  const meta = channels.find((c) => c.channelId === "meta_ads");
  const google = channels.find((c) => c.channelId === "google_ads");
  const fatigued = creatives.find((c) => c.status === "fatigued");
  const winnerCreative = creatives.find((c) => c.status === "winning");

  const baseReason = buildReasonSnippet(worst, breakEven, acquisition);

  if (strategy === "scale" && best) {
    actions.push({
      id: `scale-${best.campaignId}`,
      title: `Increase ${best.campaignName} budget by 15–20%`,
      description: `${best.campaignName} exceeds break-even ROAS with positive net profit — scale while monitoring blended efficiency.`,
      reason: `ROAS ${formatRoas(best.roas)} vs break-even ${formatRoas(breakEven)}. Increase budget only while ROAS exceeds break-even.`,
      estimatedMonthlyImprovement: Math.round(best.netProfit * 0.35),
      confidencePct: 88,
      ...actionRiskProfile({ id: `scale-${best.campaignId}`, title: `Increase ${best.campaignName} budget by 15–20%` }, strategy),
    });
    if (winnerCreative) {
      actions.push({
        id: `dup-${winnerCreative.creativeId}`,
        title: `Duplicate winning creative — ${winnerCreative.creativeName}`,
        description: `CTR ${winnerCreative.ctr}% with strong ROAS — expand into new ad sets rather than raising bids alone.`,
        reason: "Creative is converting efficiently. Duplicate before increasing budget.",
        estimatedMonthlyImprovement: Math.round(winnerCreative.profit * 0.4),
        confidencePct: 81,
        riskLevel: "Low",
        expectedRevenueImpactPct: 4,
        cashFlowImpact: "Neutral",
      });
    }
  }

  if (strategy === "optimize" || strategy === "reduce_budget") {
    const prospect = prospecting[0] ?? worst;
    if (prospect) {
      const pct = strategy === "reduce_budget" ? 30 : 25;
      const title = `Reduce ${prospect.campaignName} budget by ${pct}%`;
      actions.push({
        id: `reduce-prospect-${prospect.campaignId}`,
        title,
        description:
          campaignTone(prospect.campaignName) === "prospecting"
            ? "Prospecting is below break-even ROAS. Trim budget and tighten targeting before pausing entirely."
            : `${prospect.campaignName} is below break-even. Reduce spend while testing improvements.`,
        reason: baseReason || `Acquisition costs exceed break-even ROAS ${breakEven.toFixed(2)}.`,
        estimatedMonthlyImprovement: Math.round(prospect.adSpend * (pct / 100) * 0.85),
        confidencePct: 91,
        ...actionRiskProfile({ id: `reduce-prospect-${prospect.campaignId}`, title }, strategy),
      });
    }

    const retarget = retargeting[0];
    if (retarget) {
      actions.push({
        id: `refresh-retarget-${retarget.campaignId}`,
        title: `Keep ${retarget.campaignName} active but refresh creatives`,
        description:
          "Retargeting is underperforming. Test new audiences or creatives before considering a pause.",
        reason: `Retargeting ROAS ${retarget.roas?.toFixed(2) ?? "—"} vs break-even ${breakEven.toFixed(2)}. Frequency and creative fatigue may be the issue.`,
        estimatedMonthlyImprovement: Math.round(Math.abs(retarget.netProfit) * 0.25 + 400),
        confidencePct: 82,
        riskLevel: "Low",
        expectedRevenueImpactPct: -3,
        cashFlowImpact: "Positive",
      });
    } else if (fatigued) {
      actions.push({
        id: `refresh-creative-${fatigued.creativeId}`,
        title: `Refresh fatigued creative — ${fatigued.creativeName}`,
        description: "Frequency is high. Refresh creative before reducing campaign budget further.",
        reason: `CTR ${fatigued.ctr}% suggests creative fatigue while ROAS remains below target.`,
        estimatedMonthlyImprovement: Math.round(fatigued.revenue * 0.08),
        confidencePct: 79,
        riskLevel: "Low",
        expectedRevenueImpactPct: -1,
        cashFlowImpact: "Neutral",
      });
    }

    if (
      google &&
      meta &&
      google.adSpend > 0 &&
      (google.profitRoas ?? 0) > (meta.profitRoas ?? 0)
    ) {
      actions.push({
        id: "shift-meta-to-google",
        title: "Shift 15% of Meta spend to Google Ads",
        description: `Google profit ROAS (${formatRoas(google.profitRoas)}) outperforms Meta (${formatRoas(meta.profitRoas)}). Reallocate rather than cut total acquisition.`,
        reason: "Cross-channel reallocation preserves acquisition volume while improving blended ROAS.",
        estimatedMonthlyImprovement: Math.round(meta.adSpend * 0.15 * 0.35),
        confidencePct: 74,
        riskLevel: "Low",
        expectedRevenueImpactPct: 2,
        cashFlowImpact: "Neutral",
      });
    }

    actions.push({
      id: "reduce-overlap",
      title: "Reduce audience overlap between campaigns",
      description: "Overlapping audiences inflate CAC. Consolidate or exclude audiences across ad sets.",
      reason:
        meta && meta.cac && acquisition.cac
          ? `Meta CAC $${meta.cac} exceeds store average $${acquisition.cac}.`
          : "High CAC often indicates audience overlap or broad targeting.",
      estimatedMonthlyImprovement: Math.round((meta?.adSpend ?? 500) * 0.08),
      confidencePct: 76,
      riskLevel: "Low",
      expectedRevenueImpactPct: -1,
      cashFlowImpact: "Positive",
    });

    if (worst && worst.netProfit < 0) {
      const title = `Pause only the lowest-performing ad sets in ${worst.campaignName}`;
      actions.push({
        id: `pause-adsets-${worst.campaignId}`,
        title,
        description:
          "Cut the worst ad sets instead of pausing the entire campaign to preserve learning and retargeting paths.",
        reason: `${worst.campaignName} is unprofitable — isolate underperformers first.`,
        estimatedMonthlyImprovement: Math.round(Math.abs(worst.netProfit) * 0.35),
        confidencePct: 88,
        isLastResort: true,
        ...actionRiskProfile({ id: `pause-adsets-${worst.campaignId}`, title, isLastResort: true }, strategy),
      });
    }
  }

  if (strategy === "reallocate" && best && worst) {
    actions.push({
      id: `reallocate-${worst.campaignId}-to-${best.campaignId}`,
      title: `Move budget from ${worst.campaignName} to ${best.campaignName}`,
      description: `Shift 20–30% of spend from ${worst.campaignName} (ROAS ${formatRoas(worst.roas)}) to ${best.campaignName} (${formatRoas(best.roas)}).`,
      reason: baseReason,
      estimatedMonthlyImprovement: Math.round(worst.adSpend * 0.25 * 0.7),
      confidencePct: 86,
      riskLevel: "Low",
      expectedRevenueImpactPct: 3,
      cashFlowImpact: "Neutral",
    });
    actions.push({
      id: `trim-${worst.campaignId}`,
      title: `Reduce ${worst.campaignName} budget by 25%`,
      description: "Gradually reduce the underperformer while scaling the winner — avoid a hard pause.",
      reason: "Reallocate spend toward campaigns above break-even ROAS.",
      estimatedMonthlyImprovement: Math.round(worst.adSpend * 0.25),
      confidencePct: 83,
      riskLevel: "Low",
      expectedRevenueImpactPct: -5,
      cashFlowImpact: "Positive",
    });
  }

  if (strategy === "pause") {
    if (worst) {
      const title = `Reduce ${worst.campaignName} budget by 40% first`;
      actions.push({
        id: `optimize-before-pause-${worst.campaignId}`,
        title,
        description: "Test a significant budget reduction before a full pause to preserve retargeting pools.",
        reason: baseReason,
        estimatedMonthlyImprovement: Math.round(worst.adSpend * 0.35),
        confidencePct: 84,
        ...actionRiskProfile({ id: `optimize-before-pause-${worst.campaignId}`, title }, strategy),
      });
    }
    for (const c of paid.filter((x) => x.netProfit < 0).slice(0, 2)) {
      const title = `Pause ${c.campaignName} (last resort)`;
      actions.push({
        id: `pause-${c.campaignId}`,
        title,
        description: `${c.campaignName} has sustained negative profit with ROAS ${c.roas?.toFixed(2) ?? "—"} vs break-even ${breakEven.toFixed(2)}.`,
        reason: "Use only if budget reductions and creative tests fail to improve within 30 days.",
        estimatedMonthlyImprovement: Math.round(Math.abs(c.netProfit) + c.adSpend * 0.15),
        confidencePct: 72,
        isLastResort: true,
        ...actionRiskProfile({ id: `pause-${c.campaignId}`, title, isLastResort: true }, strategy),
      });
    }
  }

  const underperformingCreative = creatives.find(
    (c) => c.status === "underperforming" && c.ctr >= 1 && (c.roas ?? 0) < breakEven,
  );
  if (underperformingCreative && (strategy === "optimize" || strategy === "reduce_budget")) {
    actions.push({
      id: `landing-${underperformingCreative.creativeId}`,
      title: `Test a new landing page for ${underperformingCreative.creativeName}`,
      description: "CTR is acceptable but ROAS is poor — the landing page or offer may be the bottleneck.",
      reason: `CTR ${underperformingCreative.ctr}% with ROAS ${formatRoas(underperformingCreative.roas)} suggests post-click conversion issues.`,
      estimatedMonthlyImprovement: Math.round(underperformingCreative.spend * 0.2),
      confidencePct: 77,
      riskLevel: "Low",
      expectedRevenueImpactPct: 3,
      cashFlowImpact: "Neutral",
    });
  }

  return sortActionsByPriority(
    consolidateCampaignActions(actions, campaigns),
    strategy,
    businessObjective,
  );
}

function buildSimulation(signals: ReturnType<typeof buildDecisionSignals>): AttributionSimulationCore {
  const spend = signals.totalSpend;
  const roas = signals.avgRoas ?? 0.6;
  const contribution = signals.breakEven.contributionMarginPct / 100;
  const revenue = spend * roas;
  const currentProfit = revenue * contribution - spend;
  const breakEven = signals.breakEven.breakEvenRoas;

  function scenario(
    id: string,
    label: string,
    newSpend: number,
    newRevenue: number,
    opts: {
      probability: SimulationScenario["probability"];
      expectedTime: string;
      revenueSpread?: number;
      profitSpread?: number;
    },
  ): SimulationScenario {
    const newProfit = newRevenue * contribution - newSpend;
    const profitDelta = Math.round(newProfit - currentProfit);
    const revenueDeltaPct =
      revenue > 0 ? Math.round(((newRevenue - revenue) / revenue) * 100) : 0;
    const revSpread = opts.revenueSpread ?? Math.max(5, Math.round(Math.abs(revenueDeltaPct) * 0.25));
    const profitSpread = opts.profitSpread ?? Math.max(200, Math.round(Math.abs(profitDelta) * 0.2));

    return {
      id,
      label,
      profitDeltaLow: Math.min(profitDelta - profitSpread, profitDelta + profitSpread),
      profitDeltaHigh: Math.max(profitDelta - profitSpread, profitDelta + profitSpread),
      revenueDeltaPctLow: Math.min(revenueDeltaPct - revSpread, revenueDeltaPct + revSpread),
      revenueDeltaPctHigh: Math.max(revenueDeltaPct - revSpread, revenueDeltaPct + revSpread),
      probability: opts.probability,
      expectedTime: opts.expectedTime,
    };
  }

  const targetRoas = Math.min(Math.max(roas, 1), breakEven);

  return {
    scope: signals.scope,
    currentSpend: Math.round(spend),
    currentRoas: roas,
    breakEvenRoas: breakEven,
    scenarios: [
      scenario("reduce-20", "Reduce spend ~20%", spend * 0.8, revenue * 0.95, {
        probability: "High",
        expectedTime: "7–14 days",
      }),
      scenario("reduce-40", "Reduce spend ~40%", spend * 0.6, revenue * 0.88, {
        probability: "Medium",
        expectedTime: "14–30 days",
      }),
      scenario("roas-be", "Improve ROAS toward break-even", spend, spend * targetRoas, {
        probability: "Medium",
        expectedTime: "30–60 days",
        revenueSpread: Math.max(
          8,
          Math.round(Math.abs(targetRoas / Math.max(roas, 0.01) - 1) * 50),
        ),
      }),
      scenario("pause", "Pause paid campaigns", 0, revenue * 0.52, {
        probability: "Low",
        expectedTime: "Immediate",
        revenueSpread: 12,
      }),
    ],
  };
}

function strategySuccessProbability(
  strategy: AttributionStrategyId,
  signals: ReturnType<typeof buildDecisionSignals>,
): number {
  const be = signals.breakEven.breakEvenRoas;
  const avg = signals.avgRoas ?? 0;
  if (strategy === "scale") return avg >= be ? 78 : 18;
  if (strategy === "optimize") return 62;
  if (strategy === "reallocate") return signals.hasWinnerLoser ? 55 : 32;
  if (strategy === "reduce_budget") return 48;
  return 22;
}

function strategyPotentialDownside(
  strategy: AttributionStrategyId,
  signals: ReturnType<typeof buildDecisionSignals>,
): string {
  if (strategy === "scale") return "Increase advertising losses if ROAS deteriorates.";
  if (strategy === "reduce_budget") return "Expected revenue loss of 3–8% during rebalancing.";
  if (strategy === "pause") return "Customer acquisition stops; assisted revenue may decline.";
  if (strategy === "reallocate") return "Short-term learning-phase disruption on shifted campaigns.";
  return "Opportunity cost if efficiency gains take longer than forecast.";
}

function buildStrategyAlternatives(
  scores: ReturnType<typeof scoreAllStrategies>,
  selected: AttributionStrategyId,
  signals: ReturnType<typeof buildDecisionSignals>,
  objective: AttributionBusinessObjective,
): StrategyAlternative[] {
  return scores.map((entry) => ({
    strategy: entry.strategy,
    label: strategyShortLabel(entry.strategy),
    score: entry.score,
    selected: entry.strategy === selected,
    reason: entry.strategy === selected
      ? "Selected based on performance signals and business objective."
      : entry.reason,
    whyNot: buildWhyNotForStrategy(entry.strategy, signals, selected, objective),
    successProbabilityPct:
      entry.strategy === selected ? undefined : strategySuccessProbability(entry.strategy, signals),
    potentialDownside:
      entry.strategy === selected ? undefined : strategyPotentialDownside(entry.strategy, signals),
  }));
}

function buildStrategyReason(
  strategy: AttributionStrategyId,
  signals: ReturnType<typeof buildDecisionSignals>,
): string {
  const be = signals.breakEven.breakEvenRoas;
  switch (strategy) {
    case "scale":
      return `${signals.scope} is profitable with ROAS at or above break-even (${formatRoas(be)}). Scale while monitoring efficiency.`;
    case "reallocate":
      return `${signals.scope} has winners and losers — shift budget toward campaigns above break-even ROAS (${formatRoas(be)}).`;
    case "reduce_budget":
      return `${signals.scope} is generating revenue but acquisition costs exceed break-even ROAS (${formatRoas(be)}). Reduce spend while improving efficiency.`;
    case "pause":
      return `${signals.scope} shows sustained losses below break-even (${formatRoas(be)}). Pause only after optimization options are exhausted.`;
    default:
      return `${signals.scope} is generating revenue but acquisition costs exceed break-even ROAS (${formatRoas(be)}). Optimize before pausing entirely.`;
  }
}

export function buildAttributionStrategyPlan(input: {
  channels: ChannelAttributionRow[];
  campaigns: CampaignAttributionRow[];
  creatives: CreativeAttributionRow[];
  acquisition: AcquisitionMetrics;
  profitDashboard?: ProfitDashboard | null;
  grossMarginRate?: number;
  businessGoal?: BusinessGoal;
  merchantMode?: string;
  dailyMetrics?: DailyMetricPoint[];
  targetProfitMarginPct?: number;
}): AttributionStrategyPlanCore {
  const grossMarginRate = input.grossMarginRate ?? 0.58;
  const breakEvenModel = resolveBreakEvenModel(
    input.profitDashboard ?? null,
    grossMarginRate,
    input.targetProfitMarginPct,
  );

  const netProfit =
    input.channels.reduce((s, c) => s + c.attributedProfit, 0) ||
    input.profitDashboard?.primary.netProfit ||
    0;
  const storeRevenue =
    input.channels.reduce((s, c) => s + c.attributedRevenue, 0) ||
    input.profitDashboard?.primary.revenue ||
    0;

  const signals = buildDecisionSignals({
    channels: input.channels,
    campaigns: input.campaigns,
    acquisition: input.acquisition,
    breakEven: breakEvenModel,
    netProfit,
    storeRevenue,
    dailyMetrics: input.dailyMetrics,
  });

  const businessGoal = input.businessGoal ?? "increase_profit";
  const businessObjective = mapBusinessGoalToObjective(businessGoal, input.merchantMode);
  const scores = scoreAllStrategies(signals, businessObjective);
  const winner = scores[0]!;
  const strategy = winner.strategy;
  const confidencePct = Math.min(95, Math.max(72, winner.score - 6));

  const actions = buildActionsForStrategy({
    strategy,
    businessObjective,
    campaigns: input.campaigns,
    channels: input.channels,
    creatives: input.creatives,
    acquisition: input.acquisition,
    breakEvenRoas: breakEvenModel.breakEvenRoas,
  });

  const stability = computeStability(input.dailyMetrics, confidencePct);

  return {
    strategy,
    strategyLabel: strategyLabel(strategy),
    targetScope: signals.scope,
    confidencePct,
    reason: buildStrategyReason(strategy, signals),
    preconditions: buildPreconditions(signals),
    strategyAlternatives: buildStrategyAlternatives(scores, strategy, signals, businessObjective),
    breakEvenModel,
    businessObjective,
    businessObjectiveLabel: objectiveLabel(businessObjective, businessGoal),
    simulation: buildSimulation(signals),
    stability,
    actions,
    metricsSummary: {
      netProfit: signals.netProfit,
      cacGapPct: signals.cacGapPct,
      roasGapPct: signals.roasGapPct,
      totalSpend: signals.totalSpend,
    },
  };
}

export function strategyPlanToOpportunities(
  plan: AttributionStrategyPlan,
  netMarginPct?: number,
): Opportunity[] {
  return plan.actions.map((action) => {
    const margin = netMarginPct ?? plan.breakEvenModel.contributionMarginPct / 100;
    const profitImpact = action.estimatedMonthlyImprovement;
    const revenueImpact =
      margin > 0 ? Math.round(profitImpact / margin) : Math.round(profitImpact / 0.38);
    return {
      id: action.id,
      category: "marketing_attribution",
      title: action.title,
      description: `${action.description} ${action.reason}`,
      estimatedMonthlyRevenueImpact: revenueImpact,
      estimatedMonthlyNetProfitImpact: profitImpact,
      confidenceScore: action.confidencePct / 100,
      evidence: [
        { label: "Strategy", value: plan.strategyLabel },
        { label: "Confidence", value: `${action.confidencePct}%` },
        { label: "Risk", value: action.riskLevel },
        { label: "Break-even ROAS", value: formatRoas(plan.breakEvenModel.breakEvenRoas) },
        { label: "Priority Score", value: `${action.priorityScore ?? "—"} / 100` },
      ],
      requiredActions: [action.description],
      implementationEffort: action.isLastResort ? "Low" : "Medium",
      adEfficiencyAction: action.isLastResort ? "pause_campaign" : "reduce_budget",
    };
  });
}

export function buildCreativeInsight(
  creative: CreativeAttributionRow,
  breakEvenRoas: number | null,
  strategy: AttributionStrategyId,
): string {
  const breakEven = breakEvenRoas ?? 1.85;
  if (creative.status === "fatigued") {
    return `Frequency is high and CTR is ${creative.ctr}%. Refresh creative before ROAS declines further.`;
  }
  if (creative.status === "winning") {
    return `ROAS ${creative.roas?.toFixed(2) ?? "—"} exceeds break-even. Duplicate into new ad sets${strategy === "scale" ? " and consider a modest budget increase" : ""}.`;
  }
  if (creative.ctr >= 1 && (creative.roas ?? 0) < breakEven) {
    return "CTR is acceptable but ROAS is poor. Test a new landing page or offer.";
  }
  if ((creative.roas ?? 0) < breakEven && creative.profit < 0) {
    if (strategy === "pause") {
      return `ROAS ${creative.roas?.toFixed(2) ?? "—"} is below break-even ${breakEven.toFixed(2)}. Pause only after budget and creative tests fail.`;
    }
    const gap = Math.abs(computeRoasGapPct(creative.roas ?? 0, breakEven));
    return `CAC exceeds break-even by ${gap}%. Improve targeting or refresh creative — avoid pausing the full campaign.`;
  }
  return "Monitor performance weekly and align spend with break-even ROAS.";
}
