import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ChartDefinition, MetricCard } from "@/lib/analytics/types";

export type TrafficAnalytics = {
  metrics: MetricCard[];
  charts: ChartDefinition[];
  topLandingPages: { path: string; sessions: number; revenue: number }[];
  requiresGa4: boolean;
};

const GA4_HINT = "Connect GA4 for this metric";

function unavailableMetric(id: string, label: string): MetricCard {
  return { id, label, value: "—", sublabel: GA4_HINT };
}

export function buildTrafficAnalytics(snapshot: StoreSnapshot): TrafficAnalytics {
  const ga4 = snapshot.ga4Snapshot;
  const hasGa4 = Boolean(ga4?.sessions30d);

  if (!hasGa4) {
    const orders = snapshot.storeMetrics.orders30d;
    return {
      requiresGa4: true,
      metrics: [
        { id: "orders", label: "Orders (Shopify)", value: orders.toLocaleString() },
        unavailableMetric("sessions", "Total Sessions"),
        unavailableMetric("visitors", "Unique Visitors"),
        unavailableMetric("organic", "Organic"),
        unavailableMetric("paid", "Paid"),
        unavailableMetric("bounce", "Bounce Rate"),
        unavailableMetric("duration", "Avg Session Duration"),
      ],
      charts: [],
      topLandingPages: [],
    };
  }

  const sessions = ga4!.sessions30d;
  const sourceTotals = new Map<string, number>();
  for (const row of ga4!.sourceMedium ?? []) {
    const key = `${row.source}/${row.medium}`;
    sourceTotals.set(key, (sourceTotals.get(key) ?? 0) + row.sessions);
  }

  const organic = [...sourceTotals.entries()]
    .filter(([k]) => k.includes("organic") || k.includes("(not set)/organic"))
    .reduce((s, [, v]) => s + v, 0);
  const paid = [...sourceTotals.entries()]
    .filter(([k]) => k.includes("cpc") || k.includes("paid"))
    .reduce((s, [, v]) => s + v, 0);
  const direct = sourceTotals.get("(direct)/(none)") ?? 0;
  const email = [...sourceTotals.entries()]
    .filter(([k]) => k.includes("email"))
    .reduce((s, [, v]) => s + v, 0);
  const referral = [...sourceTotals.entries()]
    .filter(([k]) => k.includes("referral"))
    .reduce((s, [, v]) => s + v, 0);
  const social = [...sourceTotals.entries()]
    .filter(([k]) => k.includes("social") || k.includes("facebook") || k.includes("instagram"))
    .reduce((s, [, v]) => s + v, 0);

  const metrics: MetricCard[] = [
    { id: "sessions", label: "Total Sessions", value: sessions.toLocaleString(), sublabel: "GA4" },
    ...(ga4!.users30d != null
      ? [{ id: "users", label: "Users", value: ga4!.users30d.toLocaleString(), sublabel: "GA4" }]
      : []),
    ...(ga4!.engagementRatePct != null
      ? [{
          id: "engagement",
          label: "Engagement Rate",
          value: `${ga4!.engagementRatePct.toFixed(1)}%`,
          sublabel: "GA4",
        }]
      : []),
    ...(ga4!.avgSessionDurationSec != null
      ? [{
          id: "duration",
          label: "Avg Session Duration",
          value: `${Math.floor(ga4!.avgSessionDurationSec / 60)}m ${Math.round(ga4!.avgSessionDurationSec % 60)}s`,
          sublabel: "GA4",
        }]
      : []),
    { id: "organic", label: "Organic", value: organic.toLocaleString(), sublabel: "GA4" },
    { id: "paid", label: "Paid", value: paid.toLocaleString(), sublabel: "GA4" },
    { id: "direct", label: "Direct", value: direct.toLocaleString(), sublabel: "GA4" },
    { id: "email", label: "Email", value: email.toLocaleString(), sublabel: "GA4" },
    { id: "referral", label: "Referral", value: referral.toLocaleString(), sublabel: "GA4" },
    { id: "social", label: "Social", value: social.toLocaleString(), sublabel: "GA4" },
  ];

  const dailyFromShopify = snapshot.dailyMetrics ?? [];
  const cvr = snapshot.storeMetrics.conversionRate30d;
  const trafficByDay: ChartDefinition = {
    id: "traffic-day",
    title: "Traffic by Day",
    format: "number",
    series: [
      {
        id: "sessions",
        label: "Sessions",
        color: "#5b8def",
        points: ga4!.dailySessions?.length
          ? ga4!.dailySessions.map((d) => ({ date: d.date, value: d.sessions }))
          : dailyFromShopify.map((d) => ({
              date: d.date,
              value: cvr > 0 ? Math.round(d.orders / (cvr / 100)) : d.orders,
            })),
      },
    ],
  };

  const sourceChart: ChartDefinition = {
    id: "traffic-source",
    title: "Traffic by Source",
    format: "number",
    series: [
      { id: "organic", label: "Organic", color: "#22c55e", points: [{ date: "30d", value: organic }] },
      { id: "paid", label: "Paid", color: "#f97316", points: [{ date: "30d", value: paid }] },
      { id: "direct", label: "Direct", color: "#5b8def", points: [{ date: "30d", value: direct }] },
    ],
  };

  const deviceChart: ChartDefinition = {
    id: "traffic-device",
    title: "Traffic by Device",
    format: "number",
    series: (ga4!.devices ?? []).map((d, i) => ({
      id: d.device,
      label: d.device,
      color: ["#5b8def", "#a78bfa", "#22c55e"][i] ?? "#9aa3b2",
      points: [{ date: "30d", value: d.sessions }],
    })),
  };

  return {
    requiresGa4: false,
    metrics,
    charts: [trafficByDay, sourceChart, deviceChart].filter((c) => c.series.some((s) => s.points.length)),
    topLandingPages: ga4!.landingPages ?? [],
  };
}

import { buildFunnelAnalyticsLegacy } from "@/lib/funnel/engine";

/** @deprecated Use buildFunnelPageView from @/lib/funnel/engine */
export const buildFunnelAnalytics = buildFunnelAnalyticsLegacy;
