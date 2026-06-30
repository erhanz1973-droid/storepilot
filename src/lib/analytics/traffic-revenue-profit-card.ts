import type { ChannelProfitBreakdown } from "@/lib/analytics/traffic-channel-economics";
import {
  breakdownWithPercentages,
  enrichChannelProfitabilityCard,
  profitabilityTierFromMargin,
  type ChannelProfitabilityCard,
  type ChannelBreakdownLine,
} from "@/lib/analytics/channel-profitability-card";
import type { ProfitDashboard } from "@/lib/profit/types";
import { estimateBreakEvenRoas } from "@/lib/profit/profit-recommendations";

export type TrafficUrgencyStatus =
  | "immediate_action"
  | "monitor_closely"
  | "optimize"
  | "scale"
  | "healthy";

export type TrafficChannelBenchmark = {
  trafficSharePct: number;
  revenueSharePct: number;
  profitSharePct: number;
  insight: string;
};

export type TrafficRevenueProfitCard = ChannelProfitabilityCard & {
  profitStatus: "profitable" | "break_even" | "losing" | "unknown";
  urgencyStatus: TrafficUrgencyStatus;
  urgencyLabel: string;
  breakEvenRoas: number | null;
  primaryDriver: string;
  opportunityText: string | null;
  potentialRecoveryMonthly: number;
  recommendationConfidencePct: number;
  trafficBenchmark: TrafficChannelBenchmark;
  flowInsight: string;
};

function round(n: number, digits = 1): number {
  const m = 10 ** digits;
  return Math.round(n * m) / m;
}

function trafficTierLabel(marginPct: number, netContribution: number): {
  tierLabel: string;
  tierEmoji: string;
} {
  if (netContribution < 0 || marginPct < 0) {
    return { tierLabel: "Unprofitable", tierEmoji: "🔴" };
  }
  if (marginPct < 8) {
    return { tierLabel: "Break Even", tierEmoji: "🟡" };
  }
  if (marginPct >= 60) {
    return { tierLabel: "Highly Profitable", tierEmoji: "🟢" };
  }
  return { tierLabel: "Profitable", tierEmoji: "🟢" };
}

function urgencyFromInput(input: {
  marginPct: number;
  netContribution: number;
  isPaid: boolean;
  roas: number | null;
  breakEvenRoas: number | null;
}): { status: TrafficUrgencyStatus; label: string } {
  if (input.netContribution < -500 || input.marginPct < -30) {
    return { status: "immediate_action", label: "Immediate Action Required" };
  }
  if (input.netContribution < 0 || (input.isPaid && input.roas != null && input.breakEvenRoas != null && input.roas < input.breakEvenRoas * 0.85)) {
    return { status: "monitor_closely", label: "Immediate Action Required" };
  }
  if (input.marginPct < 15 && input.isPaid) {
    return { status: "optimize", label: "Optimization Needed" };
  }
  if (input.marginPct >= 40) {
    return { status: "scale", label: "Ready to Scale" };
  }
  if (input.marginPct >= 8) {
    return { status: "healthy", label: "Performing Well" };
  }
  return { status: "optimize", label: "Monitor Weekly" };
}

function detectPrimaryDriver(breakdown: ChannelProfitBreakdown): string {
  const costs = [
    { label: "Advertising Cost", value: breakdown.advertisingCost },
    { label: "COGS", value: breakdown.cogs },
    { label: "Shipping", value: breakdown.shipping },
    { label: "Payment Fees", value: breakdown.paymentFees },
  ];
  return costs.sort((a, b) => b.value - a.value)[0]?.label ?? "Variable Costs";
}

function buildTrafficBenchmark(input: {
  sessions: number;
  revenue: number;
  netContribution: number;
  storeSessions: number;
  storeRevenue: number;
  storeNetContribution: number;
}): TrafficChannelBenchmark {
  const trafficSharePct =
    input.storeSessions > 0
      ? round((input.sessions / input.storeSessions) * 100, 1)
      : 0;
  const revenueSharePct =
    input.storeRevenue > 0
      ? round((input.revenue / input.storeRevenue) * 100, 1)
      : 0;
  const profitSharePct =
    input.storeNetContribution !== 0
      ? round((input.netContribution / input.storeNetContribution) * 100, 1)
      : input.netContribution < 0
        ? -100
        : revenueSharePct;

  let insight = "This channel's contribution is proportional to its traffic share.";
  const profitVsRevenue = profitSharePct - revenueSharePct;
  if (profitSharePct < 0 && revenueSharePct > 20) {
    insight =
      "This channel drives revenue but destroys profitability — acquisition costs exceed contribution.";
  } else if (profitVsRevenue >= 10) {
    insight =
      "This channel contributes disproportionately more profit than its share of traffic.";
  } else if (profitVsRevenue <= -15) {
    insight =
      "This channel generates traffic and revenue but a smaller share of profit — review costs and conversion.";
  }

  return { trafficSharePct, revenueSharePct, profitSharePct, insight };
}

function buildTrafficAiInsight(input: {
  channelLabel: string;
  isPaid: boolean;
  breakdown: ChannelProfitBreakdown;
  marginPct: number;
  primaryDriver: string;
  benchmark: TrafficChannelBenchmark;
}): string {
  const { breakdown, channelLabel, isPaid, marginPct, primaryDriver, benchmark } = input;
  const rev = breakdown.revenue;

  if (isPaid && marginPct < 0) {
    const adPct = rev > 0 ? round((breakdown.advertisingCost / rev) * 100, 1) : 0;
    return `${channelLabel} advertising generated strong revenue but acquisition costs exceeded gross contribution. ${primaryDriver} represents more than ${adPct}% of revenue, resulting in a significant negative contribution margin.`;
  }

  if (isPaid && marginPct < 15) {
    return `${channelLabel} converts traffic to revenue, but paid acquisition is compressing margin. Focus on campaigns above break-even ROAS before scaling spend.`;
  }

  if (!isPaid && marginPct >= 40) {
    return `${channelLabel} traffic generated exceptional profitability because there were no acquisition costs. Continue investing in retention and owned channels to grow this high-margin revenue.`;
  }

  if (benchmark.profitSharePct > benchmark.revenueSharePct + 10) {
    return `${channelLabel} punches above its weight — it contributes more profit than its share of store traffic suggests. Protect what's working.`;
  }

  if (benchmark.profitSharePct < 0) {
    return `Although ${channelLabel} brings meaningful revenue, the channel is unprofitable after costs. ${primaryDriver} is the primary drag on contribution margin.`;
  }

  return `${channelLabel} is converting traffic to revenue at acceptable margins. Monitor weekly to catch efficiency drift early.`;
}

function buildFlowInsight(input: {
  sessions: number;
  revenue: number;
  netContribution: number;
  marginPct: number;
  isPaid: boolean;
}): string {
  if (input.revenue > 0 && input.netContribution < 0) {
    return "Although revenue is high, the business is losing money on this channel.";
  }
  if (input.sessions > 0 && input.revenue <= 0) {
    return "This channel brings traffic but is not converting to meaningful revenue.";
  }
  if (input.revenue > 0 && input.netContribution >= 0 && input.marginPct >= 25) {
    return "Traffic is converting efficiently into profitable revenue.";
  }
  if (input.isPaid && input.marginPct < 10) {
    return "Revenue is growing, but acquisition costs are consuming the margin.";
  }
  return "Traffic is converting to revenue — review contribution margin before scaling.";
}

function buildOpportunityText(input: {
  netContribution: number;
  breakEvenRoas: number | null;
  roas: number | null;
  isPaid: boolean;
  channelLabel: string;
}): string | null {
  if (input.netContribution >= 0 || !input.isPaid) return null;
  const recovery = Math.round(Math.abs(input.netContribution));
  if (recovery < 100) return null;

  const be = input.breakEvenRoas != null ? input.breakEvenRoas.toFixed(2) : "break-even";
  return `If advertising efficiency reaches break-even ROAS (${be}), this channel could recover approximately $${recovery.toLocaleString()} in monthly contribution.`;
}

function buildTrafficRecommendation(input: {
  channelLabel: string;
  isPaid: boolean;
  marginPct: number;
  netContribution: number;
  existingRecommendation?: string;
  recommendationActions?: string[];
}): string {
  if (input.existingRecommendation && input.existingRecommendation.length > 15) {
    return input.existingRecommendation;
  }
  if (input.isPaid && input.netContribution < 0) {
    return `Pause or reduce the lowest-performing Prospecting campaigns and shift budget toward campaigns consistently above break-even ROAS.`;
  }
  if (input.isPaid && input.marginPct < 20) {
    return `Reduce spend on the lowest-performing campaigns and reallocate budget to profitable traffic sources.`;
  }
  if (input.recommendationActions?.length) {
    return input.recommendationActions[0];
  }
  return `Review ${input.channelLabel} conversion path and reallocate spend toward highest-margin sources.`;
}

function profitStatusFromNet(net: number): TrafficRevenueProfitCard["profitStatus"] {
  if (net > 50) return "profitable";
  if (net >= -50) return "break_even";
  return "losing";
}

/** Breakdown lines formatted for traffic flow display (cost labels, signed amounts). */
export function trafficBreakdownLines(
  breakdown: ChannelProfitBreakdown,
): ChannelBreakdownLine[] {
  const base = breakdownWithPercentages(breakdown);
  return base.map((line) => {
    if (line.id === "revenue") {
      return { ...line, label: "Revenue" };
    }
    if (line.id === "advertising") {
      return { ...line, label: "Advertising Cost" };
    }
    if (line.id === "net") {
      return { ...line, label: "Estimated Net Contribution" };
    }
    return line;
  });
}

export function enrichTrafficRevenueProfitCard(input: {
  base: ChannelProfitabilityCard;
  profitBreakdown: ChannelProfitBreakdown;
  isPaid: boolean;
  profitDashboard: ProfitDashboard | null | undefined;
  storeSessions: number;
  storeRevenue: number;
  storeNetContribution: number;
  existingRecommendation?: string;
  recommendationActions?: string[];
  recoveryProbabilityPct?: number;
  estimatedRecoveryMonthly?: number;
}): TrafficRevenueProfitCard {
  const { base, profitBreakdown } = input;
  const marginPct = base.contributionMarginPct;
  const breakEvenRoas = input.profitDashboard
    ? estimateBreakEvenRoas(input.profitDashboard)
    : null;

  const trafficTier = trafficTierLabel(marginPct, base.netContribution);
  const urgency = urgencyFromInput({
    marginPct,
    netContribution: base.netContribution,
    isPaid: input.isPaid,
    roas: base.roas,
    breakEvenRoas,
  });
  const primaryDriver = detectPrimaryDriver(profitBreakdown);
  const trafficBenchmark = buildTrafficBenchmark({
    sessions: base.sessions,
    revenue: base.revenue,
    netContribution: base.netContribution,
    storeSessions: input.storeSessions,
    storeRevenue: input.storeRevenue,
    storeNetContribution: input.storeNetContribution,
  });

  const potentialRecovery =
    input.estimatedRecoveryMonthly && input.estimatedRecoveryMonthly > 0
      ? Math.round(input.estimatedRecoveryMonthly)
      : base.netContribution < 0
        ? Math.round(Math.abs(base.netContribution))
        : base.expectedImpactMonthly;

  const tierBase = profitabilityTierFromMargin(marginPct, base.netContribution);

  return {
    ...base,
    tier: tierBase.tier,
    tierLabel: trafficTier.tierLabel,
    tierEmoji: trafficTier.tierEmoji,
    breakdown: trafficBreakdownLines(profitBreakdown),
    aiInsight: buildTrafficAiInsight({
      channelLabel: base.channelLabel,
      isPaid: input.isPaid,
      breakdown: profitBreakdown,
      marginPct,
      primaryDriver,
      benchmark: trafficBenchmark,
    }),
    benchmark: {
      revenueSharePct: trafficBenchmark.revenueSharePct,
      profitSharePct: trafficBenchmark.profitSharePct,
      insight: trafficBenchmark.insight,
    },
    recommendedAction: buildTrafficRecommendation({
      channelLabel: base.channelLabel,
      isPaid: input.isPaid,
      marginPct,
      netContribution: base.netContribution,
      existingRecommendation: input.existingRecommendation,
      recommendationActions: input.recommendationActions,
    }),
    expectedImpactMonthly: potentialRecovery,
    profitStatus: profitStatusFromNet(base.netContribution),
    urgencyStatus: urgency.status,
    urgencyLabel: urgency.label,
    breakEvenRoas: breakEvenRoas != null ? round(breakEvenRoas, 2) : null,
    primaryDriver,
    opportunityText: buildOpportunityText({
      netContribution: base.netContribution,
      breakEvenRoas,
      roas: base.roas,
      isPaid: input.isPaid,
      channelLabel: base.channelLabel,
    }),
    potentialRecoveryMonthly: potentialRecovery,
    recommendationConfidencePct: input.recoveryProbabilityPct ?? 75,
    trafficBenchmark,
    flowInsight: buildFlowInsight({
      sessions: base.sessions,
      revenue: base.revenue,
      netContribution: base.netContribution,
      marginPct,
      isPaid: input.isPaid,
    }),
  };
}

export function buildTrafficRevenueProfitCard(input: {
  channelId: string;
  channelLabel: string;
  sessions: number;
  revenue: number;
  orders: number;
  aov: number;
  isPaid: boolean;
  connected: boolean;
  profitBreakdown: ChannelProfitBreakdown | null;
  profitDashboard: ProfitDashboard | null | undefined;
  storeTotals: {
    revenue: number;
    netContribution: number;
    sessions: number;
  };
  adSpend: number;
  roas: number | null;
  isHighestMargin?: boolean;
  existingRecommendation?: string;
  recommendationActions?: string[];
  recoveryProbabilityPct?: number;
  estimatedRecoveryMonthly?: number;
  trends?: ChannelProfitabilityCard["trends"];
}): TrafficRevenueProfitCard | null {
  const base = enrichChannelProfitabilityCard({
    channelId: input.channelId,
    channelLabel: input.channelLabel,
    sessions: input.sessions,
    revenue: input.revenue,
    orders: input.orders,
    aov: input.aov,
    isPaid: input.isPaid,
    connected: input.connected,
    profitBreakdown: input.profitBreakdown,
    storeTotals: input.storeTotals,
    trends: input.trends,
    adSpend: input.adSpend,
    roas: input.roas,
    isHighestMargin: input.isHighestMargin,
    existingRecommendation: input.existingRecommendation,
    existingImpactMonthly: input.estimatedRecoveryMonthly,
  });

  if (!base || !input.profitBreakdown) return null;

  return enrichTrafficRevenueProfitCard({
    base,
    profitBreakdown: input.profitBreakdown,
    isPaid: input.isPaid,
    profitDashboard: input.profitDashboard,
    storeSessions: input.storeTotals.sessions,
    storeRevenue: input.storeTotals.revenue,
    storeNetContribution: input.storeTotals.netContribution,
    existingRecommendation: input.existingRecommendation,
    recommendationActions: input.recommendationActions,
    recoveryProbabilityPct: input.recoveryProbabilityPct,
    estimatedRecoveryMonthly: input.estimatedRecoveryMonthly,
  });
}
