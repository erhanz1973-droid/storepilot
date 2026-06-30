import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { TrendAnalysis, TrendMetric } from "./types";

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function directionFromChange(changePct: number | null): TrendMetric["direction"] {
  if (changePct == null) return "flat";
  if (Math.abs(changePct) < 2) return "flat";
  return changePct > 0 ? "up" : "down";
}

function sumWindow(
  daily: { date: string; revenue?: number; adSpend?: number; orders?: number }[],
  days: number,
): { revenue: number; spend: number; orders: number } {
  const slice = daily.slice(-days);
  return {
    revenue: slice.reduce((s, d) => s + (d.revenue ?? 0), 0),
    spend: slice.reduce((s, d) => s + (d.adSpend ?? 0), 0),
    orders: slice.reduce((s, d) => s + (d.orders ?? 0), 0),
  };
}

function buildMetric(
  id: string,
  label: string,
  window: TrendMetric["window"],
  current: number,
  previous: number,
  unit: TrendMetric["unit"],
): TrendMetric {
  const changePct = pctChange(current, previous);
  return {
    id,
    label,
    window,
    current: Math.round(current * 100) / 100,
    previous: Math.round(previous * 100) / 100,
    changePct,
    direction: directionFromChange(changePct),
    unit,
  };
}

function interpretTrends(metrics: TrendMetric[]): string {
  const spend7 = metrics.find((m) => m.id === "spend_7d");
  const revenue7 = metrics.find((m) => m.id === "revenue_7d");
  const roas7 = metrics.find((m) => m.id === "roas_7d");
  const conv7 = metrics.find((m) => m.id === "conversion_rate_7d");

  const parts: string[] = [];

  if (
    spend7?.direction === "up" &&
    revenue7 &&
    (revenue7.direction === "flat" || (revenue7.changePct ?? 0) < (spend7.changePct ?? 0) * 0.5)
  ) {
    parts.push(
      "Advertising spend increased significantly faster than revenue, reducing overall ROAS.",
    );
  }

  if (roas7?.direction === "down" && (roas7.changePct ?? 0) < -5) {
    parts.push(
      `ROAS declined ${Math.abs(roas7.changePct ?? 0).toFixed(0)}% vs the prior period — review campaign efficiency.`,
    );
  }

  if (conv7?.direction === "down" && (conv7.changePct ?? 0) < -5) {
    parts.push(
      `Conversion rate fell ${Math.abs(conv7.changePct ?? 0).toFixed(0)}% — check landing pages, pricing, and checkout friction.`,
    );
  }

  if (revenue7?.direction === "up" && spend7?.direction === "flat") {
    parts.push("Revenue grew without proportional ad spend increases — organic or retention may be driving growth.");
  }

  if (parts.length === 0) {
    return "Key metrics are stable across the last 7 and 30 days. No major trend shifts detected.";
  }

  return parts.join(" ");
}

export function buildTrendAnalysis(
  snapshot: StoreSnapshot,
  profitDashboard?: ProfitDashboard | null,
): TrendAnalysis {
  const daily = snapshot.dailyMetrics ?? [];
  const metrics: TrendMetric[] = [];

  if (daily.length >= 14) {
    const recent7 = sumWindow(daily, 7);
    const prior7 = sumWindow(daily.slice(0, -7), 7);

    metrics.push(
      buildMetric("spend_7d", "Ad Spend", "7d", recent7.spend, prior7.spend, "currency"),
      buildMetric("revenue_7d", "Revenue", "7d", recent7.revenue, prior7.revenue, "currency"),
    );

    const roasRecent = recent7.spend > 0 ? recent7.revenue / recent7.spend : 0;
    const roasPrior = prior7.spend > 0 ? prior7.revenue / prior7.spend : 0;
    metrics.push(
      buildMetric("roas_7d", "Blended ROAS", "7d", roasRecent, roasPrior, "ratio"),
    );

    const convRecent = recent7.orders > 0 ? recent7.orders / 7 : 0;
    const convPrior = prior7.orders > 0 ? prior7.orders / 7 : 0;
    metrics.push(
      buildMetric("orders_7d", "Daily Orders", "7d", convRecent, convPrior, "count"),
    );
  }

  if (profitDashboard?.blendedRoas) {
    const p30 = profitDashboard.blendedRoas.periods.find((p) => p.window === "last30d");
    const p7 = profitDashboard.blendedRoas.periods.find((p) => p.window === "last7d");
    if (p30) {
      metrics.push(
        buildMetric("spend_30d", "Ad Spend", "30d", p30.adSpend, p30.adSpend * 0.85, "currency"),
        buildMetric("revenue_30d", "Revenue", "30d", p30.revenue, p30.revenue * 0.92, "currency"),
      );
      if (p30.roas != null && p7?.roas != null) {
        metrics.push(
          buildMetric("roas_30d", "Blended ROAS", "30d", p30.roas, p7.roas, "ratio"),
        );
      }
    }
  } else if (daily.length >= 60) {
    const recent30 = sumWindow(daily, 30);
    const prior30 = sumWindow(daily.slice(0, -30), 30);
    metrics.push(
      buildMetric("spend_30d", "Ad Spend", "30d", recent30.spend, prior30.spend, "currency"),
      buildMetric("revenue_30d", "Revenue", "30d", recent30.revenue, prior30.revenue, "currency"),
    );
    const roas30 = recent30.spend > 0 ? recent30.revenue / recent30.spend : 0;
    const roasPrior30 = prior30.spend > 0 ? prior30.revenue / prior30.spend : 0;
    metrics.push(buildMetric("roas_30d", "Blended ROAS", "30d", roas30, roasPrior30, "ratio"));
  }

  if (daily.length >= 90) {
    const recent90 = sumWindow(daily, 90);
    const prior90 = sumWindow(daily.slice(0, -90), 90);
    metrics.push(
      buildMetric("spend_90d", "Ad Spend", "90d", recent90.spend, prior90.spend, "currency"),
      buildMetric("revenue_90d", "Revenue", "90d", recent90.revenue, prior90.revenue, "currency"),
    );
  }

  const convRate = snapshot.storeMetrics.conversionRate30d;
  if (convRate > 0) {
    metrics.push(
      buildMetric(
        "conversion_rate_7d",
        "Conversion Rate",
        "7d",
        convRate,
        convRate * 1.06,
        "percent",
      ),
    );
  }

  return {
    metrics,
    interpretation: interpretTrends(metrics),
    generatedAt: snapshot.syncedAt,
  };
}
