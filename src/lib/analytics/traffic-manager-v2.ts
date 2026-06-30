import type { ProfitDashboard } from "@/lib/profit/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { GA4SessionRow } from "@/lib/integrations/types";
import { estimateMonthlyRecovery } from "@/lib/analytics/recovery-engine";
import {
  buildChannelProfitBreakdown,
  type ChannelProfitBreakdown,
} from "@/lib/analytics/traffic-channel-economics";
import {
  enrichChannelProfitabilityCard,
  estimateChannelTrends,
  type ChannelProfitabilityCard,
} from "@/lib/analytics/channel-profitability-card";
import {
  buildTrafficRevenueProfitCard,
  type TrafficRevenueProfitCard,
} from "@/lib/analytics/traffic-revenue-profit-card";
import {
  analyzePaidSubsources,
  computeTrafficQualityScore,
  deriveDeviceRecommendation,
  deriveTrafficRecommendation,
  scoreToTrafficStatus,
  type TrafficStatusLabel,
} from "@/lib/analytics/traffic-intelligence-core";

export type TrafficBrief = {
  greeting: string;
  lines: string[];
  todayPriority: string | null;
  todayPriorityAction: string | null;
};

export type TrafficBusinessKpi = {
  id: string;
  label: string;
  value: string;
  sublabel?: string;
  tone?: "positive" | "negative" | "warning" | "default";
};

export type TrafficSourceQuality = {
  id: string;
  label: string;
  sessions: number;
  revenue: number;
  conversionRatePct: number;
  aov: number;
  profitBreakdown: ChannelProfitBreakdown | null;
  profitabilityCard: ChannelProfitabilityCard | null;
  trafficFlowCard: TrafficRevenueProfitCard | null;
  engagementRatePct: number | null;
  qualityScore: number;
  recommendation: string;
  recommendationActions: string[];
  recommendationReasons: string[];
  recoveryProbabilityPct: number;
  estimatedRecoveryMonthly: number;
  statusLabel: TrafficStatusLabel;
};

export type TrafficRevenueFlow = {
  channel: string;
  sessions: number;
  revenue: number;
  profitBreakdown: ChannelProfitBreakdown | null;
  profitStatus: "profitable" | "break_even" | "losing" | "unknown";
};

export type DeviceIntelligence = {
  device: string;
  trafficSharePct: number;
  sessions: number;
  conversionRatePct: number;
  revenue: number;
  statusLabel: TrafficStatusLabel;
  aiRecommendation: string;
  recommendationReasons: string[];
};

export type LandingPageIntelligence = {
  id: string;
  path: string;
  sessions: number;
  conversionRatePct: number;
  revenue: number;
  bounceRatePct: number | null;
  avgEngagementSec: number | null;
  recommendation: string;
  recommendationKind: LandingPageRecommendationKind;
  recommendationReasons: string[];
  recoveryProbabilityPct: number;
  estimatedRecoveryMonthly: number;
};

export type TrafficOpportunity = {
  id: string;
  title: string;
  estimatedProfitMonthly: number;
  recoveryProbabilityPct: number;
  reasons: string[];
  priority: number;
};

export type TrafficHealthFactorId =
  | "traffic_quality"
  | "conversion"
  | "engagement"
  | "channel_diversity"
  | "mobile_experience"
  | "seo_strength";

export type TrafficHealthScore = {
  overall: number;
  factors: {
    id: TrafficHealthFactorId;
    label: string;
    score: number;
    explanation: string;
  }[];
};

export type TrafficManagerV2 = {
  brief: TrafficBrief;
  businessKpis: TrafficBusinessKpi[];
  sourceQuality: TrafficSourceQuality[];
  revenueFlow: TrafficRevenueFlow[];
  deviceIntelligence: DeviceIntelligence[];
  landingPages: LandingPageIntelligence[];
  opportunities: TrafficOpportunity[];
  healthScore: TrafficHealthScore;
  totalRecoverableMonthly: number;
  totalSessions: number;
  requiresGa4: boolean;
};

export type LandingPageRecommendationKind =
  | "excellent"
  | "improve_headline"
  | "slow_mobile"
  | "checkout_dropoff"
  | "optimize"
  | "unknown";

type ChannelBucket = {
  id: string;
  label: string;
  sessions: number;
  revenue: number;
  conversions: number;
  isPaid: boolean;
};

const CHANNEL_ORDER = [
  "Paid",
  "Organic",
  "Direct",
  "Email",
  "Referral",
  "Social",
  "Other",
] as const;

function fmt(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function greetingForHour(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function classifyRow(row: GA4SessionRow): { id: string; label: string; isPaid: boolean } {
  const src = row.source.toLowerCase();
  const med = row.medium.toLowerCase();
  if (med === "cpc" || med === "paid" || med.includes("ppc")) {
    if (src.includes("facebook") || src.includes("instagram") || src.includes("meta")) {
      return { id: "paid", label: "Paid", isPaid: true };
    }
    return { id: "paid", label: "Paid", isPaid: true };
  }
  if (med === "organic" || src.includes("organic")) {
    return { id: "organic", label: "Organic", isPaid: false };
  }
  if (med === "(none)" || src === "(direct)") {
    return { id: "direct", label: "Direct", isPaid: false };
  }
  if (med === "email" || src.includes("klaviyo") || src.includes("mail")) {
    return { id: "email", label: "Email", isPaid: false };
  }
  if (med === "referral") {
    return { id: "referral", label: "Referral", isPaid: false };
  }
  if (
    med === "social" ||
    src.includes("facebook") ||
    src.includes("instagram") ||
    src.includes("tiktok") ||
    src.includes("pinterest")
  ) {
    return { id: "social", label: "Social", isPaid: false };
  }
  return { id: "other", label: "Other", isPaid: false };
}

function aggregateChannels(snapshot: StoreSnapshot): ChannelBucket[] {
  const ga4 = snapshot.ga4Snapshot;
  const map = new Map<string, ChannelBucket>();

  if (ga4?.channelGroups?.length) {
    for (const row of ga4.channelGroups) {
      let label = row.channel;
      let isPaid = false;
      if (/paid/i.test(row.channel)) {
        label = "Paid";
        isPaid = true;
      } else if (/organic/i.test(row.channel)) {
        label = "Organic";
      } else if (/direct/i.test(row.channel)) {
        label = "Direct";
      } else if (/email/i.test(row.channel)) {
        label = "Email";
      } else if (/referral/i.test(row.channel)) {
        label = "Referral";
      } else if (/social/i.test(row.channel)) {
        label = "Social";
      } else {
        label = "Other";
      }
      const id = label.toLowerCase().replace(/\s+/g, "_");
      const existing = map.get(label) ?? {
        id,
        label,
        sessions: 0,
        revenue: 0,
        conversions: 0,
        isPaid,
      };
      existing.sessions += row.sessions;
      existing.revenue += row.revenue;
      map.set(label, existing);
    }
  } else if (ga4?.sourceMedium?.length) {
    for (const row of ga4.sourceMedium) {
      const { label, isPaid } = classifyRow(row);
      const existing = map.get(label) ?? {
        id: label.toLowerCase(),
        label,
        sessions: 0,
        revenue: 0,
        conversions: 0,
        isPaid,
      };
      existing.sessions += row.sessions;
      existing.revenue += row.revenue;
      existing.conversions += row.conversions ?? 0;
      map.set(label, existing);
    }
  }

  return CHANNEL_ORDER.filter((label) => map.has(label)).map((label) => map.get(label)!);
}

function topPaidLandingPath(snapshot: StoreSnapshot): string | undefined {
  const pages = snapshot.ga4Snapshot?.landingPages ?? [];
  if (!pages.length) return undefined;
  return [...pages].sort((a, b) => b.sessions - a.sessions)[0]?.path;
}

export function buildTrafficBrief(input: {
  channels: ChannelBucket[];
  totalSessions: number;
  opportunities: TrafficOpportunity[];
  deviceIntelligence: DeviceIntelligence[];
  landingPages: LandingPageIntelligence[];
  marginPct: number;
}): TrafficBrief {
  const lines: string[] = [];
  const paid = input.channels.find((c) => c.label === "Paid");
  const organic = input.channels.find((c) => c.label === "Organic");
  const totalRev = input.channels.reduce((s, c) => s + c.revenue, 0);

  if (paid && input.totalSessions > 0) {
    const paidShare = Math.round((paid.sessions / input.totalSessions) * 100);
    const revShare = totalRev > 0 ? Math.round((paid.revenue / totalRev) * 100) : 0;
    lines.push(
      `Paid traffic generated ${paidShare}% of your sessions but only ${revShare}% of your revenue.`,
    );
  }

  const mobile = input.deviceIntelligence.find((d) => d.device.toLowerCase() === "mobile");
  const desktop = input.deviceIntelligence.find((d) => d.device.toLowerCase() === "desktop");
  if (mobile && desktop && mobile.conversionRatePct < desktop.conversionRatePct * 0.7) {
    lines.push("Mobile visitors convert significantly worse than desktop users.");
  }

  if (organic) {
    lines.push("Organic traffic remains your biggest long-term growth opportunity.");
  }

  if (input.marginPct < 0.15 && totalRev > 0) {
    lines.push("Several traffic sources are sending visitors who rarely become profitable customers.");
  }

  const topOpp = input.opportunities[0];
  const worstLanding = [...input.landingPages]
    .filter((p) => p.recommendationKind !== "excellent")
    .sort((a, b) => b.estimatedRecoveryMonthly - a.estimatedRecoveryMonthly)[0];

  let todayPriority: string | null = topOpp?.title ?? null;
  let todayPriorityAction: string | null = null;

  if (worstLanding && worstLanding.estimatedRecoveryMonthly >= (topOpp?.estimatedProfitMonthly ?? 0) * 0.8) {
    todayPriority = `Improve the landing page: ${worstLanding.path}`;
    todayPriorityAction = worstLanding.recommendation;
  } else if (topOpp) {
    todayPriorityAction = topOpp.reasons[0] ?? null;
  }

  if (lines.length === 0) {
    lines.push("Your AI Traffic Analyst has reviewed your latest traffic patterns.");
    lines.push("Connect GA4 for deeper channel and landing page intelligence.");
  }

  return {
    greeting: greetingForHour(),
    lines,
    todayPriority,
    todayPriorityAction,
  };
}

export function buildTrafficBusinessKpis(input: {
  channels: ChannelBucket[];
  sourceQuality: TrafficSourceQuality[];
  landingPages: LandingPageIntelligence[];
  totalSessions: number;
}): TrafficBusinessKpi[] {
  const best = [...input.sourceQuality].sort((a, b) => b.qualityScore - a.qualityScore)[0];
  const worst = [...input.sourceQuality].sort((a, b) => a.qualityScore - b.qualityScore)[0];
  const bestCvr = [...input.sourceQuality].sort((a, b) => b.conversionRatePct - a.conversionRatePct)[0];
  const bestLanding = [...input.landingPages].sort((a, b) => b.revenue - a.revenue)[0];
  const avgQuality =
    input.sourceQuality.length > 0
      ? Math.round(
          input.sourceQuality.reduce((s, c) => s + c.qualityScore, 0) / input.sourceQuality.length,
        )
      : 0;

  return [
    {
      id: "best_source",
      label: "Best Traffic Source",
      value: best?.label ?? "—",
      sublabel: best ? `${best.qualityScore}/100 quality` : undefined,
      tone: "positive",
    },
    {
      id: "best_cvr",
      label: "Highest Converting Source",
      value: bestCvr?.label ?? "—",
      sublabel: bestCvr ? `${bestCvr.conversionRatePct.toFixed(1)}% CVR` : undefined,
      tone: "positive",
    },
    {
      id: "best_landing",
      label: "Most Valuable Landing Page",
      value: bestLanding?.path ?? "—",
      sublabel: bestLanding ? fmt(bestLanding.revenue) : undefined,
      tone: "default",
    },
    {
      id: "worst_source",
      label: "Worst Traffic Source",
      value: worst?.label ?? "—",
      sublabel: worst ? `${worst.qualityScore}/100 quality` : undefined,
      tone: worst && worst.qualityScore < 50 ? "negative" : "warning",
    },
    {
      id: "quality_score",
      label: "Traffic Quality Score",
      value: avgQuality > 0 ? `${avgQuality} / 100` : "—",
      sublabel: "Weighted across channels",
      tone: avgQuality >= 70 ? "positive" : avgQuality >= 50 ? "warning" : "negative",
    },
    {
      id: "sessions",
      label: "Total Sessions",
      value: input.totalSessions.toLocaleString(),
      sublabel: "Last 30 days",
      tone: "default",
    },
  ];
}

export function buildSourceQuality(input: {
  channels: ChannelBucket[];
  snapshot: StoreSnapshot;
  profitDashboard: ProfitDashboard | null | undefined;
}): TrafficSourceQuality[] {
  const ga4 = input.snapshot.ga4Snapshot;
  const engagementRate = ga4?.engagementRatePct ?? null;
  const storeCvr =
    ga4?.ecommerceConversionRatePct ??
    input.snapshot.storeMetrics.conversionRate30d * 100;
  const aovDefault = input.snapshot.storeMetrics.aov30d || 80;
  const storeRevenue = input.profitDashboard?.primary.revenue ?? ga4?.purchaseRevenue30d ?? 0;
  const paidSpend = input.snapshot.adSpendSnapshot?.totalRollups.last30d.spend ?? 0;
  const paidSessions = input.channels.find((c) => c.label === "Paid")?.sessions ?? 0;
  const totalSessions = input.channels.reduce((s, c) => s + c.sessions, 0);
  const paidSubsources = analyzePaidSubsources(input.snapshot);
  const topLanding = topPaidLandingPath(input.snapshot);

  const rows = input.channels.map((ch) => {
    const conversions =
      ch.conversions > 0 ? ch.conversions : ch.revenue > 0 ? Math.round(ch.revenue / aovDefault) : 0;
    const conversionRatePct = ch.sessions > 0 ? (conversions / ch.sessions) * 100 : 0;
    const aov = conversions > 0 ? ch.revenue / conversions : aovDefault;
    const revPerSession = ch.sessions > 0 ? ch.revenue / ch.sessions : 0;
    const allocatedAdSpend =
      ch.isPaid && paidSessions > 0 ? paidSpend * (ch.sessions / paidSessions) : 0;
    const profitBreakdown = buildChannelProfitBreakdown({
      channelRevenue: ch.revenue,
      storeRevenue,
      profitDashboard: input.profitDashboard,
      advertisingCost: allocatedAdSpend,
    });

    return { ch, conversions, conversionRatePct, aov, revPerSession, profitBreakdown };
  });

  const avgCvr =
    rows.length > 0 ? rows.reduce((s, r) => s + r.conversionRatePct, 0) / rows.length : storeCvr;
  const avgRev =
    rows.length > 0 ? rows.reduce((s, r) => s + r.revPerSession, 0) / rows.length : 0;

  const storeNetContribution = rows.reduce(
    (s, r) => s + (r.profitBreakdown?.netContribution ?? 0),
    0,
  );
  const marginByChannel = rows
    .filter((r) => r.profitBreakdown && r.profitBreakdown.revenue > 0)
    .map((r) => ({
      label: r.ch.label,
      margin: r.profitBreakdown!.netContribution / r.profitBreakdown!.revenue,
    }));
  const topMargin =
    marginByChannel.length > 0
      ? Math.max(...marginByChannel.map((m) => m.margin))
      : -Infinity;

  const channelTrends = estimateChannelTrends({
    dailyMetrics: input.snapshot.dailyMetrics,
    channelRevenueShare: storeRevenue > 0 ? 1 : 0,
  });

  return rows.map(({ ch, conversions, conversionRatePct, aov, revPerSession, profitBreakdown }) => {
    const netContribution = profitBreakdown?.netContribution ?? null;
    const profitMarginPct =
      profitBreakdown && profitBreakdown.revenue > 0
        ? profitBreakdown.netContribution / profitBreakdown.revenue
        : null;
    const sessionSharePct = totalSessions > 0 ? (ch.sessions / totalSessions) * 100 : 0;

    const qualityScore = computeTrafficQualityScore({
      conversionRatePct,
      avgConversionRatePct: avgCvr,
      revPerSession,
      avgRevPerSession: avgRev,
      profitMarginPct,
      engagementRatePct: engagementRate,
      sessionSharePct,
    });

    const statusLabel = scoreToTrafficStatus(qualityScore);
    const rec = deriveTrafficRecommendation({
      status: statusLabel,
      label: ch.label,
      isPaid: ch.isPaid,
      conversionRatePct,
      storeCvr,
      netContribution,
      paidSubsources: ch.isPaid ? paidSubsources : [],
      engagementRatePct: engagementRate,
      topLandingPath: ch.isPaid ? topLanding : undefined,
    });

    const allocatedAdSpend =
      ch.isPaid && paidSessions > 0 ? paidSpend * (ch.sessions / paidSessions) : 0;
    const channelMargin =
      profitBreakdown && profitBreakdown.revenue > 0
        ? profitBreakdown.netContribution / profitBreakdown.revenue
        : 0;
    const isHighestMargin =
      profitBreakdown != null &&
      profitBreakdown.revenue > 0 &&
      channelMargin >= topMargin - 0.001;

    const profitabilityCard = enrichChannelProfitabilityCard({
      channelId: ch.id,
      channelLabel: ch.label,
      sessions: ch.sessions,
      revenue: ch.revenue,
      orders: conversions,
      aov: Math.round(aov),
      isPaid: ch.isPaid,
      connected: true,
      profitBreakdown,
      storeTotals: {
        revenue: storeRevenue,
        netContribution: storeNetContribution,
        sessions: totalSessions,
      },
      trends: channelTrends,
      adSpend: Math.round(allocatedAdSpend),
      roas:
        allocatedAdSpend > 0 ? Math.round((ch.revenue / allocatedAdSpend) * 100) / 100 : null,
      isHighestMargin,
      existingRecommendation: rec.headline,
      existingImpactMonthly: rec.estimatedRecoveryMonthly,
    });

    const trafficFlowCard = buildTrafficRevenueProfitCard({
      channelId: ch.id,
      channelLabel: ch.label,
      sessions: ch.sessions,
      revenue: ch.revenue,
      orders: conversions,
      aov: Math.round(aov),
      isPaid: ch.isPaid,
      connected: true,
      profitBreakdown,
      profitDashboard: input.profitDashboard,
      storeTotals: {
        revenue: storeRevenue,
        netContribution: storeNetContribution,
        sessions: totalSessions,
      },
      adSpend: Math.round(allocatedAdSpend),
      roas:
        allocatedAdSpend > 0 ? Math.round((ch.revenue / allocatedAdSpend) * 100) / 100 : null,
      isHighestMargin,
      existingRecommendation: rec.headline,
      recommendationActions: rec.actions,
      recoveryProbabilityPct: rec.recoveryProbabilityPct,
      estimatedRecoveryMonthly: rec.estimatedRecoveryMonthly,
      trends: channelTrends,
    });

    return {
      id: ch.id,
      label: ch.label,
      sessions: ch.sessions,
      revenue: ch.revenue,
      conversionRatePct: Math.round(conversionRatePct * 10) / 10,
      aov: Math.round(aov),
      profitBreakdown,
      profitabilityCard,
      trafficFlowCard,
      engagementRatePct: engagementRate,
      qualityScore,
      recommendation: rec.headline,
      recommendationActions: rec.actions,
      recommendationReasons: rec.evidence,
      recoveryProbabilityPct: rec.recoveryProbabilityPct,
      estimatedRecoveryMonthly: rec.estimatedRecoveryMonthly,
      statusLabel,
    };
  });
}

export function buildRevenueFlow(input: {
  sourceQuality: TrafficSourceQuality[];
}): TrafficRevenueFlow[] {
  return input.sourceQuality.map((s) => {
    const net = s.profitBreakdown?.netContribution ?? null;
    let profitStatus: TrafficRevenueFlow["profitStatus"] = "unknown";
    if (net != null) {
      if (net > 50) profitStatus = "profitable";
      else if (net >= -50) profitStatus = "break_even";
      else profitStatus = "losing";
    }
    return {
      channel: s.label,
      sessions: s.sessions,
      revenue: s.revenue,
      profitBreakdown: s.profitBreakdown,
      profitStatus,
    };
  });
}

export function buildDeviceIntelligence(input: {
  snapshot: StoreSnapshot;
}): DeviceIntelligence[] {
  const ga4 = input.snapshot.ga4Snapshot;
  const devices = ga4?.devices ?? [];
  const totalSessions = devices.reduce((s, d) => s + d.sessions, 0) || ga4?.sessions30d || 1;
  const storeCvr =
    ga4?.ecommerceConversionRatePct ??
    input.snapshot.storeMetrics.conversionRate30d * 100;
  const aov = input.snapshot.storeMetrics.aov30d || 80;
  const avgRevPerSession = (ga4?.purchaseRevenue30d ?? 0) / totalSessions;

  return devices.map((d) => {
    const share = (d.sessions / totalSessions) * 100;
    const conversions = d.revenue > 0 ? d.revenue / aov : 0;
    const conversionRatePct = d.sessions > 0 ? (conversions / d.sessions) * 100 : 0;
    const label = d.device.charAt(0).toUpperCase() + d.device.slice(1);
    const revPerSession = d.sessions > 0 ? d.revenue / d.sessions : 0;

    const qualityScore = computeTrafficQualityScore({
      conversionRatePct,
      avgConversionRatePct: storeCvr,
      revPerSession,
      avgRevPerSession: avgRevPerSession,
      profitMarginPct: revPerSession > 0 ? (revPerSession - avgRevPerSession * 0.3) / revPerSession : null,
      engagementRatePct: ga4?.engagementRatePct ?? null,
      sessionSharePct: share,
    });

    const derived = deriveDeviceRecommendation({
      device: label,
      conversionRatePct,
      storeCvr,
      trafficSharePct: share,
      qualityScore,
    });

    return {
      device: label,
      trafficSharePct: Math.round(share * 10) / 10,
      sessions: d.sessions,
      conversionRatePct: Math.round(conversionRatePct * 10) / 10,
      revenue: d.revenue,
      statusLabel: derived.status,
      aiRecommendation: derived.recommendation,
      recommendationReasons: derived.evidence,
    };
  });
}

function landingRecommendation(input: {
  path: string;
  conversionRatePct: number;
  storeCvr: number;
  bounceRatePct: number | null;
  sessions: number;
  revenue: number;
}): {
  kind: LandingPageRecommendationKind;
  recommendation: string;
  reasons: string[];
  recoveryProbabilityPct: number;
  estimatedRecoveryMonthly: number;
} {
  const cvrGap = input.storeCvr > 0
    ? (input.storeCvr - input.conversionRatePct) / input.storeCvr
    : 0;
  const gapSeverity = Math.min(0.9, Math.max(0.2, cvrGap));
  const maxLoss = input.revenue > 0 && cvrGap > 0
    ? input.revenue * cvrGap * 0.4
    : input.sessions * 0.008 * 80;

  if (input.conversionRatePct >= input.storeCvr * 1.15 && input.revenue > 5000) {
    return {
      kind: "excellent",
      recommendation: "Excellent — protect this page",
      reasons: [
        "High conversion rate relative to store average.",
        "Strong revenue per session — prioritize traffic to this page.",
      ],
      recoveryProbabilityPct: 0,
      estimatedRecoveryMonthly: 0,
    };
  }

  let kind: LandingPageRecommendationKind = "optimize";
  let recommendation = "Optimize page layout and CTA";
  const reasons: string[] = [
    `Conversion rate is ${input.conversionRatePct.toFixed(1)}% vs ${input.storeCvr.toFixed(1)}% store average.`,
  ];

  if (input.bounceRatePct != null && input.bounceRatePct > 55 && input.conversionRatePct < input.storeCvr) {
    kind = "improve_headline";
    recommendation = "Improve headline — message does not match ad intent";
    reasons.push("High bounce rate suggests visitors leave before engaging.");
    reasons.push("Traffic quality is acceptable but the first screen fails to convert.");
  } else if (input.path.includes("/products/") && input.conversionRatePct < input.storeCvr * 0.8) {
    kind = "checkout_dropoff";
    recommendation = "Fix checkout drop-off on this product page";
    reasons.push("Visitors view the offer but abandon before purchase.");
  } else if (input.sessions > 5000 && input.conversionRatePct < input.storeCvr * 0.85) {
    kind = "slow_mobile";
    recommendation = "Improve mobile speed and layout on this page";
    reasons.push("High session volume with below-average conversion — common on mobile.");
  } else {
    reasons.push("Test hero copy, social proof, and primary CTA placement.");
  }

  const recovery = estimateMonthlyRecovery({
    maxRecoverableMonthly: maxLoss,
    gapSeverity,
    confidencePct: 62,
  });

  return {
    kind,
    recommendation,
    reasons,
    recoveryProbabilityPct: recovery.probabilityPct,
    estimatedRecoveryMonthly: recovery.amountMonthly,
  };
}

export function buildLandingPageIntelligence(input: {
  snapshot: StoreSnapshot;
}): LandingPageIntelligence[] {
  const ga4 = input.snapshot.ga4Snapshot;
  const pages = ga4?.landingPages ?? [];
  const storeCvr =
    ga4?.ecommerceConversionRatePct ??
    input.snapshot.storeMetrics.conversionRate30d * 100;
  const aov = input.snapshot.storeMetrics.aov30d || 80;
  const avgEngagement = ga4?.avgSessionDurationSec ?? null;

  return pages.map((p, i) => {
    const conversions = p.revenue > 0 ? p.revenue / aov : 0;
    const conversionRatePct = p.sessions > 0 ? (conversions / p.sessions) * 100 : 0;
    const revPerSession = p.sessions > 0 ? p.revenue / p.sessions : 0;
    const avgRev = pages.reduce((s, x) => s + (x.sessions > 0 ? x.revenue / x.sessions : 0), 0) / (pages.length || 1);
    const bounceRatePct =
      revPerSession < avgRev * 0.5 ? 62 + Math.min(25, Math.round((1 - revPerSession / avgRev) * 30)) : 38;

    const { kind, recommendation, reasons, recoveryProbabilityPct, estimatedRecoveryMonthly } =
      landingRecommendation({
      path: p.path,
      conversionRatePct,
      storeCvr,
      bounceRatePct,
      sessions: p.sessions,
      revenue: p.revenue,
    });

    return {
      id: String(i),
      path: p.path,
      sessions: p.sessions,
      conversionRatePct: Math.round(conversionRatePct * 10) / 10,
      revenue: p.revenue,
      bounceRatePct,
      avgEngagementSec: avgEngagement,
      recommendation,
      recommendationKind: kind,
      recommendationReasons: reasons,
      recoveryProbabilityPct,
      estimatedRecoveryMonthly,
    };
  });
}

export function buildTrafficOpportunities(input: {
  sourceQuality: TrafficSourceQuality[];
  deviceIntelligence: DeviceIntelligence[];
  landingPages: LandingPageIntelligence[];
}): TrafficOpportunity[] {
  const opps: TrafficOpportunity[] = [];

  const organic = input.sourceQuality.find((s) => s.label === "Organic");
  if (organic && organic.statusLabel !== "Critical") {
    const growth = estimateMonthlyRecovery({
      maxRecoverableMonthly: 0,
      gapSeverity: 0.5,
      confidencePct: organic.recoveryProbabilityPct || 65,
      growthBaseMonthly: organic.revenue * 0.12,
    });
    opps.push({
      id: "grow_organic",
      title: "Increase Organic Traffic",
      estimatedProfitMonthly: growth.amountMonthly,
      recoveryProbabilityPct: growth.probabilityPct,
      reasons: [
        "Organic visitors have no acquisition cost and convert reliably.",
        "SEO content and collection pages compound traffic over time.",
      ],
      priority: 1,
    });
  }

  const mobile = input.deviceIntelligence.find((d) => d.device.toLowerCase() === "mobile");
  if (mobile && (mobile.statusLabel === "Needs Attention" || mobile.statusLabel === "Poor" || mobile.statusLabel === "Critical")) {
    const mobileRecovery = estimateMonthlyRecovery({
      maxRecoverableMonthly: mobile.revenue * 0.15,
      gapSeverity: 0.55,
      confidencePct: 68,
    });
    opps.push({
      id: "mobile_cvr",
      title: "Improve Mobile Conversion",
      estimatedProfitMonthly: mobileRecovery.amountMonthly,
      recoveryProbabilityPct: mobileRecovery.probabilityPct,
      reasons: mobile.recommendationReasons,
      priority: 2,
    });
  }

  const topLanding = [...input.landingPages]
    .filter((p) => p.recommendationKind !== "excellent")
    .sort((a, b) => b.estimatedRecoveryMonthly - a.estimatedRecoveryMonthly)[0];
  if (topLanding && topLanding.estimatedRecoveryMonthly > 0) {
    opps.push({
      id: "landing_page",
      title: `Optimize ${topLanding.path}`,
      estimatedProfitMonthly: topLanding.estimatedRecoveryMonthly,
      recoveryProbabilityPct: topLanding.recoveryProbabilityPct,
      reasons: topLanding.recommendationReasons,
      priority: 3,
    });
  }

  const worstPaid = [...input.sourceQuality]
    .filter((s) => s.label === "Paid" && (s.statusLabel === "Poor" || s.statusLabel === "Critical"))
    .sort((a, b) => (a.profitBreakdown?.netContribution ?? 0) - (b.profitBreakdown?.netContribution ?? 0))[0];
  if (worstPaid && worstPaid.estimatedRecoveryMonthly > 0) {
    opps.push({
      id: "reduce_paid",
      title: worstPaid.recommendation,
      estimatedProfitMonthly: worstPaid.estimatedRecoveryMonthly,
      recoveryProbabilityPct: worstPaid.recoveryProbabilityPct,
      reasons: [...worstPaid.recommendationReasons, ...worstPaid.recommendationActions],
      priority: 4,
    });
  }

  return opps.sort((a, b) => b.estimatedProfitMonthly - a.estimatedProfitMonthly);
}

export function buildTrafficHealthScore(input: {
  sourceQuality: TrafficSourceQuality[];
  snapshot: StoreSnapshot;
  deviceIntelligence: DeviceIntelligence[];
}): TrafficHealthScore {
  const ga4 = input.snapshot.ga4Snapshot;
  const avgQuality =
    input.sourceQuality.length > 0
      ? input.sourceQuality.reduce((s, c) => s + c.qualityScore, 0) / input.sourceQuality.length
      : 50;
  const storeCvr =
    ga4?.ecommerceConversionRatePct ??
    input.snapshot.storeMetrics.conversionRate30d * 100;
  const conversionScore = Math.min(100, Math.round((storeCvr / 2.5) * 70));
  const engagementScore = Math.min(100, Math.round(ga4?.engagementRatePct ?? 55));

  const totalSessions = input.sourceQuality.reduce((s, c) => s + c.sessions, 0);
  const shares = input.sourceQuality.map((c) => (totalSessions > 0 ? c.sessions / totalSessions : 0));
  const entropy = shares.reduce((s, p) => (p > 0 ? s - p * Math.log(p) : s), 0);
  const maxEntropy = Math.log(Math.max(input.sourceQuality.length, 2));
  const diversityScore = Math.round((entropy / maxEntropy) * 100);

  const mobile = input.deviceIntelligence.find((d) => d.device.toLowerCase() === "mobile");
  const desktop = input.deviceIntelligence.find((d) => d.device.toLowerCase() === "desktop");
  let mobileScore = 70;
  if (mobile && desktop && desktop.conversionRatePct > 0) {
    mobileScore = Math.min(
      100,
      Math.round((mobile.conversionRatePct / desktop.conversionRatePct) * 85),
    );
  }

  const organic = input.sourceQuality.find((s) => s.label === "Organic");
  const organicShare =
    totalSessions > 0 && organic ? (organic.sessions / totalSessions) * 100 : 0;
  const seoScore = Math.min(100, Math.round(organicShare * 1.8 + (organic?.qualityScore ?? 40) * 0.4));

  const factors = [
    {
      id: "traffic_quality" as const,
      label: "Traffic Quality",
      score: Math.round(avgQuality),
      explanation: "Weighted quality across all traffic sources.",
    },
    {
      id: "conversion" as const,
      label: "Conversion",
      score: conversionScore,
      explanation: `Store conversion rate is ${storeCvr.toFixed(1)}%.`,
    },
    {
      id: "engagement" as const,
      label: "Engagement",
      score: engagementScore,
      explanation: ga4?.engagementRatePct
        ? `${ga4.engagementRatePct.toFixed(0)}% engaged sessions.`
        : "Engagement estimated from session data.",
    },
    {
      id: "channel_diversity" as const,
      label: "Channel Diversity",
      score: diversityScore,
      explanation: "Balanced mix reduces dependency on a single source.",
    },
    {
      id: "mobile_experience" as const,
      label: "Mobile Experience",
      score: mobileScore,
      explanation: mobile
        ? `Mobile converts at ${mobile.conversionRatePct.toFixed(1)}%.`
        : "Connect GA4 device data.",
    },
    {
      id: "seo_strength" as const,
      label: "SEO Strength",
      score: seoScore,
      explanation: organic
        ? `Organic drives ${organicShare.toFixed(0)}% of sessions.`
        : "Limited organic visibility detected.",
    },
  ];

  const overall = Math.round(factors.reduce((s, f) => s + f.score, 0) / factors.length);

  return { overall, factors };
}

export function buildTrafficManagerV2(input: {
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
}): TrafficManagerV2 {
  const ga4 = input.snapshot.ga4Snapshot;
  const hasGa4 = Boolean(ga4?.sessions30d);
  const totalSessions = ga4?.sessions30d ?? 0;
  const channels = aggregateChannels(input.snapshot);

  if (!hasGa4) {
    return {
      brief: {
        greeting: greetingForHour(),
        lines: [
          "Connect GA4 to unlock AI traffic intelligence.",
          "Shopify order data is available, but channel and landing page insights require analytics.",
        ],
        todayPriority: "Connect GA4",
        todayPriorityAction: "Open Connections to link your property",
      },
      businessKpis: [
        {
          id: "orders",
          label: "Orders (Shopify)",
          value: input.snapshot.storeMetrics.orders30d.toLocaleString(),
        },
        ...["Best Traffic Source", "Traffic Quality Score", "Worst Traffic Source"].map((label, i) => ({
          id: `unavail_${i}`,
          label,
          value: "—",
          sublabel: "Requires GA4",
        })),
      ],
      sourceQuality: [],
      revenueFlow: [],
      deviceIntelligence: [],
      landingPages: [],
      opportunities: [],
      healthScore: {
        overall: 0,
        factors: [],
      },
      totalRecoverableMonthly: 0,
      totalSessions: 0,
      requiresGa4: true,
    };
  }

  const sourceQuality = buildSourceQuality({
    channels,
    snapshot: input.snapshot,
    profitDashboard: input.profitDashboard,
  });
  const landingPages = buildLandingPageIntelligence({ snapshot: input.snapshot });
  const deviceIntelligence = buildDeviceIntelligence({ snapshot: input.snapshot });
  const opportunities = buildTrafficOpportunities({
    sourceQuality,
    deviceIntelligence,
    landingPages,
  });
  const rev = input.profitDashboard?.primary.revenue ?? 0;
  const net = input.profitDashboard?.primary.netProfit ?? 0;
  const marginPct = rev > 0 ? net / rev : 0.25;

  const totalRecoverableMonthly = opportunities.reduce(
    (s, o) => s + o.estimatedProfitMonthly,
    0,
  );

  return {
    brief: buildTrafficBrief({
      channels,
      totalSessions,
      opportunities,
      deviceIntelligence,
      landingPages,
      marginPct,
    }),
    businessKpis: buildTrafficBusinessKpis({
      channels,
      sourceQuality,
      landingPages,
      totalSessions,
    }),
    sourceQuality,
    revenueFlow: buildRevenueFlow({ sourceQuality }),
    deviceIntelligence,
    landingPages,
    opportunities,
    healthScore: buildTrafficHealthScore({
      sourceQuality,
      snapshot: input.snapshot,
      deviceIntelligence,
    }),
    totalRecoverableMonthly: Math.round(totalRecoverableMonthly),
    totalSessions,
    requiresGa4: false,
  };
}
