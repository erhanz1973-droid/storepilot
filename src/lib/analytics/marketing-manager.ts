import type { ProfitDashboard } from "@/lib/profit/types";
import type { ProfitInputId } from "@/lib/profit/types";
import { PROFIT_INPUT_LABELS } from "@/lib/profit/types";
import type { CampaignAttributedProduct } from "@/lib/attribution/product-engine";
import type { ProductAttributionDashboard } from "@/lib/attribution/product-types";
import { getCampaignAttributedProducts } from "@/lib/attribution/product-engine";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { DecisionItem } from "@/lib/decisions/center";
import type { MarketingCampaignRow, MarketingChannel } from "@/lib/analytics/types";
import { buildMarketingCampaigns } from "@/lib/analytics/marketing";
import {
  buildMarketingManagerV2,
  buildExtendedScoreExplanation,
  type MarketingManagerV2,
} from "@/lib/analytics/marketing-manager-v2";
import { estimatePlatformRecoverable } from "@/lib/analytics/recovery-engine";
import { evaluateCampaignRecovery } from "@/lib/analytics/campaign-recovery-engine";
import type { CampaignRecommendationKind } from "@/lib/analytics/marketing-recommendations";

export type { CampaignRecommendationKind } from "@/lib/analytics/marketing-recommendations";
export { RECOMMENDATION_LABELS } from "@/lib/analytics/marketing-recommendations";

export type CampaignHealth =
  | "scaling"
  | "healthy"
  | "monitor"
  | "needs_attention"
  | "losing_money";

export const CAMPAIGN_HEALTH_LABELS: Record<CampaignHealth, string> = {
  scaling: "Profitable",
  healthy: "Profitable",
  monitor: "Needs Attention",
  needs_attention: "At Risk",
  losing_money: "Losing Money",
};

/** Business-facing status copy for merchants (same keys as health). */
export const CAMPAIGN_BUSINESS_STATUS_LABELS = CAMPAIGN_HEALTH_LABELS;

export const CAMPAIGN_HEALTH_EMOJI: Record<CampaignHealth, string> = {
  scaling: "🟢",
  healthy: "🟢",
  monitor: "🟡",
  needs_attention: "🟠",
  losing_money: "🔴",
};

export type ProfitDisplayStatus = "verified" | "estimated" | "unavailable";

export type ProfitDisplay = {
  value: number | null;
  status: ProfitDisplayStatus;
  confidencePct: number;
  missingReasons: string[];
};

export type EnrichedMarketingCampaign = MarketingCampaignRow & {
  health: CampaignHealth;
  recommendation: CampaignRecommendationKind;
  recommendationReason: string;
  recoveryProbabilityPct: number;
  recoveryConfidencePct: number;
  recoveryStage: import("./campaign-recovery-engine").RecoveryStageId;
  recoveryLadder: import("./campaign-recovery-engine").RecoveryLadderStep[];
  isLearningPhase: boolean;
  reEvaluateInDays?: number;
  profitMeta: ProfitDisplay;
  marginMeta: ProfitDisplay;
  attributedRevenue: number;
  shareOfSpendPct: number;
  shareOfRevenuePct: number;
  aiExplanation: string;
  decisionId?: string;
  attributedProducts: CampaignAttributedProduct[];
};

export type PlatformBusinessStatus = "profitable" | "break_even" | "unprofitable" | "unknown";

export type MarketingPlatformSummary = {
  channel: MarketingChannel;
  label: string;
  connected: boolean;
  spend: number;
  revenue: number;
  roas: number;
  profit: number | null;
  profitMeta: ProfitDisplay;
  businessStatus: PlatformBusinessStatus;
  businessStatusLabel: string;
  aiSummary: string;
  recoverableProfitMonthly: number;
  score: number | null;
  scoreExplanation: string[];
  campaignCount: number;
};

export type CampaignComparisonHighlight = {
  id: string;
  label: string;
  campaignId: string;
  campaignName: string;
  metric: string;
  value: string;
};

export type MarketingForecast = {
  estimatedSpend: number;
  estimatedRevenue: number;
  estimatedProfit: number | null;
  profitMeta: ProfitDisplay;
  aiOutlook: string;
  improvementPct: number | null;
};

export type MarketingManagerView = {
  campaigns: EnrichedMarketingCampaign[];
  platforms: MarketingPlatformSummary[];
  comparisons: Record<MarketingChannel, CampaignComparisonHighlight[]>;
  forecast: MarketingForecast;
  v2: MarketingManagerV2;
};

const PLATFORM_LABELS: Record<MarketingChannel, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  tiktok: "TikTok",
  pinterest: "Pinterest",
};

function isChannelConnected(channel: MarketingChannel, snapshot: StoreSnapshot): boolean {
  if (channel === "pinterest") return false;
  const connectorId = CONNECTOR_FOR_CHANNEL[channel];
  const status = snapshot.connectorStates[connectorId];
  return status === "connected" || status === "demo";
}

const CONNECTOR_FOR_CHANNEL: Record<Exclude<MarketingChannel, "pinterest">, keyof StoreSnapshot["connectorStates"]> = {
  meta: "meta_ads",
  google: "google_ads",
  tiktok: "tiktok",
};

function missingReasonsFromProfit(profitDashboard: ProfitDashboard | null): string[] {
  if (!profitDashboard) return ["Connect Shopify for revenue data"];
  return profitDashboard.confidence.missingInputs.map((id) => PROFIT_INPUT_LABELS[id as ProfitInputId]);
}

function buildProfitDisplay(
  value: number | null,
  profitDashboard: ProfitDashboard | null,
  sourceVerified: boolean,
): ProfitDisplay {
  const missingReasons = missingReasonsFromProfit(profitDashboard);
  const conf = profitDashboard?.confidence;

  if (conf?.status === "unavailable" || value == null) {
    return {
      value: null,
      status: "unavailable",
      confidencePct: conf?.scorePct ?? 0,
      missingReasons: missingReasons.length ? missingReasons : ["Profit data not available"],
    };
  }

  if (!sourceVerified || !conf || conf.status === "estimated") {
    return {
      value,
      status: "estimated",
      confidencePct: conf?.scorePct ?? 0,
      missingReasons,
    };
  }

  return {
    value,
    status: "verified",
    confidencePct: 100,
    missingReasons: [],
  };
}

function marginFromProfit(revenue: number, profit: number | null): number | null {
  if (profit == null || revenue <= 0) return null;
  return Math.round((profit / revenue) * 1000) / 10;
}

function deriveHealth(
  roas: number,
  profit: number | null,
  spend: number,
): CampaignHealth {
  if (spend < 50) return "monitor";
  if (profit != null && profit < 0) return "losing_money";
  if (roas < 0.8) return "losing_money";
  if (roas < 1.0) return "needs_attention";
  if (roas < 1.5) return "monitor";
  if (roas >= 2.5 && (profit == null || profit > 0)) return "scaling";
  if (roas >= 1.5) return "healthy";
  return "monitor";
}

function findCampaignDecision(
  campaignId: string,
  decisions: DecisionItem[],
): DecisionItem | undefined {
  return decisions.find(
    (d) =>
      d.entityType === "campaign" &&
      d.entityId === campaignId &&
      (d.status === "open" || d.status === "viewed"),
  );
}

function deriveRecommendation(
  health: CampaignHealth,
  row: MarketingCampaignRow,
  snapshot: StoreSnapshot,
  profitMeta: ProfitDisplay,
  decision?: DecisionItem,
): {
  kind: CampaignRecommendationKind;
  reason: string;
  recovery: ReturnType<typeof evaluateCampaignRecovery>;
} {
  const recovery = evaluateCampaignRecovery({
    row,
    health,
    profitMeta,
    snapshot,
    decision,
  });

  return {
    kind: recovery.recommendation,
    reason: recovery.recommendationReason,
    recovery,
  };
}

function estimateProfit(
  revenue: number,
  spend: number,
  marginRate: number,
): number {
  return Math.round((revenue * marginRate - spend) * 100) / 100;
}

function enrichCampaign(
  row: MarketingCampaignRow,
  totals: { spend: number; revenue: number },
  profitDashboard: ProfitDashboard | null,
  marginRate: number,
  decisions: DecisionItem[],
  productAttribution: ProductAttributionDashboard | null,
  snapshot: StoreSnapshot,
): EnrichedMarketingCampaign {
  let profit: number | null = row.profit;
  const sourceVerified = !row.profitEstimated && profit !== 0;

  if (row.profitEstimated) {
    if (marginRate > 0 && row.revenue > 0) {
      profit = estimateProfit(row.revenue, row.spend, marginRate);
    } else if (row.revenue > 0) {
      profit = estimateProfit(row.revenue, row.spend, 0.25);
    } else {
      profit = null;
    }
  }

  const profitMeta = buildProfitDisplay(profit, profitDashboard, sourceVerified);
  const margin = marginFromProfit(row.revenue, profitMeta.value);
  const marginMeta: ProfitDisplay =
    profitMeta.status === "unavailable"
      ? profitMeta
      : {
          value: margin,
          status: profitMeta.status,
          confidencePct: profitMeta.confidencePct,
          missingReasons: profitMeta.missingReasons,
        };

  const decision = findCampaignDecision(row.id, decisions);
  const health = deriveHealth(row.roas, profitMeta.value, row.spend);
  const { kind, reason, recovery } = deriveRecommendation(
    health,
    row,
    snapshot,
    profitMeta,
    decision,
  );

  const recoverable =
    recovery.recommendation === "pause_campaign" && profitMeta.value != null && profitMeta.value < 0
      ? Math.abs(profitMeta.value) * 4.33
      : recovery.recoveryProbabilityPct > 40
        ? Math.round(row.spend * 0.2 * 4.33)
        : 0;

  return {
    ...row,
    profit: profitMeta.value ?? 0,
    margin: margin ?? 0,
    profitEstimated: profitMeta.status !== "verified",
    attributedRevenue: row.revenue,
    shareOfSpendPct: totals.spend > 0 ? Math.round((row.spend / totals.spend) * 1000) / 10 : 0,
    shareOfRevenuePct: totals.revenue > 0 ? Math.round((row.revenue / totals.revenue) * 1000) / 10 : 0,
    health,
    recommendation: kind,
    recommendationReason: reason,
    recoveryProbabilityPct: recovery.recoveryProbabilityPct,
    recoveryConfidencePct: recovery.confidencePct,
    recoveryStage: recovery.recoveryStage,
    recoveryLadder: recovery.recoveryLadder,
    isLearningPhase: recovery.isLearningPhase,
    reEvaluateInDays: recovery.reEvaluateInDays,
    profitMeta,
    marginMeta,
    aiExplanation: [
      `Campaign spent $${row.spend.toLocaleString()} over the last 7 days.`,
      `Attributed revenue: $${row.revenue.toLocaleString()} (ROAS ${row.roas.toFixed(2)}).`,
      profitMeta.value != null
        ? `Estimated profit after advertising: $${profitMeta.value.toLocaleString()}.`
        : "Profit cannot be calculated until product costs are configured.",
      `Recovery probability: ${recovery.recoveryProbabilityPct}%.`,
      reason,
      recoverable > 0 ? `Optimization could recover ~$${Math.round(recoverable).toLocaleString()}/month.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    decisionId: decision?.id,
    attributedProducts: productAttribution
      ? getCampaignAttributedProducts(productAttribution, row.id)
      : [],
  };
}

function businessStatus(
  profit: number | null,
  roas: number,
): { status: PlatformBusinessStatus; label: string } {
  if (profit == null) {
    if (roas >= 1.5) return { status: "break_even", label: "Needs cost data" };
    if (roas < 1) return { status: "unprofitable", label: "Unprofitable" };
    return { status: "unknown", label: "Unknown" };
  }
  if (profit > 100) return { status: "profitable", label: "Profitable" };
  if (profit >= -100) return { status: "break_even", label: "Break-even" };
  return { status: "unprofitable", label: "Unprofitable" };
}

function computePlatformScore(
  campaigns: EnrichedMarketingCampaign[],
  connected: boolean,
): { score: number | null; explanation: string[] } {
  if (!connected) {
    return { score: null, explanation: ["Platform not connected"] };
  }
  if (campaigns.length === 0) {
    return { score: null, explanation: ["No campaigns synced yet"] };
  }

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const weightedRoas =
    totalSpend > 0
      ? campaigns.reduce((s, c) => s + c.roas * c.spend, 0) / totalSpend
      : 0;
  const withProfit = campaigns.filter((c) => c.profitMeta.value != null);
  const profitablePct =
    withProfit.length > 0
      ? (withProfit.filter((c) => (c.profitMeta.value ?? 0) > 0).length / withProfit.length) * 100
      : weightedRoas >= 1.5
        ? 60
        : 30;

  const roasScore = Math.min(45, weightedRoas * 18);
  const profitScore = profitablePct * 0.4;
  const coverageScore = Math.min(15, campaigns.length * 3);
  const score = Math.round(Math.min(100, roasScore + profitScore + coverageScore));

  return {
    score,
    explanation: [
      `Blended ROAS: ${weightedRoas.toFixed(2)} (weight: ${Math.round(roasScore)} pts)`,
      `Profitable campaigns: ${Math.round(profitablePct)}% (weight: ${Math.round(profitScore)} pts)`,
      `${campaigns.length} active campaigns tracked`,
    ],
  };
}

function buildPlatformSummary(
  channel: MarketingChannel,
  campaigns: EnrichedMarketingCampaign[],
  snapshot: StoreSnapshot,
  profitDashboard: ProfitDashboard | null,
): MarketingPlatformSummary {
  const connected = isChannelConnected(channel, snapshot);
  const spend = campaigns.reduce((s, c) => s + c.spend, 0);
  const revenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const roas = spend > 0 ? revenue / spend : 0;
  const profitValues = campaigns
    .map((c) => c.profitMeta.value)
    .filter((v): v is number => v != null);
  const profit = profitValues.length ? profitValues.reduce((a, b) => a + b, 0) : null;
  const profitMeta = buildProfitDisplay(profit, profitDashboard, profitValues.length > 0);
  const biz = businessStatus(profit, roas);

  const losing = campaigns.filter((c) => c.health === "losing_money" || c.health === "needs_attention");
  const losingWeeklyProfit = losing.reduce((s, c) => {
    const p = c.profitMeta.value;
    return s + (p != null && p < 0 ? p : 0);
  }, 0);
  const atRiskWeeklySpend = losing.reduce((s, c) => s + c.spend, 0);
  const avgRecoveryProbabilityPct =
    losing.length > 0
      ? losing.reduce((sum, c) => sum + c.recoveryProbabilityPct, 0) / losing.length
      : 50;
  const recoverable = estimatePlatformRecoverable({
    losingWeeklyProfit,
    atRiskWeeklySpend,
    avgRecoveryProbabilityPct,
  });

  let aiSummary =
    campaigns.length === 0
      ? `Connect ${PLATFORM_LABELS[channel]} to see campaign profitability.`
      : biz.status === "unprofitable"
        ? `Most of your ${PLATFORM_LABELS[channel]} budget is going to campaigns below your profitability target.`
        : biz.status === "profitable"
          ? `${PLATFORM_LABELS[channel]} is contributing positive estimated profit this week.`
          : `${PLATFORM_LABELS[channel]} performance is mixed — focus on underperforming campaigns first.`;

  const { score, explanation } = computePlatformScore(campaigns, connected);

  return {
    channel,
    label: PLATFORM_LABELS[channel],
    connected,
    spend,
    revenue,
    roas,
    profit,
    profitMeta,
    businessStatus: biz.status,
    businessStatusLabel: biz.label,
    aiSummary,
    recoverableProfitMonthly: recoverable,
    score,
    scoreExplanation: explanation,
    campaignCount: campaigns.length,
  };
}

function buildComparisons(campaigns: EnrichedMarketingCampaign[]): CampaignComparisonHighlight[] {
  if (campaigns.length === 0) return [];

  const byProfit = [...campaigns].sort(
    (a, b) => (b.profitMeta.value ?? -Infinity) - (a.profitMeta.value ?? -Infinity),
  );
  const byRoas = [...campaigns].sort((a, b) => b.roas - a.roas);
  const bySpend = [...campaigns].sort((a, b) => b.spend - a.spend);
  const byCpa = [...campaigns].filter((c) => c.cpa > 0).sort((a, b) => a.cpa - b.cpa);
  const worst = [...campaigns].sort(
    (a, b) => (a.profitMeta.value ?? 0) - (b.profitMeta.value ?? 0),
  )[0];

  const best = byProfit[0];
  const highlights: CampaignComparisonHighlight[] = [];

  if (best) {
    highlights.push({
      id: "best",
      label: "Best Campaign",
      campaignId: best.id,
      campaignName: best.campaign,
      metric: "Profit / ROAS",
      value:
        best.profitMeta.value != null
          ? `$${Math.round(best.profitMeta.value).toLocaleString()}`
          : best.roas.toFixed(2),
    });
  }
  if (worst) {
    highlights.push({
      id: "worst",
      label: "Worst Campaign",
      campaignId: worst.id,
      campaignName: worst.campaign,
      metric: "Profit",
      value:
        worst.profitMeta.value != null
          ? `$${Math.round(worst.profitMeta.value).toLocaleString()}`
          : `ROAS ${worst.roas.toFixed(2)}`,
    });
  }
  if (byRoas[0]) {
    highlights.push({
      id: "roas",
      label: "Highest ROAS",
      campaignId: byRoas[0].id,
      campaignName: byRoas[0].campaign,
      metric: "ROAS",
      value: byRoas[0].roas.toFixed(2),
    });
  }
  if (bySpend[0]) {
    highlights.push({
      id: "spend",
      label: "Highest Spend",
      campaignId: bySpend[0].id,
      campaignName: bySpend[0].campaign,
      metric: "Spend",
      value: `$${Math.round(bySpend[0].spend).toLocaleString()}`,
    });
  }
  if (byCpa[0]) {
    highlights.push({
      id: "cpa",
      label: "Lowest CPA",
      campaignId: byCpa[0].id,
      campaignName: byCpa[0].campaign,
      metric: "CPA",
      value: `$${byCpa[0].cpa.toFixed(0)}`,
    });
  }

  return highlights;
}

function buildForecast(
  campaigns: EnrichedMarketingCampaign[],
  profitDashboard: ProfitDashboard | null,
): MarketingForecast {
  const scale = 30 / 7;
  const estimatedSpend = Math.round(campaigns.reduce((s, c) => s + c.spend, 0) * scale);
  const estimatedRevenue = Math.round(campaigns.reduce((s, c) => s + c.revenue, 0) * scale);
  const profit7d = campaigns
    .map((c) => c.profitMeta.value)
    .filter((v): v is number => v != null)
    .reduce((a, b) => a + b, 0);
  const estimatedProfit = profit7d !== 0 ? Math.round(profit7d * scale) : null;

  const topRecs = [...campaigns]
    .filter(
      (c) =>
        c.recommendation === "pause_campaign" ||
        c.recommendation === "reduce_budget" ||
        c.recommendation === "optimize_campaign",
    )
    .sort((a, b) => (a.profitMeta.value ?? 0) - (b.profitMeta.value ?? 0))
    .slice(0, 3);
  const recovery = topRecs.reduce((s, c) => {
    const p = c.profitMeta.value;
    return s + (p != null && p < 0 ? Math.abs(p) * 4.33 : c.spend * 0.12 * 4.33);
  }, 0);
  const improvementPct =
    estimatedProfit != null && estimatedProfit < 0 && recovery > 0
      ? Math.min(50, Math.round((recovery / Math.abs(estimatedProfit)) * 100))
      : topRecs.length > 0
        ? 18
        : null;

  const profitMeta = buildProfitDisplay(estimatedProfit, profitDashboard, profit7d !== 0);

  const aiOutlook =
    topRecs.length > 0 && improvementPct != null
      ? `AI expects profitability to improve by approximately ${improvementPct}% if the top ${topRecs.length} recommendation(s) are implemented.`
      : campaigns.length > 0
        ? "Maintain winners and optimize underperformers before pausing to improve blended profitability."
        : "Connect advertising platforms to generate a marketing forecast.";

  return {
    estimatedSpend,
    estimatedRevenue,
    estimatedProfit,
    profitMeta,
    aiOutlook,
    improvementPct,
  };
}

export function buildMarketingManagerView(input: {
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  productAttribution?: ProductAttributionDashboard | null;
  decisions?: DecisionItem[];
}): MarketingManagerView {
  const base = buildMarketingCampaigns(input.snapshot);
  const profitDashboard = input.profitDashboard ?? null;
  const productAttribution = input.productAttribution ?? null;
  const decisions = input.decisions ?? [];
  const rev = profitDashboard?.primary.revenue ?? 0;
  const net = profitDashboard?.primary.netProfit ?? 0;
  const marginRate = rev > 0 && net != null ? net / rev : 0.25;

  const totals = {
    spend: base.reduce((s, c) => s + c.spend, 0),
    revenue: base.reduce((s, c) => s + c.revenue, 0),
  };

  const campaigns = base.map((row) =>
    enrichCampaign(row, totals, profitDashboard, marginRate, decisions, productAttribution, input.snapshot),
  );

  const channels: MarketingChannel[] = ["meta", "google", "tiktok", "pinterest"];
  const platforms = channels.map((ch) =>
    buildPlatformSummary(
      ch,
      campaigns.filter((c) => c.channel === ch),
      input.snapshot,
      profitDashboard,
    ),
  );

  const comparisons = Object.fromEntries(
    channels.map((ch) => [ch, buildComparisons(campaigns.filter((c) => c.channel === ch))]),
  ) as Record<MarketingChannel, CampaignComparisonHighlight[]>;

  const forecast = buildForecast(campaigns, profitDashboard);

  const platformsWithScores = platforms.map((p) => ({
    ...p,
    scoreExplanation: buildExtendedScoreExplanation(p, campaigns, input.snapshot),
  }));

  const v2 = buildMarketingManagerV2({
    snapshot: input.snapshot,
    platforms: platformsWithScores,
    campaigns,
    forecast,
    decisions,
  });

  return {
    campaigns,
    platforms: platformsWithScores,
    comparisons,
    forecast,
    v2,
  };
}
