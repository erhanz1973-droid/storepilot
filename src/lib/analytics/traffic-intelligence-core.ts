import type { StoreSnapshot } from "@/lib/connectors/types";
import { estimateMonthlyRecovery } from "@/lib/analytics/recovery-engine";

export type TrafficStatusLabel =
  | "Excellent"
  | "Good"
  | "Needs Attention"
  | "Poor"
  | "Critical";

export type TrafficRecommendationBundle = {
  headline: string;
  actions: string[];
  evidence: string[];
  recoveryProbabilityPct: number;
  estimatedRecoveryMonthly: number;
};

export type PaidSubsourceInsight = {
  label: string;
  sessions: number;
  revenue: number;
  sessionSharePct: number;
  revenueSharePct: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function ratioScore(actual: number, benchmark: number, cap = 100): number {
  if (benchmark <= 0) return 50;
  return clamp(Math.round((actual / benchmark) * 70), 0, cap);
}

/** Weighted quality: CVR 30%, Rev/session 25%, Profit 25%, Engagement 10%, Stability 10%. */
export function computeTrafficQualityScore(input: {
  conversionRatePct: number;
  avgConversionRatePct: number;
  revPerSession: number;
  avgRevPerSession: number;
  profitMarginPct: number | null;
  engagementRatePct: number | null;
  sessionSharePct: number;
}): number {
  const cvrScore = ratioScore(input.conversionRatePct, input.avgConversionRatePct);
  const revScore = ratioScore(input.revPerSession, input.avgRevPerSession);

  let profitScore = 50;
  if (input.profitMarginPct != null) {
    if (input.profitMarginPct < 0) {
      profitScore = clamp(Math.round(35 + input.profitMarginPct * 120), 0, 39);
    } else {
      profitScore = clamp(Math.round(55 + input.profitMarginPct * 150), 40, 100);
    }
  }

  const engScore =
    input.engagementRatePct != null ? clamp(Math.round(input.engagementRatePct), 0, 100) : 55;

  // Balanced share (not over-dependent on one spike) scores higher around 15–35% per channel
  const idealShare = 25;
  const stabilityScore = clamp(
    100 - Math.abs(input.sessionSharePct - idealShare) * 2.2,
    35,
    95,
  );

  const raw =
    cvrScore * 0.3 +
    revScore * 0.25 +
    profitScore * 0.25 +
    engScore * 0.1 +
    stabilityScore * 0.1;

  let score = Math.round(raw);

  // Losing money must not score above Good
  if (input.profitMarginPct != null && input.profitMarginPct < -0.05) {
    score = Math.min(score, 74);
  }
  if (input.profitMarginPct != null && input.profitMarginPct < -0.15) {
    score = Math.min(score, 59);
  }
  if (input.profitMarginPct != null && input.profitMarginPct < -0.3) {
    score = Math.min(score, 39);
  }

  return clamp(score, 0, 100);
}

export function scoreToTrafficStatus(score: number): TrafficStatusLabel {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Needs Attention";
  if (score >= 40) return "Poor";
  return "Critical";
}

export function analyzePaidSubsources(snapshot: StoreSnapshot): PaidSubsourceInsight[] {
  const ga4 = snapshot.ga4Snapshot;
  const rows =
    ga4?.sourceMedium?.filter((r) => {
      const med = r.medium.toLowerCase();
      return med === "cpc" || med === "paid" || med.includes("ppc");
    }) ?? [];

  if (!rows.length) return [];

  const totalSessions = rows.reduce((s, r) => s + r.sessions, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const map = new Map<string, { sessions: number; revenue: number }>();

  for (const row of rows) {
    const src = row.source.toLowerCase();
    const camp = row.campaign.toLowerCase();
    let label = "Paid Other";
    if (src.includes("facebook") || src.includes("instagram") || src.includes("meta")) {
      label = /retarget|remarket|warm/i.test(camp) ? "Meta Retargeting" : "Meta Prospecting";
    } else if (src.includes("google")) {
      label = row.medium.toLowerCase() === "cpc" ? "Google Search" : "Google Display";
    } else if (src.includes("tiktok")) {
      label = "TikTok Paid";
    } else if (src.includes("pinterest")) {
      label = "Pinterest Paid";
    }

    const existing = map.get(label) ?? { sessions: 0, revenue: 0 };
    existing.sessions += row.sessions;
    existing.revenue += row.revenue;
    map.set(label, existing);
  }

  return [...map.entries()]
    .map(([label, stats]) => ({
      label,
      sessions: stats.sessions,
      revenue: stats.revenue,
      sessionSharePct:
        totalSessions > 0 ? Math.round((stats.sessions / totalSessions) * 1000) / 10 : 0,
      revenueSharePct:
        totalRevenue > 0 ? Math.round((stats.revenue / totalRevenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

export function deriveTrafficRecommendation(input: {
  status: TrafficStatusLabel;
  label: string;
  isPaid: boolean;
  conversionRatePct: number;
  storeCvr: number;
  netContribution: number | null;
  paidSubsources: PaidSubsourceInsight[];
  engagementRatePct: number | null;
  topLandingPath?: string;
}): TrafficRecommendationBundle {
  const cvrGapPct =
    input.storeCvr > 0
      ? Math.round(((input.storeCvr - input.conversionRatePct) / input.storeCvr) * 100)
      : 0;
  const losing = input.netContribution != null && input.netContribution < 0;
  const maxRecoverable =
    losing && input.netContribution != null ? Math.abs(input.netContribution) : 0;
  const gapSeverity = clamp(
    cvrGapPct > 0 ? cvrGapPct / 100 : losing ? 0.65 : 0.25,
    0.15,
    0.95,
  );
  const confidencePct = clamp(
    55 + (input.engagementRatePct ?? 50) * 0.25 - (losing ? 0 : 10),
    45,
    88,
  );

  const evidence: string[] = [];
  if (input.conversionRatePct > 0 && input.storeCvr > 0) {
    if (cvrGapPct > 5) {
      evidence.push(`Conversion rate is ${cvrGapPct}% below your store average.`);
    } else if (cvrGapPct < -5) {
      evidence.push(`Conversion rate is ${Math.abs(cvrGapPct)}% above your store average.`);
    } else {
      evidence.push("Conversion rate is near your store average.");
    }
  }
  if (input.engagementRatePct != null && input.engagementRatePct >= 55) {
    evidence.push("Paid traffic engagement is healthy — the bottleneck is likely post-click.");
  }
  if (input.topLandingPath) {
    evidence.push(`Most abandonment happens on ${input.topLandingPath} before checkout.`);
  }

  let headline = "Monitor weekly performance";
  const actions: string[] = [];

  switch (input.status) {
    case "Excellent":
      headline = "Scale traffic — protect what's working";
      actions.push(`Increase ${input.label} budget gradually (10–15%).`);
      actions.push("Protect landing page experience — do not change core offer.");
      evidence.push("Revenue per session and conversion outperform store benchmarks.");
      break;

    case "Good":
      headline = "Minor optimization recommended";
      actions.push("Run A/B tests on headline and primary CTA.");
      if (input.topLandingPath) {
        actions.push(`Review ${input.topLandingPath} for friction on mobile.`);
      }
      break;

    case "Needs Attention":
      headline = "Landing page and conversion optimization";
      actions.push("Improve landing page message-to-intent match.");
      actions.push("Add social proof and simplify checkout steps.");
      evidence.push("Traffic volume is acceptable but conversion underperforms.");
      break;

    case "Poor":
      if (input.isPaid && input.paidSubsources.length >= 2) {
        const worst = [...input.paidSubsources].sort(
          (a, b) => a.revenueSharePct / Math.max(a.sessionSharePct, 1) -
            b.revenueSharePct / Math.max(b.sessionSharePct, 1),
        )[0];
        const best = [...input.paidSubsources].sort(
          (a, b) => b.revenueSharePct / Math.max(b.sessionSharePct, 1) -
            a.revenueSharePct / Math.max(a.sessionSharePct, 1),
        )[0];
        headline = `Reduce ${worst.label} spend — shift to ${best.label}`;
        actions.push(
          `${worst.label} contributes ${worst.sessionSharePct.toFixed(0)}% of paid sessions but only ${worst.revenueSharePct.toFixed(0)}% of paid revenue.`,
        );
        actions.push(`Reduce ${worst.label} budget by 15–20%.`);
        actions.push(`Move budget toward ${best.label}.`);
        if (input.topLandingPath) {
          actions.push(`Improve landing page: ${input.topLandingPath}.`);
        }
      } else if (input.isPaid) {
        headline = "Reduce paid spend and optimize campaigns";
        actions.push("Cut lowest-ROAS ad sets by 15–20%.");
        actions.push("Refresh creative on remaining campaigns.");
      } else {
        headline = "Optimize conversion path";
        actions.push("Audit landing page load speed and mobile layout.");
      }
      evidence.push("Channel economics are below profitability target.");
      break;

    case "Critical":
      if (input.isPaid) {
        headline = "Stop wasting budget — restructure paid acquisition";
        actions.push("Pause bottom 20% of ad sets by ROAS immediately.");
        actions.push("Consolidate budget into proven winners only.");
        actions.push("Rebuild landing page for paid traffic cohort.");
      } else {
        headline = "Major restructuring required";
        actions.push("Pause non-essential campaigns driving this traffic.");
        actions.push("Fix conversion funnel before increasing volume.");
      }
      evidence.push("Channel is materially unprofitable after fully loaded costs.");
      break;
  }

  const recovery = estimateMonthlyRecovery({
    maxRecoverableMonthly: maxRecoverable,
    gapSeverity,
    confidencePct,
    growthBaseMonthly:
      input.status === "Excellent" && !losing
        ? Math.max(500, (input.netContribution ?? 0) * 0.15)
        : undefined,
  });

  return {
    headline,
    actions,
    evidence,
    recoveryProbabilityPct: recovery.probabilityPct,
    estimatedRecoveryMonthly: recovery.amountMonthly,
  };
}

export function deriveDeviceRecommendation(input: {
  device: string;
  conversionRatePct: number;
  storeCvr: number;
  trafficSharePct: number;
  qualityScore: number;
}): {
  status: TrafficStatusLabel;
  recommendation: string;
  evidence: string[];
} {
  const status = scoreToTrafficStatus(input.qualityScore);
  const cvrGap = input.storeCvr > 0
    ? Math.round(((input.storeCvr - input.conversionRatePct) / input.storeCvr) * 100)
    : 0;
  const evidence = [
    `${input.trafficSharePct.toFixed(0)}% of traffic arrives on ${input.device.toLowerCase()}.`,
    `Conversion is ${input.conversionRatePct.toFixed(1)}% vs ${input.storeCvr.toFixed(1)}% store average.`,
  ];

  if (status === "Excellent" || status === "Good") {
    return { status, recommendation: "Maintain experience — performance is healthy", evidence };
  }
  if (input.device.toLowerCase() === "mobile" && cvrGap > 15) {
    return {
      status: status === "Critical" ? "Critical" : "Needs Attention",
      recommendation: "Improve mobile checkout — reduce steps and field count",
      evidence: [
        ...evidence,
        "Most abandonment happens before checkout on mobile.",
      ],
    };
  }
  return {
    status,
    recommendation: "Optimize layout and page speed for this device",
    evidence,
  };
}
