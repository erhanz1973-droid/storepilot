import type { MetaCampaign, StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import { allowSyntheticAttribution } from "@/lib/env/runtime";
import { computeAttributionConfidence } from "./confidence";
import { buildCustomerJourneys, journeyPathLabel } from "./journeys";
import type {
  AcquisitionMetrics,
  AttributionChannelId,
  AttributionDashboard,
  AttributionEvent,
  AttributionModel,
  CampaignAttributionRow,
  ChannelAttributionRow,
  CreativeAttributionRow,
  CustomerJourney,
} from "./models";
import { ATTRIBUTION_MODEL_LABELS, CHANNEL_LABELS } from "./models";
import { synthesizeAttributionEvents } from "./touchpoints";
import { ga4ToAttributionEvents } from "@/lib/integrations/ga4-events";
import { computeAttributionWeights } from "./weights";
import {
  buildAttributionStrategyPlan,
  buildCreativeInsight,
  enrichCampaignBreakEven,
  resolveBreakEvenModel,
  strategyPlanToOpportunities,
} from "./decision-engine";
import { enrichStrategyPlanSync } from "./recommendation-trust";

const DEFAULT_MODEL: AttributionModel = "position_based";

function netMarginRate(profitDashboard: ProfitDashboard | null): number {
  const pct = profitDashboard?.primary.profitMarginPct;
  if (pct != null && pct > 0) return pct / 100;
  return 0.38;
}

function grossMarginRate(profitDashboard: ProfitDashboard | null): number {
  const rev = profitDashboard?.primary.revenue ?? 0;
  const gp = profitDashboard?.primary.grossProfit ?? 0;
  if (rev > 0) return gp / rev;
  return 0.58;
}

function scaleCampaignTo30d(campaign: MetaCampaign, field: "spend" | "revenue"): number {
  const val7d = field === "spend" ? campaign.spend7d : campaign.revenue7d;
  return Math.round(val7d * (30 / 7) * 100) / 100;
}

function campaignImpressions30d(c: MetaCampaign): number {
  return Math.round(c.impressions7d * (30 / 7));
}

function campaignClicks30d(c: MetaCampaign): number {
  const ctr = c.ctr7d / 100;
  return Math.round(campaignImpressions30d(c) * ctr);
}

type CreditSlice = {
  channelId: AttributionChannelId;
  campaignId?: string;
  campaignName?: string;
  creativeId?: string;
  creativeName?: string;
  revenueCredit: number;
  orderCredit: number;
  isLastClick: boolean;
  isAssistedOnly: boolean;
  isNewCustomer: boolean;
};

function distributeJourneyCredit(
  journey: CustomerJourney,
  model: AttributionModel,
): CreditSlice[] {
  const tps = journey.touchpoints;
  const weights = computeAttributionWeights(
    tps.length,
    model,
    tps.map((t) => t.timestamp),
    journey.orderTimestamp,
  );

  const lastIdx = tps.length - 1;
  const slices: CreditSlice[] = [];

  tps.forEach((tp, idx) => {
    const w = weights[idx];
    slices.push({
      channelId: tp.channelId,
      campaignId: tp.campaignId,
      campaignName: tp.campaign,
      creativeId: tp.creativeId,
      creativeName: tp.ad,
      revenueCredit: Math.round(journey.orderValue * w * 100) / 100,
      orderCredit: w,
      isLastClick: idx === lastIdx,
      isAssistedOnly: idx !== lastIdx,
      isNewCustomer: journey.isNewCustomer,
    });
  });

  return slices;
}

function buildChannelRows(
  slices: CreditSlice[],
  storeRevenue: number,
  channelSpend: Map<AttributionChannelId, number>,
  netMarginPct: number,
): ChannelAttributionRow[] {
  const channelIds: AttributionChannelId[] = [
    "meta_ads",
    "google_ads",
    "tiktok",
    "pinterest",
    "email",
    "organic_search",
    "organic",
    "direct",
    "referral",
    "influencer",
  ];

  const agg = new Map<
    AttributionChannelId,
    {
      revenue: number;
      profit: number;
      orders: number;
      assistedRev: number;
      assistedOrders: number;
      multiTouch: number;
      newRev: number;
      retRev: number;
      newCount: number;
    }
  >();

  for (const ch of channelIds) {
    agg.set(ch, {
      revenue: 0,
      profit: 0,
      orders: 0,
      assistedRev: 0,
      assistedOrders: 0,
      multiTouch: 0,
      newRev: 0,
      retRev: 0,
      newCount: 0,
    });
  }

  const margin = netMarginPct > 0 ? netMarginPct / 100 : 0.38;

  for (const s of slices) {
    const a = agg.get(s.channelId)!;
    a.revenue += s.revenueCredit;
    a.profit += Math.round(s.revenueCredit * margin * 100) / 100;
    a.orders += s.orderCredit;
    if (s.isAssistedOnly) {
      a.assistedRev += s.revenueCredit;
      a.assistedOrders += s.orderCredit;
    }
    if (!s.isLastClick) a.multiTouch += s.revenueCredit;
    if (s.isNewCustomer) {
      a.newRev += s.revenueCredit;
      if (s.isLastClick) a.newCount += 1;
    } else {
      a.retRev += s.revenueCredit;
    }
  }

  const totalRev = storeRevenue || slices.reduce((s, x) => s + x.revenueCredit, 0);
  const totalProfit = [...agg.values()].reduce((s, x) => s + x.profit, 0);

  return channelIds
    .map((channelId) => {
      const a = agg.get(channelId)!;
      const spend = channelSpend.get(channelId) ?? 0;
      const connected = channelId === "meta_ads" ? spend > 0 || a.revenue > 0 : a.revenue > 0;
      const totalOrders = a.orders;
      const assistDenom = totalOrders > 0 ? totalOrders : 1;
      return {
        channelId,
        channelLabel: CHANNEL_LABELS[channelId],
        connected,
        attributedRevenue: Math.round(a.revenue * 100) / 100,
        attributedProfit: Math.round(a.profit * 100) / 100,
        attributedOrders: Math.round(a.orders * 10) / 10,
        adSpend: spend,
        roas: spend > 0 ? Math.round((a.revenue / spend) * 100) / 100 : null,
        profitRoas: spend > 0 ? Math.round((a.profit / spend) * 100) / 100 : null,
        shareOfRevenuePct:
          totalRev > 0 ? Math.round((a.revenue / totalRev) * 1000) / 10 : 0,
        shareOfProfitPct:
          totalProfit > 0 ? Math.round((a.profit / totalProfit) * 1000) / 10 : 0,
        assistedRevenue: Math.round(a.assistedRev * 100) / 100,
        assistedOrders: Math.round(a.assistedOrders * 10) / 10,
        assistRatePct: Math.round((a.assistedOrders / assistDenom) * 1000) / 10,
        multiTouchContributionPct:
          a.revenue > 0 ? Math.round((a.multiTouch / a.revenue) * 1000) / 10 : 0,
        newCustomerRevenue: Math.round(a.newRev * 100) / 100,
        returningCustomerRevenue: Math.round(a.retRev * 100) / 100,
        cac: a.newCount > 0 && spend > 0 ? Math.round((spend / a.newCount) * 100) / 100 : null,
        avgOrderValue:
          totalOrders > 0 ? Math.round((a.revenue / totalOrders) * 100) / 100 : 0,
      };
    })
    .filter((r) => r.attributedRevenue > 0 || r.adSpend > 0)
    .sort((a, b) => b.attributedProfit - a.attributedProfit);
}

function buildCampaignRows(
  slices: CreditSlice[],
  campaigns: MetaCampaign[],
  netMargin: number,
  grossMargin: number,
): CampaignAttributionRow[] {
  const byCampaign = new Map<string, { revenue: number; orders: number; newOrders: number }>();

  for (const s of slices) {
    if (!s.campaignId) continue;
    const cur = byCampaign.get(s.campaignId) ?? { revenue: 0, orders: 0, newOrders: 0 };
    cur.revenue += s.revenueCredit;
    cur.orders += s.orderCredit;
    if (s.isLastClick && s.isNewCustomer) cur.newOrders += 1;
    byCampaign.set(s.campaignId, cur);
  }

  return campaigns
    .map((c) => {
      const attr = byCampaign.get(c.id) ?? { revenue: 0, orders: 0, newOrders: 0 };
      const spend = scaleCampaignTo30d(c, "spend");
      const platformRev = scaleCampaignTo30d(c, "revenue");
      const attributedRevenue = Math.round(attr.revenue * 100) / 100;
      const orders = Math.round(attr.orders);
      const grossProfit = Math.round(attributedRevenue * grossMargin * 100) / 100;
      const netProfit = Math.round((attributedRevenue * netMargin - spend) * 100) / 100;
      const impressions = campaignImpressions30d(c);
      const clicks = campaignClicks30d(c);
      return {
        campaignId: c.id,
        campaignName: c.name,
        channelId: "meta_ads" as AttributionChannelId,
        revenue: platformRev,
        attributedRevenue,
        orders,
        adSpend: spend,
        grossProfit,
        netProfit,
        roas: spend > 0 ? Math.round((attributedRevenue / spend) * 100) / 100 : null,
        profitRoas: spend > 0 ? Math.round((netProfit / spend) * 100) / 100 : null,
        breakEvenRoas: null,
        roasGapPct: null,
        cpa: orders > 0 ? Math.round((spend / orders) * 100) / 100 : null,
        cac: attr.newOrders > 0 ? Math.round((spend / attr.newOrders) * 100) / 100 : null,
        conversionRate:
          clicks > 0 ? Math.round((orders / clicks) * 10000) / 100 : null,
        aov: orders > 0 ? Math.round((attributedRevenue / orders) * 100) / 100 : 0,
        impressions,
        clicks,
      };
    })
    .sort((a, b) => b.netProfit - a.netProfit);
}

function buildCreativeRows(
  slices: CreditSlice[],
  campaigns: MetaCampaign[],
  netMargin: number,
): CreativeAttributionRow[] {
  const byCreative = new Map<
    string,
    { revenue: number; orders: number; campaignId: string; campaignName: string; name: string; channelId: AttributionChannelId }
  >();

  for (const s of slices) {
    if (!s.creativeId) continue;
    const cur = byCreative.get(s.creativeId) ?? {
      revenue: 0,
      orders: 0,
      campaignId: s.campaignId ?? "",
      campaignName: s.campaignName ?? "",
      name: s.creativeName ?? s.creativeId,
      channelId: s.channelId,
    };
    cur.revenue += s.revenueCredit;
    cur.orders += s.orderCredit;
    byCreative.set(s.creativeId, cur);
  }

  const campaignSpend = new Map(campaigns.map((c) => [c.id, scaleCampaignTo30d(c, "spend")]));
  const creativeCountByCampaign = new Map<string, number>();
  for (const [, v] of byCreative) {
    creativeCountByCampaign.set(
      v.campaignId,
      (creativeCountByCampaign.get(v.campaignId) ?? 0) + 1,
    );
  }

  const rows: CreativeAttributionRow[] = [];

  for (const [creativeId, data] of byCreative) {
    const camp = campaigns.find((c) => c.id === data.campaignId);
    const campSpend = campaignSpend.get(data.campaignId) ?? 0;
    const nCreatives = creativeCountByCampaign.get(data.campaignId) ?? 1;
    const spend = Math.round((campSpend / nCreatives) * 100) / 100;
    const revenue = Math.round(data.revenue * 100) / 100;
    const profit = Math.round(revenue * netMargin - spend * 0.7 * 100) / 100;
    const impressions = camp ? Math.round(campaignImpressions30d(camp) / nCreatives) : 1000;
    const clicks = camp ? Math.round(campaignClicks30d(camp) / nCreatives) : 50;
    const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0;
    const cpc = clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0;
    const cpm = impressions > 0 ? Math.round((spend / impressions) * 1000 * 100) / 100 : 0;
    const conversionRate = clicks > 0 ? Math.round((data.orders / clicks) * 10000) / 100 : 0;
    const roas = spend > 0 ? Math.round((revenue / spend) * 100) / 100 : null;

    let status: CreativeAttributionRow["status"] = "neutral";
    let recommendation: CreativeAttributionRow["recommendation"];
    if (roas != null && roas >= 2.5 && profit > 0) {
      status = "winning";
      recommendation = "scale";
    } else if (camp && camp.frequency7d > 2.5 && ctr < 1.2) {
      status = "fatigued";
      recommendation = "refresh";
    } else if (profit < 0 || (roas != null && roas < 1)) {
      status = "underperforming";
      recommendation = "pause";
    } else if (roas != null && roas >= 1.8) {
      recommendation = "duplicate";
    }

    rows.push({
      creativeId,
      creativeName: data.name,
      campaignId: data.campaignId,
      campaignName: data.campaignName,
      channelId: data.channelId,
      spend,
      revenue,
      profit,
      roas,
      ctr,
      cpc,
      cpm,
      conversionRate,
      impressions,
      clicks,
      status,
      recommendation,
    });
  }

  return rows.sort((a, b) => b.profit - a.profit);
}

function buildAcquisitionMetrics(
  journeys: CustomerJourney[],
  slices: CreditSlice[],
  channelSpend: Map<AttributionChannelId, number>,
  netMargin: number,
  channels: ChannelAttributionRow[],
): AcquisitionMetrics {
  const newCustomers = journeys.filter((j) => j.isNewCustomer).length;
  const returningCustomers = journeys.length - newCustomers;
  const newRevenue = journeys.filter((j) => j.isNewCustomer).reduce((s, j) => s + j.orderValue, 0);
  const retRevenue = journeys.reduce((s, j) => s + j.orderValue, 0) - newRevenue;
  const totalPaidSpend = [...channelSpend.values()].reduce((s, v) => s + v, 0);
  const cac = newCustomers > 0 ? Math.round((totalPaidSpend / newCustomers) * 100) / 100 : null;
  const newCustomerRoas =
    totalPaidSpend > 0 ? Math.round((newRevenue / totalPaidSpend) * 100) / 100 : null;
  const returningCustomerRoas =
    totalPaidSpend > 0 ? Math.round((retRevenue / totalPaidSpend) * 100) / 100 : null;
  const avgNewOrder = newCustomers > 0 ? newRevenue / newCustomers : 0;
  const paybackPeriodDays =
    cac != null && netMargin > 0 && avgNewOrder > 0
      ? Math.round((cac / (avgNewOrder * netMargin)) * 30)
      : null;
  const ltvEstimate = avgNewOrder * 2.2;
  const ltvCacRatio =
    cac != null && cac > 0 ? Math.round((ltvEstimate / cac) * 100) / 100 : null;

  const best = channels
    .filter((c) => c.newCustomerRevenue > 0 && c.adSpend > 0)
    .sort((a, b) => (b.profitRoas ?? 0) - (a.profitRoas ?? 0))[0];

  return {
    cac,
    newCustomerRoas,
    returningCustomerRoas,
    paybackPeriodDays,
    ltvCacRatio,
    newCustomers,
    returningCustomers,
    newCustomerRevenue: Math.round(newRevenue * 100) / 100,
    returningCustomerRevenue: Math.round(retRevenue * 100) / 100,
    bestAcquisitionChannel: best?.channelLabel ?? null,
  };
}

function channelSpendMap(snapshot: StoreSnapshot, campaigns: MetaCampaign[]): Map<AttributionChannelId, number> {
  const map = new Map<AttributionChannelId, number>();
  const metaSpend = snapshot.adSpendSnapshot?.platforms.find((p) => p.platform === "meta_ads")
    ?.rollups.last30d.spend
    ?? snapshot.adSpendSnapshot?.totalRollups.last30d.spend
    ?? campaigns.reduce((s, c) => s + scaleCampaignTo30d(c, "spend"), 0);
  map.set("meta_ads", metaSpend);

  const googleSpend =
    snapshot.googleAdsSnapshot?.rollups.last30d.spend
    ?? snapshot.adSpendSnapshot?.platforms.find((p) => p.platform === "google_ads")?.rollups.last30d.spend
    ?? 0;
  map.set("google_ads", googleSpend);

  const tiktokSpend =
    snapshot.tiktokAdsSnapshot?.rollups.last30d.spend
    ?? snapshot.adSpendSnapshot?.platforms.find((p) => p.platform === "tiktok")?.rollups.last30d.spend
    ?? 0;
  map.set("tiktok", tiktokSpend);

  map.set("pinterest", 0);
  map.set("influencer", Math.round(metaSpend * 0.03 * 100) / 100);
  return map;
}

export function buildAttributionDashboard(
  snapshot: StoreSnapshot,
  profitDashboard: ProfitDashboard | null,
  options?: {
    model?: AttributionModel;
    businessGoal?: import("@/lib/business-goals/types").BusinessGoal;
    merchantMode?: string;
  },
): AttributionDashboard | null {
  if (!snapshot.profitRollups && snapshot.storeMetrics.orders30d === 0) return null;

  const model = options?.model ?? DEFAULT_MODEL;
  const hasGa4 = Boolean(snapshot.ga4Snapshot?.sourceMedium.length);
  const hasExplicitEvents =
    Boolean(snapshot.attributionEvents?.length) || hasGa4;

  let events: AttributionEvent[];
  if (snapshot.attributionEvents?.length) {
    events = snapshot.attributionEvents;
  } else if (snapshot.ga4Snapshot) {
    events = ga4ToAttributionEvents(snapshot.ga4Snapshot);
  } else if (allowSyntheticAttribution()) {
    events = synthesizeAttributionEvents(
      snapshot.campaigns,
      snapshot.storeMetrics.revenue30d,
      snapshot.storeMetrics.orders30d,
    );
  } else {
    return null;
  }

  const journeys = buildCustomerJourneys(events);
  const allSlices: CreditSlice[] = [];
  for (const j of journeys) {
    allSlices.push(...distributeJourneyCredit(j, model));
  }

  const netMargin = netMarginRate(profitDashboard);
  const grossMargin = grossMarginRate(profitDashboard);
  const spendMap = channelSpendMap(snapshot, snapshot.campaigns);
  const storeRevenue = snapshot.storeMetrics.revenue30d;

  const channels = buildChannelRows(allSlices, storeRevenue, spendMap, (netMargin * 100));
  const campaignsRaw = buildCampaignRows(allSlices, snapshot.campaigns, netMargin, grossMargin);
  const breakEvenModel = resolveBreakEvenModel(profitDashboard, grossMargin);
  const campaigns = enrichCampaignBreakEven(campaignsRaw, breakEvenModel.breakEvenRoas);
  const creativesBase = buildCreativeRows(allSlices, snapshot.campaigns, netMargin);
  const acquisition = buildAcquisitionMetrics(journeys, allSlices, spendMap, netMargin, channels);
  const confidence = computeAttributionConfidence(snapshot, journeys, hasExplicitEvents);

  const strategyPlanCore = buildAttributionStrategyPlan({
    channels,
    campaigns,
    creatives: creativesBase,
    acquisition,
    profitDashboard,
    grossMarginRate: grossMargin,
    businessGoal: options?.businessGoal,
    merchantMode: options?.merchantMode,
    dailyMetrics: snapshot.dailyMetrics,
  });

  const conversionStable =
    strategyPlanCore.preconditions.find((p) => p.id === "conversion")?.sentiment !== "negative";

  const strategyPlan = enrichStrategyPlanSync({
    plan: strategyPlanCore,
    confidence,
    syncedAt: snapshot.syncedAt,
    snapshot,
    acquisition,
    journeyCount: journeys.length,
    paidCampaignCount: campaigns.filter((c) => c.adSpend > 50).length,
    conversionStable,
  });

  const breakEven = breakEvenModel.breakEvenRoas;
  const creatives = creativesBase.map((c) => ({
    ...c,
    insight: buildCreativeInsight(c, breakEven, strategyPlan.strategy),
    recommendation:
      strategyPlan.strategy === "optimize" || strategyPlan.strategy === "reduce_budget"
        ? c.recommendation === "pause"
          ? "refresh"
          : c.recommendation
        : c.recommendation,
  }));

  const assistedLeaders = [...channels]
    .sort((a, b) => b.assistedRevenue - a.assistedRevenue)
    .slice(0, 5);
  const winningCreatives = creatives.filter((c) => c.status === "winning").slice(0, 5);
  const fatiguedCreatives = creatives.filter((c) => c.status === "fatigued").slice(0, 5);
  const bestCampaigns = campaigns.filter((c) => c.netProfit > 0).slice(0, 5);
  const worstCampaigns = [...campaigns].sort((a, b) => a.netProfit - b.netProfit).slice(0, 5);

  const journeySamples = journeys.slice(0, 6).map((j) => ({
    orderId: j.orderId,
    orderValue: j.orderValue,
    touchpointLabels: j.touchpoints.map((t) => t.source || t.channelLabel),
    channelPath: journeyPathLabel(j),
  }));

  const netMarginPct = profitDashboard?.primary.profitMarginPct ?? undefined;
  const attributionOpportunities = strategyPlanToOpportunities(strategyPlan, netMarginPct);

  return {
    syncedAt: snapshot.syncedAt,
    model,
    confidence,
    channels,
    campaigns,
    creatives,
    acquisition,
    journeySamples,
    sampleJourneys: journeys.slice(0, 8),
    winningCreatives,
    fatiguedCreatives,
    assistedLeaders,
    bestCampaigns,
    worstCampaigns,
    strategyPlan,
    attributionOpportunities,
  };
}

export function summarizeAttributionForAi(dashboard: AttributionDashboard): string {
  const top = dashboard.channels[0];
  const bestCamp = dashboard.bestCampaigns[0];
  const lines = [
    `Attribution model: ${ATTRIBUTION_MODEL_LABELS[dashboard.model]} (${dashboard.confidence.level} confidence).`,
    top
      ? `Top channel: ${top.channelLabel} — $${top.attributedProfit.toLocaleString()} attributed profit.`
      : "",
    bestCamp
      ? `Best campaign: ${bestCamp.campaignName} — $${bestCamp.netProfit.toLocaleString()} net profit.`
      : "",
    dashboard.acquisition.cac != null
      ? `CAC: $${dashboard.acquisition.cac} · LTV:CAC ${dashboard.acquisition.ltvCacRatio ?? "—"}.`
      : "",
  ].filter(Boolean);
  return lines.join(" ");
}
