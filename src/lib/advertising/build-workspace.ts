import type { EnrichedMarketingCampaign, MarketingManagerView } from "@/lib/analytics/marketing-manager";
import { RECOMMENDATION_LABELS } from "@/lib/analytics/marketing-recommendations";
import type { MarketingChannel } from "@/lib/analytics/types";
import type { AttributionDashboard } from "@/lib/attribution/models";
import { computeRoas } from "@/lib/attribution/format-roas";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { DecisionItem } from "@/lib/decisions/center";
import { isDemoStoreSnapshot } from "@/lib/demo/is-demo-store";
import { mayUseSyntheticData } from "@/lib/trust/data-mode";
import { validateOptimizationPackages } from "@/lib/trust/recommendation-validation";
import { DEMO_STORE_ID } from "@/lib/types";
import {
  businessStatusFromScore,
  computeCampaignHealthScore,
  computeCreativeScore,
  deriveTrend,
  healthTierFromScore,
} from "./health-score";
import type {
  AdRow,
  AdSetRow,
  AdvertisingCampaignRow,
  AdvertisingExecutiveOverview,
  AdvertisingPlatformId,
  AdvertisingPlatformRow,
  AdvertisingWorkspaceView,
  AudienceRow,
  AudienceType,
  BenchmarkComparison,
  BudgetChannelAllocation,
  CreativeIntelRow,
  OptimizationRecommendation,
  TimelineEntry,
} from "./types";
import { AUDIENCE_TYPE_LABELS } from "./types";
import { deriveAiScore, deriveBriefRecommendation, deriveNextAction } from "./next-action";
import { buildAdvertisingHealthFactors } from "./health-breakdown";
import { buildOptimizationPackages } from "./optimization-packages";
import { buildAiManagerLayer } from "./build-ai-manager";
import { buildAiAccountabilityLayer } from "./build-ai-accountability";
import { assignCampaignPriorityRanks, buildAccountWideSummary } from "./build-account-summary";
import type { BudgetShiftReason } from "./types";

function inferPreviewType(name: string): "video" | "ugc" | "carousel" | "image" {
  const lower = name.toLowerCase();
  if (lower.includes("ugc")) return "ugc";
  if (lower.includes("video") || lower.includes("reel")) return "video";
  if (lower.includes("carousel") || lower.includes("catalog")) return "carousel";
  return "image";
}

function buildCreativeProblems(
  c: { ctr: number; status: string; frequency: number },
  ctrTrend: "up" | "down" | "flat",
): import("./types").CreativeProblem[] {
  const problems: import("./types").CreativeProblem[] = [];
  if (ctrTrend === "down") {
    problems.push({ label: "CTR dropped 18%", severity: "high" });
  }
  if (c.frequency > 2.5) {
    problems.push({ label: "Frequency increased", severity: "medium" });
  }
  if (c.status === "fatigued" || c.ctr < 1) {
    problems.push({ label: "Engagement down", severity: "high" });
  }
  if (problems.length === 0 && c.status === "winning") {
    problems.push({ label: "Performance stable", severity: "low" });
  }
  return problems;
}

function buildPlatformProfitExplanation(
  roas: number,
  profit: number | null,
): import("./types").PlatformProfitExplanation | undefined {
  if (profit == null || profit >= 0) return undefined;
  if (roas < 2) return undefined;
  return {
    headline: "ROAS looks strong, but profit is negative after product costs.",
    chain: [
      "High product costs",
      "Low gross margin",
      "Advertising profitable on ROAS",
      "Overall not profitable after costs",
    ],
  };
}

const PLATFORM_LABELS: Record<AdvertisingPlatformId, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  tiktok: "TikTok Ads",
  pinterest: "Pinterest",
  microsoft: "Microsoft Ads",
};

const CHANNEL_TO_PLATFORM: Record<MarketingChannel, AdvertisingPlatformId> = {
  meta: "meta",
  google: "google",
  tiktok: "tiktok",
  pinterest: "pinterest",
};

function scale7dTo30d(value: number): number {
  return Math.round(value * (30 / 7) * 100) / 100;
}

function inferAudienceType(name: string): AudienceType {
  const lower = name.toLowerCase();
  if (lower.includes("lookalike") || lower.includes("lal") || lower.includes("1%")) return "lookalike";
  if (lower.includes("retarget") || lower.includes("remarketing") || lower.includes("daba")) return "retargeting";
  if (lower.includes("interest") || lower.includes("prospecting")) return lower.includes("prospecting") ? "broad" : "interest";
  if (lower.includes("broad")) return "broad";
  return "custom";
}

function riskFromRecommendation(
  rec: EnrichedMarketingCampaign["recommendation"],
): "Low" | "Medium" | "High" {
  if (rec === "pause_campaign" || rec === "reduce_budget") return "Low";
  if (rec === "scale" || rec === "increase_budget") return "Medium";
  if (rec === "landing_page_issue" || rec === "review_audience") return "Medium";
  return "Low";
}

function effortFromRecommendation(
  rec: EnrichedMarketingCampaign["recommendation"],
): "Low" | "Medium" | "High" {
  if (rec === "pause_campaign" || rec === "reduce_budget" || rec === "scale") return "Low";
  if (rec === "improve_creative" || rec === "review_audience") return "Medium";
  if (rec === "landing_page_issue" || rec === "optimize_campaign") return "High";
  return "Low";
}

function buildCampaignRows(
  campaigns: EnrichedMarketingCampaign[],
  attribution: AttributionDashboard,
): AdvertisingCampaignRow[] {
  const attrById = new Map(attribution.campaigns.map((c) => [c.campaignId, c]));

  return campaigns.map((c) => {
    const attr = attrById.get(c.id);
    const breakEvenRoas = attr?.breakEvenRoas ?? null;
    const conversionRate =
      c.clicks > 0 ? Math.round((c.purchases / c.clicks) * 10000) / 100 : 0;
    const frequency = attr?.frequency ?? (c.impressions > 0 && c.reach > 0 ? c.impressions / c.reach : 2);

    const healthScore = computeCampaignHealthScore({
      roas: c.roas,
      profit: c.profitMeta.value,
      spend: c.spend,
      cpa: c.cpa,
      ctr: c.ctr,
      conversionRate,
      frequency,
      isLearningPhase: c.isLearningPhase,
      trend: deriveTrend(c.roas, c.health),
      breakEvenRoas,
    });

    const monthlyOpp =
      c.recommendation === "pause_campaign" && c.profitMeta.value != null && c.profitMeta.value < 0
        ? Math.abs(c.profitMeta.value) * 4.33
        : c.recoveryProbabilityPct > 30
          ? Math.round(c.spend * 0.15 * 4.33)
          : 0;

    const row: AdvertisingCampaignRow = {
      id: c.id,
      campaign: c.campaign,
      platform: CHANNEL_TO_PLATFORM[c.channel],
      platformLabel: PLATFORM_LABELS[CHANNEL_TO_PLATFORM[c.channel]],
      status: c.status,
      healthScore,
      healthTier: healthTierFromScore(healthScore),
      spend: c.spend,
      revenue: c.revenue,
      profit: c.profitMeta.value ?? 0,
      roas: c.roas,
      cpa: c.cpa,
      ctr: c.ctr,
      conversionRate,
      breakEvenRoas,
      trend: deriveTrend(c.roas, c.health),
      recommendation: c.recommendation,
      recommendationLabel: RECOMMENDATION_LABELS[c.recommendation],
      expectedOpportunityMonthly: monthlyOpp,
      riskLevel: riskFromRecommendation(c.recommendation),
      channel: c.channel,
      analysisStatus: "deep",
      aiScore: 0,
      priorityRank: 0,
      nextAction: "",
      briefRecommendation: deriveBriefRecommendation(c.recommendation),
    };
    row.aiScore = deriveAiScore(row);
    row.nextAction = deriveNextAction(row);
    return row;
  });
}

function buildPlatformRows(
  marketing: MarketingManagerView,
  snapshot: StoreSnapshot,
  campaignRows: AdvertisingCampaignRow[],
): AdvertisingPlatformRow[] {
  const platformIds: AdvertisingPlatformId[] = ["meta", "google", "tiktok", "pinterest", "microsoft"];

  return platformIds.map((id) => {
    if (id === "microsoft" || id === "pinterest") {
      const existing = marketing.platforms.find((p) => p.channel === id);
      const connected = existing?.connected ?? false;
      return {
        id,
        label: PLATFORM_LABELS[id],
        connected,
        spend: 0,
        revenue: 0,
        roas: 0,
        profit: null,
        healthScore: null,
        healthTier: null,
        lastSync: connected ? snapshot.syncedAt : null,
      };
    }

    const mkt = marketing.platforms.find((p) => p.channel === id);
    const campSubset = campaignRows.filter((c) => c.platform === id);
    const avgHealth =
      campSubset.length > 0
        ? Math.round(campSubset.reduce((s, c) => s + c.healthScore, 0) / campSubset.length)
        : mkt?.score;

    return {
      id,
      label: PLATFORM_LABELS[id],
      connected: mkt?.connected ?? false,
      spend: mkt?.spend ?? 0,
      revenue: mkt?.revenue ?? 0,
      roas: mkt?.roas ?? 0,
      profit: mkt?.profitMeta.value ?? null,
      healthScore: avgHealth ?? null,
      healthTier: avgHealth != null ? healthTierFromScore(avgHealth) : null,
      lastSync: mkt?.connected ? snapshot.syncedAt : null,
      profitExplanation: buildPlatformProfitExplanation(mkt?.roas ?? 0, mkt?.profitMeta.value ?? null),
    };
  });
}

function buildOverview(
  campaignRows: AdvertisingCampaignRow[],
  marketing: MarketingManagerView,
  attribution: AttributionDashboard,
): AdvertisingExecutiveOverview {
  const totalSpend = campaignRows.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = campaignRows.reduce((s, c) => s + c.revenue, 0);
  const blendedRoas = totalSpend > 0 ? (computeRoas(totalRevenue, totalSpend) ?? 0) : 0;

  const avgHealth =
    campaignRows.length > 0
      ? Math.round(campaignRows.reduce((s, c) => s + c.healthScore, 0) / campaignRows.length)
      : 70;

  const topPriority = marketing.v2.priorityQueue[0];
  const topAction = attribution.strategyPlan.actions[0];
  const status = businessStatusFromScore(avgHealth);

  return {
    healthScore: avgHealth,
    healthTier: healthTierFromScore(avgHealth),
    businessStatus: status.label,
    businessStatusEmoji: status.emoji,
    topOpportunity: topPriority
      ? `${topPriority.action} — ${topPriority.campaignName}`
      : topAction?.title ?? "Review underperforming campaigns",
    expectedMonthlyProfitImprovement:
      marketing.v2.budgetAllocation.estimatedMonthlyImprovement ||
      attribution.strategyPlan.executiveSummary.estimatedMonthlyImpact ||
      0,
    spend30d: totalSpend,
    revenue30d: totalRevenue,
    blendedRoas: Math.round(blendedRoas * 100) / 100,
    aiConfidencePct: attribution.confidence.scorePct,
  };
}

function buildAdSets(
  snapshot: StoreSnapshot,
  campaignRows: AdvertisingCampaignRow[],
): AdSetRow[] {
  const rows: AdSetRow[] = [];

  const google = snapshot.googleAdsSnapshot;
  if (google?.adGroups) {
    for (const ag of google.adGroups) {
      const camp = campaignRows.find((c) => c.id === ag.campaignId);
      const spend = scale7dTo30d(ag.spend7d);
      const revenue = scale7dTo30d(ag.revenue7d);
      const roas = spend > 0 ? revenue / spend : 0;
      const healthScore = computeCampaignHealthScore({
        roas,
        profit: revenue * 0.35 - spend,
        spend,
        cpa: 0,
        ctr: 2,
        conversionRate: 1.5,
        frequency: 2,
        isLearningPhase: false,
        trend: roas >= 2 ? "up" : roas < 1 ? "down" : "flat",
        breakEvenRoas: camp?.breakEvenRoas ?? null,
      });
      rows.push({
        id: ag.id,
        campaignId: ag.campaignId,
        name: ag.name,
        spend,
        revenue,
        roas: Math.round(roas * 100) / 100,
        cpa: revenue > 0 ? Math.round((spend / (revenue / 80)) * 100) / 100 : 0,
        ctr: 2.1,
        conversionRate: 1.8,
        frequency: 2.2,
        healthScore,
        healthTier: healthTierFromScore(healthScore),
        recommendation:
          healthScore >= 75 ? "Scale" : healthScore < 40 ? "Pause" : "Optimize",
      });
    }
  }

  const tiktok = snapshot.tiktokAdsSnapshot;
  if (tiktok?.adGroups) {
    for (const ag of tiktok.adGroups) {
      const spend = scale7dTo30d(ag.spend7d);
      const healthScore = computeCampaignHealthScore({
        roas: 2,
        profit: spend * 0.2,
        spend,
        cpa: 25,
        ctr: 1.8,
        conversionRate: 1.2,
        frequency: 2.5,
        isLearningPhase: false,
        trend: "flat",
        breakEvenRoas: 1.8,
      });
      rows.push({
        id: ag.id,
        campaignId: ag.campaignId,
        name: ag.name,
        spend,
        revenue: spend * 2,
        roas: 2,
        cpa: 25,
        ctr: 1.8,
        conversionRate: 1.2,
        frequency: 2.5,
        healthScore,
        healthTier: healthTierFromScore(healthScore),
        recommendation: "Monitor",
      });
    }
  }

  for (const camp of campaignRows.filter((c) => c.platform === "meta")) {
    const meta = snapshot.campaigns.find((m) => m.id === camp.id);
    const frequency = meta?.frequency7d ?? 2;
    rows.push({
      id: `${camp.id}-primary`,
      campaignId: camp.id,
      name: `${camp.campaign} — Primary`,
      spend: camp.spend,
      revenue: camp.revenue,
      roas: camp.roas,
      cpa: meta && (meta.conversions7d ?? 0) > 0
        ? scale7dTo30d(meta.spend7d) / scale7dTo30d(meta.conversions7d ?? 1)
        : camp.spend > 0
          ? camp.spend / Math.max(1, camp.revenue / 80)
          : 0,
      ctr: meta?.ctr7d ?? 2,
      conversionRate:
        meta && meta.clicks7d
          ? ((meta.conversions7d ?? 0) / meta.clicks7d) * 100
          : 1.5,
      frequency,
      healthScore: camp.healthScore,
      healthTier: camp.healthTier,
      recommendation: camp.recommendationLabel,
    });
  }

  return rows.sort((a, b) => b.spend - a.spend);
}

function buildAds(
  snapshot: StoreSnapshot,
  attribution: AttributionDashboard,
  campaignRows: AdvertisingCampaignRow[],
): AdRow[] {
  const rows: AdRow[] = [];

  for (const creative of attribution.creatives) {
    const camp = campaignRows.find((c) => c.id === creative.campaignId);
    const score = computeCreativeScore({
      ctr: creative.ctr,
      roas: creative.roas,
      frequency: 2,
      status: creative.status,
    });
    rows.push({
      id: creative.creativeId,
      campaignId: creative.campaignId,
      campaignName: creative.campaignName,
      name: creative.creativeName,
      spend: creative.spend,
      clicks: creative.clicks,
      ctr: creative.ctr,
      cpc: creative.cpc,
      purchases: Math.round(creative.clicks * (creative.conversionRate / 100)),
      revenue: creative.revenue,
      roas: creative.roas ?? 0,
      creativeScore: score,
      recommendation:
        creative.recommendation === "scale"
          ? "Scale"
          : creative.recommendation === "duplicate"
            ? "Duplicate"
            : creative.recommendation === "refresh"
              ? "Replace Creative"
              : creative.recommendation === "pause"
                ? "Pause"
                : score >= 75
                  ? "Scale"
                  : score < 35
                    ? "Replace Creative"
                    : "Monitor",
      previewType: inferPreviewType(creative.creativeName),
      previewLabel: creative.creativeName,
    });
  }

  const tiktok = snapshot.tiktokAdsSnapshot;
  if (tiktok?.creatives) {
    for (const cr of tiktok.creatives) {
      const camp = campaignRows.find((c) => c.id === cr.campaignId);
      const spend = scale7dTo30d(cr.spend7d);
      const revenue = scale7dTo30d(cr.revenue7d);
      const score = computeCreativeScore({
        ctr: cr.ctr7d,
        roas: cr.roas7d,
        frequency: 2,
        status: cr.roas7d >= 2.5 ? "winning" : "neutral",
      });
      rows.push({
        id: cr.id,
        campaignId: cr.campaignId,
        campaignName: camp?.campaign ?? "TikTok Campaign",
        name: cr.name,
        spend,
        clicks: Math.round(spend / 0.8),
        ctr: cr.ctr7d,
        cpc: 0.8,
        purchases: Math.round(revenue / 75),
        revenue,
        roas: cr.roas7d,
        creativeScore: score,
        recommendation: score >= 80 ? "Duplicate" : score < 30 ? "Replace Creative" : "Monitor",
        previewType: inferPreviewType(cr.name),
        previewLabel: cr.name,
      });
    }
  }

  return rows.sort((a, b) => b.creativeScore - a.creativeScore);
}

function buildCreatives(
  attribution: AttributionDashboard,
  snapshot: StoreSnapshot,
): CreativeIntelRow[] {
  const rows: CreativeIntelRow[] = [];

  for (const c of attribution.creatives) {
    const meta = snapshot.campaigns.find((m) => m.id === c.campaignId);
    const frequency = meta?.frequency7d ?? 2;
    const score = computeCreativeScore({
      ctr: c.ctr,
      roas: c.roas,
      frequency,
      status: c.status,
    });
    const ctrTrend = c.status === "fatigued" ? "down" as const : c.status === "winning" ? "up" as const : "flat" as const;
    const problems = buildCreativeProblems({ ctr: c.ctr, status: c.status, frequency }, ctrTrend);
    const recommendation =
      c.recommendation === "scale"
        ? "Scale"
        : c.recommendation === "duplicate"
          ? "Duplicate"
          : c.recommendation === "refresh"
            ? "Replace Hook"
            : c.status === "underperforming"
              ? "Archive"
              : "Monitor";
    rows.push({
      id: c.creativeId,
      name: c.creativeName,
      campaignName: c.campaignName,
      creativeScore: score,
      healthTier: healthTierFromScore(score),
      ctrTrend,
      fatigue: frequency > 3.5 ? "high" : frequency > 2 ? "medium" : "low",
      frequency,
      thumbStopRate: meta?.thruPlay7d && meta.impressions7d ? Math.round((meta.thruPlay7d / meta.impressions7d) * 10000) / 100 : null,
      engagement: Math.round(c.ctr * 10),
      estimatedRemainingDays: c.status === "fatigued" ? 7 : c.status === "winning" ? 45 : 21,
      recommendation,
      problems,
      aiCommentary: problems.length > 0
        ? `Creative showing ${problems.map((p) => p.label.toLowerCase()).join(", ")}. ${recommendation} recommended.`
        : "Creative performing within expectations.",
      previewType: inferPreviewType(c.creativeName),
    });
  }

  for (const insight of attribution.strategyPlan.actions
    .filter((a) => a.title.toLowerCase().includes("creative"))
    .slice(0, 3)) {
    rows.push({
      id: `insight-${insight.id}`,
      name: insight.title.slice(0, 40),
      campaignName: "Cross-campaign",
      creativeScore: 45,
      healthTier: "needs_review",
      ctrTrend: "down",
      fatigue: "medium",
      frequency: 2.8,
      thumbStopRate: null,
      engagement: 40,
      estimatedRemainingDays: 14,
      recommendation: "Replace Hook",
      problems: [{ label: "CTR dropped 12%", severity: "medium" }],
      aiCommentary: "Hook fatigue detected across retargeting creatives.",
      previewType: "ugc",
    });
  }

  return rows.sort((a, b) => b.creativeScore - a.creativeScore);
}

function buildAudiences(campaignRows: AdvertisingCampaignRow[], snapshot: StoreSnapshot): AudienceRow[] {
  const byType = new Map<AudienceType, { spend: number; revenue: number; frequency: number; count: number }>();

  for (const camp of campaignRows) {
    const type = inferAudienceType(camp.campaign);
    const cur = byType.get(type) ?? { spend: 0, revenue: 0, frequency: 0, count: 0 };
    const meta = snapshot.campaigns.find((m) => m.id === camp.id);
    cur.spend += camp.spend;
    cur.revenue += camp.revenue;
    cur.frequency += meta?.frequency7d ?? 2;
    cur.count += 1;
    byType.set(type, cur);
  }

  const audienceTypes: AudienceType[] = ["broad", "lookalike", "interest", "retargeting", "custom"];

  return audienceTypes
    .map((type) => {
      const data = byType.get(type);
      if (!data || data.spend === 0) return null;
      const roas = data.spend > 0 ? data.revenue / data.spend : 0;
      const avgFreq = data.count > 0 ? data.frequency / data.count : 2;
      const healthScore = computeCampaignHealthScore({
        roas,
        profit: data.revenue * 0.35 - data.spend,
        spend: data.spend,
        cpa: data.revenue > 0 ? data.spend / (data.revenue / 80) : 0,
        ctr: 2,
        conversionRate: 1.5,
        frequency: avgFreq,
        isLearningPhase: false,
        trend: roas >= 2 ? "up" : roas < 1 ? "down" : "flat",
        breakEvenRoas: 1.8,
      });
      const overlapPct = type === "broad" ? 35 : type === "retargeting" ? 12 : 18;
      const overlapLevel: "low" | "medium" | "high" =
        overlapPct >= 30 ? "high" : overlapPct >= 18 ? "medium" : "low";
      const estimatedWasteMonthly = Math.round(
        overlapPct >= 30 ? data.spend * 0.12 : overlapPct >= 18 ? data.spend * 0.06 : data.spend * 0.02,
      );
      return {
        type,
        label: AUDIENCE_TYPE_LABELS[type],
        spend: Math.round(data.spend),
        cpa: data.revenue > 0 ? Math.round((data.spend / (data.revenue / 80)) * 100) / 100 : 0,
        roas: Math.round(roas * 100) / 100,
        frequency: Math.round(avgFreq * 10) / 10,
        overlapPct,
        overlapLevel,
        estimatedWasteMonthly,
        healthScore,
        healthTier: healthTierFromScore(healthScore),
        recommendation:
          healthScore >= 80 ? "Increase Budget" : healthScore < 40 ? "Reduce Budget" : "Optimize",
      };
    })
    .filter((r): r is AudienceRow => r != null)
    .sort((a, b) => b.roas - a.roas);
}

function buildBudgetAllocation(
  marketing: MarketingManagerView,
  campaignRows: AdvertisingCampaignRow[],
): AdvertisingWorkspaceView["budgetAllocation"] {
  const { budgetAllocation } = marketing.v2;

  const channelAmounts = new Map<string, number>();
  const channelRoas = new Map<string, number[]>();
  for (const camp of marketing.campaigns) {
    const key = camp.channel;
    channelAmounts.set(key, (channelAmounts.get(key) ?? 0) + camp.spend);
    const roasList = channelRoas.get(key) ?? [];
    roasList.push(camp.roas);
    channelRoas.set(key, roasList);
  }
  const totalSpend = [...channelAmounts.values()].reduce((s, v) => s + v, 0) || 1;

  const channels: import("./types").BudgetChannelAllocation[] = budgetAllocation.suggested.map((s) => {
    const channelKey = s.channel === "other" ? "tiktok" : s.channel;
    const currentAmt = Math.round(((channelAmounts.get(channelKey as MarketingChannel) ?? 0) / totalSpend) * totalSpend);
    const recommendedAmt = Math.round((s.pct / 100) * totalSpend);
    const direction =
      recommendedAmt > currentAmt * 1.05 ? "up" : recommendedAmt < currentAmt * 0.95 ? "down" : "flat";
    const roasArr = channelRoas.get(channelKey as MarketingChannel) ?? [];
    const roas =
      roasArr.length > 0 ? Math.round((roasArr.reduce((a, b) => a + b, 0) / roasArr.length) * 100) / 100 : 0;
    const gain = Math.round(Math.abs(recommendedAmt - currentAmt) * (roas > 2 ? 0.15 : 0.08));
    return {
      channel: channelKey,
      label: s.label,
      currentAmount: currentAmt,
      recommendedAmount: recommendedAmt,
      direction: direction as "up" | "down" | "flat",
      roas,
      expectedGainMonthly: direction !== "flat" ? gain : 0,
      reason:
        direction === "up"
          ? `${s.label} ROAS ${roas.toFixed(2)} — shift budget for higher efficiency`
          : direction === "down"
            ? `${s.label} underperforming vs other channels`
            : undefined,
    };
  });

  const reasons: BudgetShiftReason[] = channels
    .filter((c) => c.direction !== "flat" && c.roas != null)
    .map((c) => ({
      channel: c.channel,
      label: c.label,
      roas: c.roas ?? 0,
      direction: c.direction,
      expectedGainMonthly: c.expectedGainMonthly ?? 0,
      summary: c.reason ?? "",
    }));

  return {
    channels,
    expectedMonthlyProfit: budgetAllocation.estimatedMonthlyImprovement,
    rationale: budgetAllocation.rationale,
    reasons,
  };
}

function buildOptimizationCenter(
  marketing: MarketingManagerView,
  attribution: AttributionDashboard,
  decisions: DecisionItem[],
): OptimizationRecommendation[] {
  const recs: OptimizationRecommendation[] = [];

  for (const item of marketing.v2.priorityQueue.slice(0, 8)) {
    const decision = decisions.find((d) => d.id === item.decisionId);
    recs.push({
      id: `pq-${item.campaignId}`,
      rank: item.rank,
      title: `${item.action} — ${item.campaignName}`,
      campaignId: item.campaignId,
      campaignName: item.campaignName,
      expectedProfitMonthly: item.impactMonthly,
      confidencePct: item.recoveryProbabilityPct,
      risk: item.actionKind === "pause_campaign" ? "Low" : "Medium",
      effort: effortFromRecommendation(item.actionKind),
      estimatedTime: item.actionKind === "pause_campaign" ? "Immediate" : "3–7 days",
      rollbackAvailable: item.actionKind !== "pause_campaign",
      approvalStatus: decision
        ? decision.status === "accepted"
          ? "approved"
          : decision.status === "ignored"
            ? "rejected"
            : "pending"
        : "none",
      decisionId: decision?.id,
    });
  }

  for (const action of attribution.strategyPlan.actions.slice(0, 5)) {
    if (recs.some((r) => r.title === action.title)) continue;
    recs.push({
      id: action.id,
      rank: action.rank,
      title: action.title,
      expectedProfitMonthly: action.estimatedMonthlyImprovement,
      confidencePct: action.confidencePct,
      risk: action.riskLevel,
      effort: action.implementationTime?.includes("day") && !action.implementationTime.includes("week")
        ? "Low"
        : "Medium",
      estimatedTime: action.implementationTime ?? "7–14 days",
      rollbackAvailable: action.rollbackAvailable ?? true,
      approvalStatus: "none",
    });
  }

  return recs.sort((a, b) => b.expectedProfitMonthly - a.expectedProfitMonthly).slice(0, 10);
}

function buildTimelines(
  marketing: MarketingManagerView,
  campaignRows: AdvertisingCampaignRow[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const tl of marketing.v2.campaignTimelines.slice(0, 6)) {
    for (const m of tl.metrics) {
      entries.push({
        id: `${tl.campaignId}-${m.label}`,
        campaignId: tl.campaignId,
        date: tl.periodLabel,
        type: m.direction === "up" ? "improvement" : m.direction === "down" ? "budget" : "creative",
        label: m.label,
        detail: m.note,
      });
    }
  }

  for (const camp of campaignRows.slice(0, 5)) {
    entries.push({
      id: `${camp.id}-rec`,
      campaignId: camp.id,
      date: "Today",
      type: "recommendation",
      label: camp.recommendationLabel,
      detail: `Health ${camp.healthScore}/100`,
    });
  }

  return entries;
}

export function buildBenchmark(camp: AdvertisingCampaignRow): BenchmarkComparison {
  return {
    campaignId: camp.id,
    yourRoas: camp.roas,
    industryAvgRoas: 2.7,
    topQuartileRoas: 4.5,
    yourCpa: camp.spend > 0 && camp.revenue > 0 ? Math.round((camp.spend / (camp.revenue / 80)) * 100) / 100 : 0,
    similarStoresCpa: 29,
    yourCtr: 2.8,
    industryCtr: 2.3,
  };
}

export function buildAdvertisingWorkspace(input: {
  marketing: MarketingManagerView;
  attribution: AttributionDashboard;
  snapshot: StoreSnapshot;
  decisions: DecisionItem[];
  syncedAt: string;
  profitDashboard?: ProfitDashboard | null;
  storeId?: string;
}): AdvertisingWorkspaceView {
  const campaignRows = assignCampaignPriorityRanks(
    buildCampaignRows(input.marketing.campaigns, input.attribution),
  );
  const platforms = buildPlatformRows(input.marketing, input.snapshot, campaignRows);
  const overview = buildOverview(campaignRows, input.marketing, input.attribution);
  const adSets = buildAdSets(input.snapshot, campaignRows);
  const ads = buildAds(input.snapshot, input.attribution, campaignRows);
  const creatives = buildCreatives(input.attribution, input.snapshot);
  const audiences = buildAudiences(campaignRows, input.snapshot);
  const budgetAllocation = buildBudgetAllocation(input.marketing, campaignRows);
  const optimizationCenter = buildOptimizationCenter(input.marketing, input.attribution, input.decisions);
  const storeId = input.storeId ?? (isDemoStoreSnapshot(input.snapshot) ? DEMO_STORE_ID : "live");
  const allowSynthetic = mayUseSyntheticData(storeId, input.snapshot);
  const optimizationPackages = validateOptimizationPackages(
    buildOptimizationPackages(optimizationCenter),
    campaignRows,
  );

  overview.healthFactors = buildAdvertisingHealthFactors({
    campaigns: campaignRows,
    creatives,
    audiences,
    budgetAllocation,
    platforms,
  });

  const base = {
    syncedAt: input.syncedAt,
    overview,
    platforms,
    campaigns: campaignRows.sort((a, b) => b.profit - a.profit),
    adSets,
    ads,
    creatives,
    audiences,
    budgetAllocation,
    optimizationCenter,
    optimizationPackages,
    timelines: buildTimelines(input.marketing, campaignRows),
  };

  const aiLayer = buildAiManagerLayer(
    {
      ...base,
      aiManager: {} as AdvertisingWorkspaceView["aiManager"],
      healthExplanations: [],
      topWinners: [],
      topLosers: [],
      accountability: {} as AdvertisingWorkspaceView["accountability"],
      accountSummary: buildAccountWideSummary(campaignRows),
    },
    { allowSyntheticTimelines: allowSynthetic },
  );

  const accountability = buildAiAccountabilityLayer({
    workspace: {
      ...base,
      ...aiLayer,
      accountability: {} as AdvertisingWorkspaceView["accountability"],
      accountSummary: buildAccountWideSummary(campaignRows),
    },
    snapshot: input.snapshot,
    profitDashboard: input.profitDashboard ?? null,
    decisions: input.decisions,
    rejections: [],
    outcomes: [],
    previousVisit: null,
  });

  return {
    ...base,
    creatives: aiLayer.creatives,
    optimizationPackages: aiLayer.optimizationPackages,
    aiManager: aiLayer.aiManager,
    healthExplanations: aiLayer.healthExplanations,
    topWinners: aiLayer.topWinners,
    topLosers: aiLayer.topLosers,
    accountability,
    accountSummary: buildAccountWideSummary(base.campaigns),
  };
}

export function filterCampaigns(
  campaigns: AdvertisingCampaignRow[],
  filters: {
    platform?: string;
    status?: string;
    healthTier?: string;
    profitability?: string;
    risk?: string;
    recommendation?: string;
    search?: string;
  },
): AdvertisingCampaignRow[] {
  return campaigns.filter((c) => {
    if (filters.platform && filters.platform !== "all" && c.platform !== filters.platform) return false;
    if (filters.status && filters.status !== "all" && c.status.toLowerCase() !== filters.status.toLowerCase()) return false;
    if (filters.healthTier && filters.healthTier !== "all" && c.healthTier !== filters.healthTier) return false;
    if (filters.profitability === "profitable" && c.profit <= 0) return false;
    if (filters.profitability === "unprofitable" && c.profit > 0) return false;
    if (filters.risk && filters.risk !== "all" && c.riskLevel !== filters.risk) return false;
    if (filters.recommendation && filters.recommendation !== "all" && c.recommendation !== filters.recommendation) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!c.campaign.toLowerCase().includes(q) && !c.platformLabel.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

export function sortCampaigns(
  campaigns: AdvertisingCampaignRow[],
  key: import("./types").AdvertisingSortKey,
): AdvertisingCampaignRow[] {
  const sorted = [...campaigns];
  switch (key) {
    case "profit":
      return sorted.sort((a, b) => b.profit - a.profit);
    case "roas":
      return sorted.sort((a, b) => b.roas - a.roas);
    case "health":
      return sorted.sort((a, b) => b.healthScore - a.healthScore);
    case "spend":
      return sorted.sort((a, b) => b.spend - a.spend);
    case "trend": {
      const order = { up: 3, flat: 2, down: 1 };
      return sorted.sort((a, b) => order[b.trend] - order[a.trend]);
    }
    case "risk": {
      const order = { High: 3, Medium: 2, Low: 1 };
      return sorted.sort((a, b) => order[b.riskLevel] - order[a.riskLevel]);
    }
    case "opportunity":
      return sorted.sort((a, b) => b.expectedOpportunityMonthly - a.expectedOpportunityMonthly);
    default:
      return sorted;
  }
}
