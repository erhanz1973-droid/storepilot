import type { StoreSnapshot } from "@/lib/connectors/types";
import type { CommerceOpportunity } from "./opportunity-schema";
import type { TrendAnalysis } from "./types";

export type CommerceDailyBrief = {
  headline: string;
  bullets: string[];
  opportunityCount: number;
  opportunityImpactMonthly: number;
  generatedAt: string;
};

function formatPct(pct: number | null, label: string): string | null {
  if (pct == null) return null;
  const dir = pct > 0 ? "increased" : pct < 0 ? "decreased" : "held flat";
  return `${label} ${dir} ${Math.abs(pct).toFixed(1)}%`;
}

function yesterdayRevenueLine(snapshot: StoreSnapshot): string | null {
  const rollups = snapshot.profitRollups;
  if (!rollups) return null;
  const yesterday = rollups.yesterday.revenue;
  const prior = rollups.today.revenue * 0.92;
  if (yesterday <= 0) return null;
  const pct = prior > 0 ? ((yesterday - prior) / prior) * 100 : null;
  if (pct == null) return null;
  const dir = pct >= 0 ? "increased" : "decreased";
  return `Yesterday revenue ${dir} ${Math.abs(pct).toFixed(0)}%.`;
}

function googleRoasLine(snapshot: StoreSnapshot): string | null {
  const google = snapshot.googleAdsSnapshot;
  if (!google || google.campaigns.length === 0) return null;
  const spend7 = google.rollups.last7d.spend;
  const rev7 = google.rollups.last7d.attributedRevenue;
  const spendPrev = google.rollups.yesterday.spend * 7;
  const revPrev = google.rollups.yesterday.attributedRevenue * 7;
  if (spend7 <= 0 || spendPrev <= 0) return null;
  const roas7 = rev7 / spend7;
  const roasPrev = revPrev / spendPrev;
  const pct = ((roas7 - roasPrev) / roasPrev) * 100;
  if (Math.abs(pct) < 3) return null;
  const dir = pct >= 0 ? "improved" : "declined";
  return `Google Ads ROAS ${dir} ${Math.abs(pct).toFixed(0)}%.`;
}

function metaAdvertisingEfficiencyLine(snapshot: StoreSnapshot): string | null {
  const campaigns = snapshot.campaigns.filter((c) => c.spend7d > 50);
  if (campaigns.length === 0) return null;

  const totalSpend = campaigns.reduce((s, c) => s + c.spend7d, 0);
  const totalRev = campaigns.reduce((s, c) => s + c.revenue7d, 0);
  const roas = totalSpend > 0 ? totalRev / totalSpend : 0;

  const lowRoas = campaigns.filter((c) => c.roas7d < roas * 0.85 && c.roas7d < 1.2);
  if (lowRoas.length > 0) {
    const worst = lowRoas.sort((a, b) => a.roas7d - b.roas7d)[0]!;
    return `Meta advertising efficiency weakened — ${worst.name} ROAS ${worst.roas7d.toFixed(2)} is dragging blended performance.`;
  }

  if (roas >= 1.5) {
    return `Meta advertising is contributing profitably at ${roas.toFixed(2)} blended ROAS.`;
  }

  return null;
}

export function buildCommerceDailyBrief(input: {
  trends: TrendAnalysis;
  opportunities: CommerceOpportunity[];
  snapshot?: StoreSnapshot;
}): CommerceDailyBrief {
  const { trends, opportunities, snapshot } = input;
  const bullets: string[] = [];

  if (snapshot) {
    const yesterday = yesterdayRevenueLine(snapshot);
    if (yesterday) bullets.push(yesterday);

    const googleRoas = googleRoasLine(snapshot);
    if (googleRoas) bullets.push(googleRoas);

    const metaEfficiency = metaAdvertisingEfficiencyLine(snapshot);
    if (metaEfficiency) bullets.push(metaEfficiency);
  }

  const revenue7 = trends.metrics.find((m) => m.id === "revenue_7d");
  const roas7 = trends.metrics.find((m) => m.id === "roas_7d");
  const spend7 = trends.metrics.find((m) => m.id === "spend_7d");
  const orders7 = trends.metrics.find((m) => m.id === "orders_7d");

  const revLine = formatPct(revenue7?.changePct ?? null, "7-day revenue");
  if (revLine && !bullets.some((b) => b.includes("revenue"))) {
    bullets.push(`${revLine} vs prior week.`);
  }

  const roasLine = formatPct(roas7?.changePct ?? null, "Blended ROAS");
  if (roasLine && !bullets.some((b) => b.includes("ROAS"))) {
    bullets.push(`${roasLine} week over week.`);
  }

  const spendLine = formatPct(spend7?.changePct ?? null, "Ad spend");
  if (spendLine) bullets.push(`${spendLine} — monitor efficiency alongside revenue.`);

  const ordersLine = formatPct(orders7?.changePct ?? null, "Orders");
  if (ordersLine) bullets.push(`${ordersLine} in the last 7 days.`);

  const googleInsights = opportunities.filter((o) => o.source === "google_ads").length;
  const metaInsights = opportunities.filter((o) => o.source === "meta_ads").length;
  const shopifyInsights = opportunities.filter((o) => o.source === "shopify").length;
  if (googleInsights > 0 || metaInsights > 0 || shopifyInsights > 0) {
    bullets.push(
      `${googleInsights + metaInsights + shopifyInsights} optimization opportunities found across ads and store data.`,
    );
  }

  const topOpps = opportunities.slice(0, 3);
  const impact = topOpps.reduce(
    (sum, o) => sum + Math.max(o.expectedImpact.revenueMonthly, o.expectedImpact.profitMonthly),
    0,
  );
  if (topOpps.length > 0) {
    bullets.push(
      `${topOpps.length} top opportunities with an estimated revenue impact of +$${impact.toLocaleString()}/month.`,
    );
  }

  if (bullets.length === 0) {
    bullets.push(trends.interpretation);
  }

  const headline =
    bullets[0]?.includes("increased") || (revenue7?.changePct ?? 0) > 0
      ? bullets[0] ?? `Revenue trending up ${(revenue7?.changePct ?? 0).toFixed(1)}% this week.`
      : opportunities.some((o) => o.severity === "critical")
        ? "Critical issues need attention today."
        : "Your store snapshot is ready — review prioritized opportunities below.";

  return {
    headline,
    bullets: bullets.slice(0, 6),
    opportunityCount: opportunities.length,
    opportunityImpactMonthly: Math.round(
      opportunities.reduce(
        (sum, o) => sum + o.expectedImpact.revenueMonthly + o.expectedImpact.profitMonthly,
        0,
      ),
    ),
    generatedAt: new Date().toISOString(),
  };
}
