import type { DailyMetricPoint } from "@/lib/ads/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { GA4Snapshot } from "@/lib/integrations/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import { breakEvenFromProfitPeriod } from "@/lib/attribution/break-even-roas";
import { profitStatusLabel } from "@/lib/profit/metric-value";
import type { ChartDefinition, MetricCard } from "@/lib/analytics/types";
import type { ExecutiveSummary } from "@/lib/insights/executive-summary";
import type { TrendAnalysis } from "@/lib/insights/types";

export type ExecutiveAnalytics = {
  syncedAt: string;
  metrics: MetricCard[];
  charts: ChartDefinition[];
  summary: ExecutiveSummary | null;
  trends: TrendAnalysis | null;
};

function fmtCurrency(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatSessionDuration(sec?: number): string {
  if (sec == null || sec <= 0) return "—";
  const minutes = Math.floor(sec / 60);
  const seconds = Math.round(sec % 60);
  return `${minutes}m ${seconds}s`;
}

function buildChartsFromDaily(
  daily: DailyMetricPoint[],
  options?: {
    profitByDate?: Map<string, number>;
    ga4?: GA4Snapshot | null;
  },
): ChartDefinition[] {
  if (daily.length === 0) return [];

  const profitByDate = options?.profitByDate;
  const ga4 = options?.ga4;

  const withProfit = daily.map((d) => ({
    ...d,
    profit: profitByDate?.get(d.date) ?? 0,
    roas: d.adSpend > 0 ? d.revenue / d.adSpend : 0,
  }));

  const toPoints = (key: keyof (typeof withProfit)[0]) =>
    withProfit.map((d) => ({ date: d.date, value: Number(d[key]) }));

  const sessionsByDate = new Map(
    ga4?.dailySessions?.map((d) => [d.date, d.sessions]) ?? [],
  );

  const charts: ChartDefinition[] = [
    {
      id: "revenue",
      title: "Revenue Trend",
      format: "currency",
      series: [{ id: "revenue", label: "Revenue", color: "#5b8def", points: toPoints("revenue") }],
    },
    {
      id: "orders",
      title: "Orders Trend",
      format: "number",
      series: [{ id: "orders", label: "Orders", color: "#a78bfa", points: toPoints("orders") }],
    },
  ];

  if (profitByDate && profitByDate.size > 0) {
    charts.push({
      id: "profit",
      title: "Profit Trend",
      format: "currency",
      series: [{ id: "profit", label: "Net Profit", color: "#22c55e", points: toPoints("profit") }],
    });
  }

  if (sessionsByDate.size > 0) {
    charts.push({
      id: "traffic",
      title: "Traffic Trend",
      format: "number",
      series: [
        {
          id: "sessions",
          label: "Sessions",
          color: "#38bdf8",
          points: withProfit.map((d) => ({
            date: d.date,
            value: sessionsByDate.get(d.date) ?? 0,
          })),
        },
      ],
    });

    charts.push({
      id: "conversion",
      title: "Conversion Trend",
      format: "percent",
      series: [
        {
          id: "cvr",
          label: "Conversion rate",
          color: "#f472b6",
          points: withProfit
            .map((d) => {
              const sessions = sessionsByDate.get(d.date) ?? 0;
              return {
                date: d.date,
                value: sessions > 0 ? (d.orders / sessions) * 100 : 0,
              };
            })
            .filter((p) => p.value > 0),
        },
      ],
    });
  }

  charts.push(
    {
      id: "spend-vs-revenue",
      title: "Spend vs Revenue",
      format: "currency",
      series: [
        { id: "revenue", label: "Revenue", color: "#5b8def", points: toPoints("revenue") },
        { id: "spend", label: "Ad Spend", color: "#f97316", points: toPoints("adSpend") },
      ],
    },
    {
      id: "roas",
      title: "ROAS Trend",
      format: "ratio",
      series: [{ id: "roas", label: "ROAS", color: "#eab308", points: toPoints("roas") }],
    },
  );

  return charts;
}

export function buildExecutiveAnalytics(input: {
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  executiveSummary?: ExecutiveSummary | null;
  trends?: TrendAnalysis | null;
}): ExecutiveAnalytics {
  const { snapshot, profitDashboard, executiveSummary, trends } = input;
  const m = snapshot.storeMetrics;
  const primary = profitDashboard?.primary;
  const blended = profitDashboard?.blendedRoas?.blendedRoas30d ?? 0;
  const spend30 =
    snapshot.adSpendSnapshot?.totalRollups.last30d.spend ??
    snapshot.googleAdsSnapshot?.rollups.last30d.spend ??
    0;

  const revMetric = trends?.metrics.find((t) => t.id === "revenue_7d");
  const profitMetric = trends?.metrics.find((t) => t.id === "profit_7d");
  const roasMetric = trends?.metrics.find((t) => t.id === "roas_7d");
  const ordersMetric = trends?.metrics.find((t) => t.id === "orders_7d");

  const ga4Sessions = snapshot.ga4Snapshot?.sessions30d;
  const ga4 = snapshot.ga4Snapshot;
  const cvrFromGa4 =
    ga4?.ecommerceConversionRatePct ??
    (ga4Sessions && ga4Sessions > 0 ? (m.orders30d / ga4Sessions) * 100 : null);
  const returningPct = ga4?.returningUserRatePct;
  const engagementRate = ga4?.engagementRatePct;
  const avgSessionDuration = ga4?.avgSessionDurationSec;

  const profitMeta = profitDashboard?.primaryProfit;
  const profitUnavailable = profitMeta?.status === "unavailable";
  const profitEstimated = profitMeta?.status === "estimated";
  const breakEven = primary ? breakEvenFromProfitPeriod(primary) : null;
  const operatingCashFlow =
    primary?.netProfit != null && !profitUnavailable ? primary.netProfit : null;

  const metrics: MetricCard[] = [
    {
      id: "profit",
      label: profitEstimated ? "Est. Profit" : "Profit",
      value: profitUnavailable
        ? "Not Available"
        : primary?.netProfit != null
          ? fmtCurrency(primary.netProfit)
          : "—",
      sublabel: profitUnavailable
        ? "Complete Profit Setup"
        : profitMeta
          ? `${profitStatusLabel(profitMeta.status)} · ${profitMeta.confidence}%`
          : primary
            ? undefined
            : "Requires Shopify + cost data",
      changePct: profitUnavailable ? null : profitMetric?.changePct ?? executiveSummary?.profitChangePct,
      emphasize: true,
      tone: profitUnavailable
        ? "warning"
        : (primary?.netProfit ?? 0) >= 0
          ? "positive"
          : "negative",
      profitConfidence: profitDashboard?.confidence
        ? {
            status: profitDashboard.confidence.status,
            scorePct: profitDashboard.confidence.scorePct,
            setupRequired: profitDashboard.confidence.setupRequired,
          }
        : undefined,
    },
    {
      id: "revenue",
      label: "Revenue",
      value: fmtCurrency(primary?.revenue ?? m.revenue30d),
      changePct: revMetric?.changePct ?? executiveSummary?.revenueChangePct,
      sublabel: "Shopify",
    },
    {
      id: "orders",
      label: "Orders",
      value: String(primary?.orders ?? m.orders30d),
      changePct: ordersMetric?.changePct,
      sublabel: "Shopify",
    },
    {
      id: "roas",
      label: "Blended ROAS",
      value: blended > 0 ? blended.toFixed(2) : "—",
      changePct: roasMetric?.changePct ?? executiveSummary?.roasChangePct,
      sublabel: blended > 0 ? "Revenue ÷ ad spend" : undefined,
    },
    {
      id: "break-even-roas",
      label: "Break-even ROAS",
      value: breakEven ? breakEven.breakEvenRoas.toFixed(2) : "—",
      sublabel: breakEven ? "Minimum ROAS for profit" : "Requires profit setup",
      tone: blended > 0 && breakEven && blended < breakEven.breakEvenRoas ? "negative" : undefined,
    },
    {
      id: "cash-flow",
      label: "Cash Flow",
      value: operatingCashFlow != null ? fmtCurrency(operatingCashFlow) : "—",
      sublabel: profitUnavailable ? "Complete Profit Setup" : "Net profit after ad spend & costs",
      tone:
        operatingCashFlow != null
          ? operatingCashFlow >= 0
            ? "positive"
            : "negative"
          : undefined,
    },
    {
      id: "ad-spend",
      label: "Ad Spend",
      value: spend30 > 0 ? fmtCurrency(spend30) : "—",
      sublabel: spend30 > 0 ? undefined : "Connect Meta or Google Ads",
    },
    {
      id: "cvr",
      label: "Conversion Rate",
      value: cvrFromGa4 != null ? `${cvrFromGa4.toFixed(2)}%` : "—",
      sublabel: ga4?.ecommerceConversionRatePct != null ? "GA4 ecommerce" : cvrFromGa4 != null ? "Orders ÷ GA4 sessions" : "Connect GA4",
    },
    {
      id: "aov",
      label: "Average Order Value",
      value: m.orders30d > 0 ? fmtCurrency(m.aov30d) : "—",
      sublabel: "Revenue ÷ orders",
    },
    {
      id: "sessions",
      label: "Sessions",
      value: ga4Sessions != null ? ga4Sessions.toLocaleString() : "—",
      sublabel: ga4Sessions != null ? "GA4" : "Connect GA4",
    },
    {
      id: "returning",
      label: "Returning Customers",
      value: returningPct != null ? `${returningPct.toFixed(0)}%` : "—",
      sublabel: returningPct != null ? "GA4 returning users" : "Connect GA4",
    },
    {
      id: "engagement-rate",
      label: "Engagement Rate",
      value: engagementRate != null ? `${engagementRate.toFixed(0)}%` : "—",
      sublabel: engagementRate != null ? "GA4" : "Connect GA4",
    },
    {
      id: "avg-session-duration",
      label: "Avg Session Duration",
      value: formatSessionDuration(avgSessionDuration),
      sublabel: avgSessionDuration != null ? "GA4" : "Connect GA4",
    },
  ];

  const daily = snapshot.dailyMetrics ?? [];
  const profitByDate = new Map<string, number>();
  const rollups = snapshot.profitRollups?.last30d;
  const cogsRate =
    rollups && rollups.revenue > 0 ? rollups.cogs / rollups.revenue : 0.42;
  const shippingPerOrder =
    rollups && rollups.orders > 0 ? rollups.shipping / rollups.orders : 8;
  for (const d of daily) {
    const cogs = d.revenue * cogsRate;
    const shipping = d.orders * shippingPerOrder;
    profitByDate.set(
      d.date,
      Math.round((d.revenue - d.adSpend - cogs - shipping) * 100) / 100,
    );
  }

  const charts = buildChartsFromDaily(daily, {
    profitByDate,
    ga4: snapshot.ga4Snapshot,
  });

  return {
    syncedAt: snapshot.syncedAt,
    metrics,
    charts,
    summary: executiveSummary ?? null,
    trends: trends ?? null,
  };
}

export { buildChartsFromDaily };
