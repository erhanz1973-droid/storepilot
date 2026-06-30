import type { AdPlatformSnapshot, AdSpendSnapshot, DailyMetricPoint } from "@/lib/ads/types";
import { buildAdSpendSnapshot } from "@/lib/ads/spend";
import type { MetaCampaign, ProfitOrderRollups, StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitWindow } from "./types";

export type RoasConfidenceLevel = "High" | "Medium" | "Low";

export type RoasConfidence = {
  scorePct: number;
  level: RoasConfidenceLevel;
  reason: string;
  insufficientHistory: boolean;
};

export type BlendedRoasPeriod = {
  window: ProfitWindow;
  label: string;
  revenue: number;
  adSpend: number;
  roas: number | null;
  previousRoas: number | null;
  changePct: number | null;
};

export type BlendedRoasKpi = {
  id: string;
  label: string;
  roas: number | null;
  changePct: number | null;
  direction: "up" | "down" | "flat";
  periodLabel: string;
  insufficientData: boolean;
};

export type ChannelRoasRow = {
  channel: string;
  channelId: string;
  connected: boolean;
  spend: number;
  revenue: number;
  orders: number;
  roas: number | null;
  shareOfSpendPct: number;
  shareOfRevenuePct: number;
};

export type BlendedRoasDashboard = {
  syncedAt: string;
  confidence: RoasConfidence;
  kpis: BlendedRoasKpi[];
  periods: BlendedRoasPeriod[];
  dailySeries: DailyMetricPoint[];
  channels: ChannelRoasRow[];
  blendedRoas30d: number | null;
  metaRoas30d: number | null;
  isAdvertisingProfitable: boolean;
  adSpendSnapshot: AdSpendSnapshot;
};

function computeRoas(revenue: number, spend: number): number | null {
  if (spend <= 0) return null;
  return Math.round((revenue / spend) * 100) / 100;
}

function pctChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

function trendDir(changePct: number | null): BlendedRoasKpi["direction"] {
  if (changePct == null) return "flat";
  if (Math.abs(changePct) < 2) return "flat";
  return changePct > 0 ? "up" : "down";
}

const WINDOW_LABELS: Record<ProfitWindow, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7d: "7 Days",
  last30d: "30 Days",
};

const PREVIOUS_WINDOW: Partial<Record<ProfitWindow, ProfitWindow>> = {
  today: "yesterday",
  last7d: "last30d",
};

export function computeRoasConfidence(
  snapshot: StoreSnapshot,
  adSpendSnapshot: AdSpendSnapshot,
  dailySeries: DailyMetricPoint[],
): RoasConfidence {
  const adsConnected =
    snapshot.connectorStates?.meta_ads === "connected" ||
    snapshot.connectorStates?.meta_ads === "demo" ||
    snapshot.connectorStates?.google_ads === "connected" ||
    snapshot.connectorStates?.tiktok === "connected";

  if (!adsConnected || adSpendSnapshot.platforms.length === 0) {
    const googleConnected = snapshot.connectorStates?.google_ads === "connected";
    const hint = googleConnected
      ? "Connect Shopify revenue or wait for ad spend history to calculate Blended ROAS."
      : "Connect Meta Ads or Google Ads to calculate Blended ROAS.";
    return {
      scorePct: 0,
      level: "Low",
      reason: hint,
      insufficientHistory: true,
    };
  }

  const daysWithSpend = dailySeries.filter((d) => d.adSpend > 0).length;
  let score = 40;

  if (!adSpendSnapshot.spendScaled) score += 30;
  else score += 10;

  if (daysWithSpend >= 30) score += 25;
  else if (daysWithSpend >= 14) score += 15;
  else if (daysWithSpend >= 7) score += 8;

  if (snapshot.profitRollups) score += 5;

  const platformCount = adSpendSnapshot.platforms.filter((p) => p.connected).length;
  if (platformCount >= 3) score += 15;
  else if (platformCount >= 2) score += 8;

  score = Math.min(100, score);

  let level: RoasConfidenceLevel = "Low";
  if (score >= 75) level = "High";
  else if (score >= 45) level = "Medium";

  const reasons: string[] = [];
  if (adSpendSnapshot.spendScaled) {
    reasons.push("Ad spend is partially estimated from 7-day campaign data");
  }
  if (daysWithSpend < 14) {
    reasons.push(`Only ${daysWithSpend} days of ad spend history available`);
  }
  if (reasons.length === 0) {
    reasons.push("Sufficient revenue and ad spend history for reliable Blended ROAS");
  }

  return {
    scorePct: score,
    level,
    reason: reasons.join(". ") + ".",
    insufficientHistory: daysWithSpend < 7 || adSpendSnapshot.totalRollups.last30d.spend === 0,
  };
}

export function mergeDailyMetrics(
  revenueByDate: Map<string, { revenue: number; orders: number }>,
  spendByDate: Map<string, number>,
  days = 90,
): DailyMetricPoint[] {
  const dates = new Set([...revenueByDate.keys(), ...spendByDate.keys()]);
  const sorted = [...dates].sort().slice(-days);

  return sorted.map((date) => ({
    date,
    revenue: Math.round((revenueByDate.get(date)?.revenue ?? 0) * 100) / 100,
    adSpend: Math.round((spendByDate.get(date) ?? 0) * 100) / 100,
    orders: revenueByDate.get(date)?.orders ?? 0,
  }));
}

export function buildChannelBreakdown(
  snapshot: StoreSnapshot,
  adSpendSnapshot: AdSpendSnapshot,
  revenue30d: number,
  orders30d: number,
): ChannelRoasRow[] {
  const rows: ChannelRoasRow[] = [];
  const totalSpend = adSpendSnapshot.totalRollups.last30d.spend;
  let metaRevenue = 0;

  for (const platform of adSpendSnapshot.platforms) {
    const spend = platform.rollups.last30d.spend;
    const revenue = platform.rollups.last30d.attributedRevenue;
    metaRevenue += revenue;
    rows.push({
      channel: platform.label,
      channelId: platform.platform,
      connected: platform.connected,
      spend,
      revenue,
      orders: 0,
      roas: computeRoas(revenue, spend),
      shareOfSpendPct: totalSpend > 0 ? Math.round((spend / totalSpend) * 1000) / 10 : 0,
      shareOfRevenuePct:
        revenue30d > 0 ? Math.round((revenue / revenue30d) * 1000) / 10 : 0,
    });
  }

  const organicRevenue = Math.max(0, Math.round((revenue30d - metaRevenue) * 100) / 100);

  rows.push({
    channel: "Organic",
    channelId: "organic",
    connected: true,
    spend: 0,
    revenue: organicRevenue,
    orders: orders30d,
    roas: null,
    shareOfSpendPct: 0,
    shareOfRevenuePct:
      revenue30d > 0 ? Math.round((organicRevenue / revenue30d) * 1000) / 10 : 0,
  });

  const futureChannels: { id: string; label: string }[] = [
    { id: "tiktok", label: "TikTok" },
    { id: "email", label: "Email" },
    { id: "direct", label: "Direct" },
    { id: "referral", label: "Referral" },
    { id: "unknown", label: "Unknown" },
  ];

  for (const ch of futureChannels) {
    if (rows.some((r) => r.channelId === ch.id)) continue;
    if (ch.id === "email" && snapshot.klaviyoSnapshot) {
      const k = snapshot.klaviyoSnapshot;
      rows.push({
        channel: "Email (Klaviyo)",
        channelId: "email",
        connected: true,
        spend: k.rollups.last30d.spend,
        revenue: k.emailAttributedRevenue30d,
        orders: k.orders30d,
        roas: computeRoas(k.emailAttributedRevenue30d, k.rollups.last30d.spend),
        shareOfSpendPct: totalSpend > 0 ? Math.round((k.rollups.last30d.spend / totalSpend) * 1000) / 10 : 0,
        shareOfRevenuePct:
          revenue30d > 0 ? Math.round((k.emailAttributedRevenue30d / revenue30d) * 1000) / 10 : 0,
      });
      continue;
    }
    rows.push({
      channel: ch.label,
      channelId: ch.id,
      connected: false,
      spend: 0,
      revenue: 0,
      orders: 0,
      roas: null,
      shareOfSpendPct: 0,
      shareOfRevenuePct: 0,
    });
  }

  return rows;
}

export function buildBlendedRoasKpis(periods: BlendedRoasPeriod[]): BlendedRoasKpi[] {
  const byWindow = Object.fromEntries(periods.map((p) => [p.window, p])) as Record<
    ProfitWindow,
    BlendedRoasPeriod
  >;

  const items: { id: string; label: string; window: ProfitWindow; periodLabel: string }[] = [
    { id: "blended_roas", label: "Blended ROAS", window: "last30d", periodLabel: "30d" },
    { id: "roas_today", label: "Today's ROAS", window: "today", periodLabel: "vs yesterday" },
    { id: "roas_yesterday", label: "Yesterday's ROAS", window: "yesterday", periodLabel: "1d" },
    { id: "roas_7d", label: "7 Day ROAS", window: "last7d", periodLabel: "7d vs 30d" },
    { id: "roas_30d", label: "30 Day ROAS", window: "last30d", periodLabel: "30d" },
  ];

  return items.map(({ id, label, window, periodLabel }) => {
    const p = byWindow[window];
    const insufficientData = p == null || (p.adSpend <= 0 && p.roas == null);
    return {
      id,
      label,
      roas: p?.roas ?? null,
      changePct: p?.changePct ?? null,
      direction: trendDir(p?.changePct ?? null),
      periodLabel,
      insufficientData,
    };
  });
}

export function computeBlendedRoasDashboard(
  snapshot: StoreSnapshot,
  options?: { campaigns?: MetaCampaign[] },
): BlendedRoasDashboard | null {
  if (!snapshot.profitRollups) return null;

  const campaigns = options?.campaigns ?? snapshot.campaigns;
  const adSpendSnapshot =
    snapshot.adSpendSnapshot ??
    buildAdSpendSnapshot({
      metaCampaigns: campaigns,
      metaAccountRollups: snapshot.metaAccountRollups,
    });

  const windows: ProfitWindow[] = ["today", "yesterday", "last7d", "last30d"];
  const periods: BlendedRoasPeriod[] = windows.map((window) => {
    const revenue = snapshot.profitRollups![window].revenue;
    const adSpend = adSpendSnapshot.totalRollups[window].spend;
    const roas = computeRoas(revenue, adSpend);

    const prevWindow = PREVIOUS_WINDOW[window];
    let previousRoas: number | null = null;
    if (prevWindow) {
      const prevRev = snapshot.profitRollups![prevWindow].revenue;
      const prevSpend = adSpendSnapshot.totalRollups[prevWindow].spend;
      previousRoas = computeRoas(prevRev, prevSpend);
    }

    return {
      window,
      label: WINDOW_LABELS[window],
      revenue,
      adSpend,
      roas,
      previousRoas,
      changePct: pctChange(roas, previousRoas),
    };
  });

  const dailySeries = snapshot.dailyMetrics ?? [];
  const confidence = computeRoasConfidence(snapshot, adSpendSnapshot, dailySeries);
  const revenue30d = snapshot.profitRollups.last30d.revenue;
  const orders30d = snapshot.profitRollups.last30d.orders;

  const metaPlatform = adSpendSnapshot.platforms.find(
    (p: AdPlatformSnapshot) => p.platform === "meta_ads",
  );
  const blendedRoas30d = periods.find((p) => p.window === "last30d")?.roas ?? null;
  const metaRoas30d = metaPlatform
    ? computeRoas(
        metaPlatform.rollups.last30d.attributedRevenue,
        metaPlatform.rollups.last30d.spend,
      )
    : null;

  const netMarginApprox =
    revenue30d > 0
      ? (revenue30d - snapshot.profitRollups.last30d.cogs) / revenue30d
      : 0;

  return {
    syncedAt: snapshot.syncedAt,
    confidence,
    kpis: buildBlendedRoasKpis(periods),
    periods,
    dailySeries,
    channels: buildChannelBreakdown(snapshot, adSpendSnapshot, revenue30d, orders30d),
    blendedRoas30d,
    metaRoas30d,
    isAdvertisingProfitable:
      blendedRoas30d != null && blendedRoas30d >= 1 && netMarginApprox > 0.15,
    adSpendSnapshot,
  };
}

export function explainRoasDecrease(dashboard: BlendedRoasDashboard): string[] {
  const today = dashboard.periods.find((p) => p.window === "today");
  const yesterday = dashboard.periods.find((p) => p.window === "yesterday");
  const last7 = dashboard.periods.find((p) => p.window === "last7d");
  const last30 = dashboard.periods.find((p) => p.window === "last30d");

  if (!today || !yesterday) {
    return ["Insufficient data to explain ROAS change."];
  }

  const lines: string[] = [];

  if (today.roas != null && yesterday.roas != null && today.roas < yesterday.roas) {
    const spendChange =
      yesterday.adSpend > 0
        ? Math.round(((today.adSpend - yesterday.adSpend) / yesterday.adSpend) * 1000) / 10
        : null;
    const revChange =
      yesterday.revenue > 0
        ? Math.round(((today.revenue - yesterday.revenue) / yesterday.revenue) * 1000) / 10
        : null;

    if (spendChange != null && spendChange > 10 && (revChange == null || revChange < spendChange)) {
      lines.push(
        `Blended ROAS decreased from ${yesterday.roas.toFixed(1)} to ${today.roas.toFixed(1)} because ad spend increased ${spendChange}% while revenue increased only ${revChange ?? 0}%.`,
      );
    } else if (revChange != null && revChange < -5) {
      lines.push(
        `Blended ROAS fell because revenue dropped ${Math.abs(revChange)}% vs yesterday while ad spend held at $${today.adSpend.toLocaleString()}.`,
      );
    } else {
      lines.push(
        `Blended ROAS decreased from ${yesterday.roas.toFixed(1)} to ${today.roas.toFixed(1)} — mixed spend and revenue factors.`,
      );
    }
  }

  if (
    dashboard.metaRoas30d != null &&
    dashboard.blendedRoas30d != null &&
    dashboard.metaRoas30d > dashboard.blendedRoas30d
  ) {
    lines.push(
      `Meta ROAS (${dashboard.metaRoas30d.toFixed(1)}) is higher than Blended ROAS (${dashboard.blendedRoas30d.toFixed(1)}) because Blended ROAS uses total Shopify revenue, including organic and direct sales not attributed to Meta.`,
    );
  }

  if (last7 && last30 && last7.roas != null && last30.roas != null && last7.roas < last30.roas) {
    lines.push(
      `7-day ROAS (${last7.roas.toFixed(1)}) trails 30-day (${last30.roas.toFixed(1)}) — recent ad efficiency may be declining.`,
    );
  }

  if (dashboard.confidence.insufficientHistory) {
    lines.push(`Confidence is reduced: ${dashboard.confidence.reason}`);
  }

  return lines;
}

export function summarizeRoasForAi(dashboard: BlendedRoasDashboard): string {
  const p = dashboard.periods.find((w) => w.window === "last30d");
  const parts = [
    `Blended ROAS (30d): ${dashboard.blendedRoas30d?.toFixed(2) ?? "N/A"} on $${p?.revenue.toLocaleString() ?? 0} revenue / $${p?.adSpend.toLocaleString() ?? 0} ad spend.`,
    `Advertising profitable: ${dashboard.isAdvertisingProfitable ? "yes" : "no"}.`,
    `ROAS confidence: ${dashboard.confidence.scorePct}% (${dashboard.confidence.level}).`,
  ];
  if (dashboard.metaRoas30d != null) {
    parts.push(`Meta-attributed ROAS (30d): ${dashboard.metaRoas30d.toFixed(2)}.`);
  }
  return parts.join(" ");
}
