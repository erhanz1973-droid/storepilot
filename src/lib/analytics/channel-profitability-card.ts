import type { DailyMetricPoint } from "@/lib/connectors/types";
import {
  buildChannelProfitBreakdown,
  type ChannelProfitBreakdown,
} from "@/lib/analytics/traffic-channel-economics";
import type { ProfitDashboard } from "@/lib/profit/types";

export type ProfitabilityTier =
  | "highly_profitable"
  | "profitable"
  | "break_even"
  | "unprofitable"
  | "losing";

export type ChannelBreakdownLine = {
  id: string;
  label: string;
  amount: number;
  pctOfRevenue: number;
  sign: "+" | "-";
};

export type ChannelProfitTrend = {
  revenuePct: number | null;
  profitPct: number | null;
  trafficPct: number | null;
};

export type ChannelBenchmark = {
  revenueSharePct: number;
  profitSharePct: number;
  insight: string;
};

export type ChannelProfitabilityCard = {
  channelId: string;
  channelLabel: string;
  tier: ProfitabilityTier;
  tierLabel: string;
  tierEmoji: string;
  contributionMarginPct: number;
  revenue: number;
  netContribution: number;
  orders: number;
  aov: number;
  sessions: number;
  summaryLine: string;
  narrative: string;
  breakdown: ChannelBreakdownLine[];
  aiInsight: string;
  trends: ChannelProfitTrend;
  benchmark: ChannelBenchmark;
  recommendedAction: string;
  expectedImpactMonthly: number;
  connected: boolean;
  adSpend: number;
  roas: number | null;
};

function round(n: number, digits = 1): number {
  const m = 10 ** digits;
  return Math.round(n * m) / m;
}

function pctOfRevenue(amount: number, revenue: number): number {
  if (revenue <= 0) return 0;
  return round((amount / revenue) * 100, 1);
}

export function profitabilityTierFromMargin(
  marginPct: number,
  netContribution: number,
): { tier: ProfitabilityTier; tierLabel: string; tierEmoji: string } {
  if (netContribution < -50 || marginPct < -5) {
    return { tier: "losing", tierLabel: "Losing Money", tierEmoji: "🔴" };
  }
  if (netContribution < 0 || marginPct < 0) {
    return { tier: "unprofitable", tierLabel: "Unprofitable", tierEmoji: "🟠" };
  }
  if (marginPct < 8) {
    return { tier: "break_even", tierLabel: "Break Even", tierEmoji: "🟡" };
  }
  if (marginPct >= 60) {
    return { tier: "highly_profitable", tierLabel: "Highly Profitable", tierEmoji: "🟢" };
  }
  return { tier: "profitable", tierLabel: "Profitable", tierEmoji: "🟢" };
}

export function breakdownWithPercentages(
  breakdown: ChannelProfitBreakdown,
): ChannelBreakdownLine[] {
  const rev = breakdown.revenue;
  return [
    { id: "revenue", label: "Revenue", amount: breakdown.revenue, pctOfRevenue: 100, sign: "+" },
    {
      id: "advertising",
      label: "Advertising",
      amount: breakdown.advertisingCost,
      pctOfRevenue: pctOfRevenue(breakdown.advertisingCost, rev),
      sign: "-",
    },
    {
      id: "cogs",
      label: "COGS",
      amount: breakdown.cogs,
      pctOfRevenue: pctOfRevenue(breakdown.cogs, rev),
      sign: "-",
    },
    {
      id: "shipping",
      label: "Shipping",
      amount: breakdown.shipping,
      pctOfRevenue: pctOfRevenue(breakdown.shipping, rev),
      sign: "-",
    },
    {
      id: "fees",
      label: "Payment Fees",
      amount: breakdown.paymentFees,
      pctOfRevenue: pctOfRevenue(breakdown.paymentFees, rev),
      sign: "-",
    },
    {
      id: "net",
      label: "Net Contribution",
      amount: breakdown.netContribution,
      pctOfRevenue: pctOfRevenue(breakdown.netContribution, rev),
      sign: "+",
    },
  ];
}

export function buildChannelBenchmark(input: {
  channelRevenue: number;
  channelNetContribution: number;
  storeRevenue: number;
  storeNetContribution: number;
}): ChannelBenchmark {
  const revenueSharePct =
    input.storeRevenue > 0
      ? round((input.channelRevenue / input.storeRevenue) * 100, 1)
      : 0;
  const profitSharePct =
    input.storeNetContribution > 0
      ? round((Math.max(0, input.channelNetContribution) / input.storeNetContribution) * 100, 1)
      : input.channelNetContribution < 0
        ? 0
        : revenueSharePct;

  let insight = "Profit contribution is proportional to this channel's revenue share.";
  const diff = profitSharePct - revenueSharePct;
  if (diff >= 8) {
    insight =
      "This channel contributes disproportionately more profit than revenue.";
  } else if (diff <= -8) {
    insight =
      "This channel generates revenue but a smaller share of profit — review acquisition costs and conversion.";
  }

  return { revenueSharePct, profitSharePct, insight };
}

function periodChangePct(current: number, previous: number): number | null {
  if (previous <= 0) {
    if (current > 0) return 100;
    return current === 0 ? 0 : null;
  }
  return round(((current - previous) / previous) * 100, 0);
}

/** Estimate channel trends from store daily metrics when channel history is unavailable. */
export function estimateChannelTrends(input: {
  dailyMetrics: DailyMetricPoint[] | undefined;
  channelRevenueShare: number;
  days?: number;
}): ChannelProfitTrend {
  const metrics = input.dailyMetrics ?? [];
  const days = input.days ?? 15;
  if (metrics.length < days * 2) {
    return { revenuePct: null, profitPct: null, trafficPct: null };
  }

  const current = metrics.slice(-days);
  const previous = metrics.slice(-days * 2, -days);

  const curRev = current.reduce((s, p) => s + p.revenue, 0);
  const prevRev = previous.reduce((s, p) => s + p.revenue, 0);
  const curOrders = current.reduce((s, p) => s + p.orders, 0);
  const prevOrders = previous.reduce((s, p) => s + p.orders, 0);
  const curSessions = current.reduce((s, p) => s + (p.sessions ?? p.orders * 3), 0);
  const prevSessions = previous.reduce((s, p) => s + (p.sessions ?? p.orders * 3), 0);

  const storeRevChange = periodChangePct(curRev, prevRev);
  const storeOrderChange = periodChangePct(curOrders, prevOrders);
  const storeSessionChange = periodChangePct(curSessions, prevSessions);

  const estimateProfitChange = (): number | null => {
    if (storeRevChange == null) return null;
    const curAd = current.reduce((s, p) => s + p.adSpend, 0);
    const prevAd = previous.reduce((s, p) => s + p.adSpend, 0);
    const curNet = curRev - curAd;
    const prevNet = prevRev - prevAd;
    return periodChangePct(curNet, prevNet);
  };

  return {
    revenuePct: storeRevChange,
    profitPct: estimateProfitChange(),
    trafficPct: storeSessionChange ?? storeOrderChange,
  };
}

function channelSummaryLine(input: {
  adSpend: number;
  isPaid: boolean;
  marginPct: number;
}): string {
  if (input.adSpend <= 0 && !input.isPaid) return "No advertising cost.";
  if (input.adSpend > 0 && input.marginPct < 10) {
    return "Advertising costs are compressing contribution margin.";
  }
  if (input.adSpend > 0) return "Paid acquisition is active on this channel.";
  return "Low variable cost structure.";
}

function channelNarrative(input: {
  channelLabel: string;
  isPaid: boolean;
  adSpend: number;
  marginPct: number;
  isHighestMargin: boolean;
}): string {
  if (input.isHighestMargin && input.adSpend <= 0) {
    return `This channel generated the highest profit margin because customers arrived organically.`;
  }
  if (input.adSpend <= 0 && input.marginPct >= 40) {
    return `${input.channelLabel} traffic converts efficiently without paid acquisition costs.`;
  }
  if (input.isPaid && input.marginPct < 0) {
    return `${input.channelLabel} spend currently exceeds the profit this channel generates.`;
  }
  if (input.isPaid && input.marginPct < 15) {
    return `Paid campaigns need efficiency gains before scaling ${input.channelLabel} further.`;
  }
  return `${input.channelLabel} contributes solid economics at current conversion rates.`;
}

function channelAiInsight(input: {
  channelLabel: string;
  isPaid: boolean;
  adSpend: number;
  marginPct: number;
  benchmark: ChannelBenchmark;
  tier: ProfitabilityTier;
}): string {
  const label = input.channelLabel;

  if (input.tier === "highly_profitable" && input.adSpend <= 0) {
    return `${label} traffic generated exceptional profitability because there were no acquisition costs. Continue investing in email marketing, branded search, and customer retention to increase this channel's share of total revenue.`;
  }

  if (input.tier === "profitable" && !input.isPaid) {
    return `${label} is a strong owned channel with healthy margins. Publish SEO content, strengthen email flows, and encourage repeat purchases to grow high-margin revenue from this source.`;
  }

  if (input.isPaid && input.marginPct < 0) {
    return `${label} campaigns are spending more than they return in net contribution. Pause or restructure the weakest ad sets before increasing budget.`;
  }

  if (input.isPaid && input.marginPct < 20) {
    return `${label} is close to break-even on a contribution basis. Tighten targeting, refresh creative, and route spend toward best-performing campaigns before scaling.`;
  }

  if (input.benchmark.profitSharePct > input.benchmark.revenueSharePct + 8) {
    return `${label} punches above its weight on profit. Protect what's working and gradually increase its share of marketing focus.`;
  }

  return `${label} is performing within expectations. Monitor weekly conversion and margin to catch drift before it impacts store profitability.`;
}

function channelRecommendedAction(input: {
  channelLabel: string;
  isPaid: boolean;
  tier: ProfitabilityTier;
  marginPct: number;
  existingRecommendation?: string;
}): string {
  if (input.existingRecommendation && input.existingRecommendation.length > 12) {
    return input.existingRecommendation;
  }

  if (input.tier === "highly_profitable" && !input.isPaid) {
    return `Increase investment in owned channels such as email, loyalty, and repeat customers to grow high-margin ${input.channelLabel} revenue.`;
  }
  if (input.isPaid && input.tier === "losing") {
    return `Reduce ${input.channelLabel} spend on underperforming campaigns and reallocate budget after ROAS improves.`;
  }
  if (input.isPaid && input.marginPct < 20) {
    return `Optimize ${input.channelLabel} targeting and landing pages before increasing ad budget.`;
  }
  if (input.tier === "profitable") {
    return `Scale ${input.channelLabel} gradually while monitoring contribution margin each week.`;
  }
  return `Review ${input.channelLabel} conversion path and cost structure for quick wins.`;
}

function estimateExpectedImpact(input: {
  tier: ProfitabilityTier;
  revenue: number;
  marginPct: number;
  existingImpact?: number;
}): number {
  if (input.existingImpact != null && input.existingImpact > 0) {
    return Math.round(input.existingImpact);
  }
  if (input.tier === "losing" || input.tier === "unprofitable") return 0;
  if (input.tier === "highly_profitable") {
    return Math.round(input.revenue * 0.08 * (input.marginPct / 100));
  }
  if (input.tier === "profitable") {
    return Math.round(input.revenue * 0.05 * (input.marginPct / 100));
  }
  return Math.round(input.revenue * 0.03);
}

export function buildDisconnectedChannelCard(input: {
  channelId: string;
  channelLabel: string;
}): ChannelProfitabilityCard {
  return {
    channelId: input.channelId,
    channelLabel: input.channelLabel,
    tier: "break_even",
    tierLabel: "Not Connected",
    tierEmoji: "⚪",
    contributionMarginPct: 0,
    revenue: 0,
    netContribution: 0,
    orders: 0,
    aov: 0,
    sessions: 0,
    summaryLine: "Channel not connected.",
    narrative: `Connect ${input.channelLabel} to see profitability and attribution.`,
    breakdown: [],
    aiInsight: `Connect ${input.channelLabel} to unlock channel-level profit insights and recommendations.`,
    trends: { revenuePct: null, profitPct: null, trafficPct: null },
    benchmark: {
      revenueSharePct: 0,
      profitSharePct: 0,
      insight: "No data available until this channel is connected.",
    },
    recommendedAction: `Connect ${input.channelLabel} in Connections to track performance.`,
    expectedImpactMonthly: 0,
    connected: false,
    adSpend: 0,
    roas: null,
  };
}

export function enrichChannelProfitabilityCard(input: {
  channelId: string;
  channelLabel: string;
  sessions: number;
  revenue: number;
  orders: number;
  aov: number;
  isPaid: boolean;
  connected: boolean;
  profitBreakdown: ChannelProfitBreakdown | null;
  storeTotals: {
    revenue: number;
    netContribution: number;
    sessions: number;
  };
  trends?: ChannelProfitTrend | null;
  adSpend: number;
  roas: number | null;
  isHighestMargin?: boolean;
  existingRecommendation?: string;
  existingImpactMonthly?: number;
}): ChannelProfitabilityCard | null {
  if (!input.profitBreakdown || input.revenue <= 0) return null;

  const { profitBreakdown } = input;
  const marginPct =
    profitBreakdown.revenue > 0
      ? round((profitBreakdown.netContribution / profitBreakdown.revenue) * 100, 1)
      : 0;
  const tierInfo = profitabilityTierFromMargin(marginPct, profitBreakdown.netContribution);
  const benchmark = buildChannelBenchmark({
    channelRevenue: input.revenue,
    channelNetContribution: profitBreakdown.netContribution,
    storeRevenue: input.storeTotals.revenue,
    storeNetContribution: input.storeTotals.netContribution,
  });

  const trends = input.trends ?? {
    revenuePct: null,
    profitPct: null,
    trafficPct: null,
  };

  return {
    channelId: input.channelId,
    channelLabel: input.channelLabel,
    ...tierInfo,
    contributionMarginPct: marginPct,
    revenue: profitBreakdown.revenue,
    netContribution: profitBreakdown.netContribution,
    orders: input.orders,
    aov: input.aov,
    sessions: input.sessions,
    summaryLine: channelSummaryLine({
      adSpend: input.adSpend,
      isPaid: input.isPaid,
      marginPct,
    }),
    narrative: channelNarrative({
      channelLabel: input.channelLabel,
      isPaid: input.isPaid,
      adSpend: input.adSpend,
      marginPct,
      isHighestMargin: input.isHighestMargin ?? false,
    }),
    breakdown: breakdownWithPercentages(profitBreakdown),
    aiInsight: channelAiInsight({
      channelLabel: input.channelLabel,
      isPaid: input.isPaid,
      adSpend: input.adSpend,
      marginPct,
      benchmark,
      tier: tierInfo.tier,
    }),
    trends,
    benchmark,
    recommendedAction: channelRecommendedAction({
      channelLabel: input.channelLabel,
      isPaid: input.isPaid,
      tier: tierInfo.tier,
      marginPct,
      existingRecommendation: input.existingRecommendation,
    }),
    expectedImpactMonthly: estimateExpectedImpact({
      tier: tierInfo.tier,
      revenue: input.revenue,
      marginPct,
      existingImpact: input.existingImpactMonthly,
    }),
    connected: input.connected,
    adSpend: input.adSpend,
    roas: input.roas,
  };
}

export function buildProfitChannelBreakdown(input: {
  channelRevenue: number;
  storeRevenue: number;
  profitDashboard: ProfitDashboard;
  advertisingCost: number;
}): ChannelProfitBreakdown {
  return (
    buildChannelProfitBreakdown({
      channelRevenue: input.channelRevenue,
      storeRevenue: input.storeRevenue,
      profitDashboard: input.profitDashboard,
      advertisingCost: input.advertisingCost,
    }) ?? {
      revenue: Math.round(input.channelRevenue),
      advertisingCost: Math.round(input.advertisingCost),
      cogs: 0,
      shipping: 0,
      paymentFees: 0,
      netContribution: Math.round(input.channelRevenue - input.advertisingCost),
    }
  );
}
