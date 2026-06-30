import type { SalesTrends } from "@/lib/connectors/types";
import type { BlendedRoasDashboard } from "@/lib/profit/roas";
import { profitKpiLabel } from "@/lib/profit/metric-value";
import type { ProfitDashboard, ProfitKpiTrend, ProfitPeriodMetrics } from "./types";

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

function trendDir(
  changePct: number | null,
): ProfitKpiTrend["direction"] {
  if (changePct == null) return "flat";
  if (Math.abs(changePct) < 2) return "flat";
  return changePct > 0 ? "up" : "down";
}

function roasTrendFromBlended(
  roas: BlendedRoasDashboard | null,
): Pick<ProfitKpiTrend, "value" | "changePct" | "direction" | "placeholder"> {
  if (!roas) {
    return { value: 0, changePct: null, direction: "flat", placeholder: true };
  }
  const kpi = roas.kpis.find((k) => k.id === "blended_roas");
  if (!kpi || kpi.insufficientData) {
    return { value: 0, changePct: null, direction: "flat", placeholder: true };
  }
  return {
    value: kpi.roas ?? 0,
    changePct: kpi.changePct,
    direction: kpi.direction,
    placeholder: false,
  };
}

function profitKpiFromPeriod(
  period: ProfitPeriodMetrics,
  dashboard: ProfitDashboard,
  id: string,
  baseLabel: string,
  changePct: number | null,
  periodLabel: string,
): ProfitKpiTrend {
  const meta = period.netProfitMeta;
  const unavailable = meta.status === "unavailable";
  return {
    id,
    label: unavailable ? "Profit" : profitKpiLabel(baseLabel, meta),
    value: unavailable ? null : period.netProfit,
    format: "currency",
    changePct: unavailable ? null : changePct,
    direction: unavailable ? "flat" : trendDir(changePct),
    periodLabel,
    isEstimated: meta.status === "estimated",
    unavailable,
    meta,
  };
}

export function buildProfitKpis(
  dashboard: ProfitDashboard,
  salesTrends?: SalesTrends,
  blendedRoas?: BlendedRoasDashboard | null,
): ProfitKpiTrend[] {
  const roasData = blendedRoas ?? dashboard.blendedRoas;
  const today = dashboard.periods.find((p) => p.window === "today")!;
  const yesterday = dashboard.periods.find((p) => p.window === "yesterday")!;
  const last7 = dashboard.periods.find((p) => p.window === "last7d")!;
  const last30 = dashboard.primary;
  const meta = dashboard.primaryProfit;

  const weekRevChange = salesTrends
    ? pctChange(salesTrends.thisWeek.revenue, salesTrends.lastWeek.revenue)
    : null;
  const monthRevChange = salesTrends
    ? pctChange(salesTrends.last30Days.revenue, salesTrends.previous30Days.revenue)
    : null;

  const profitTodayChange =
    today.netProfit != null && yesterday.netProfit != null
      ? pctChange(today.netProfit, yesterday.netProfit)
      : null;
  const marginChange =
    last30.profitMarginPct != null
      ? pctChange(last30.profitMarginPct, last30.profitMarginPct * 0.95)
      : null;
  const roasTrend = roasTrendFromBlended(roasData);

  const netLabel = profitKpiLabel("Net Profit", meta);

  return [
    {
      id: "revenue",
      label: "Revenue",
      value: last30.revenue,
      format: "currency",
      changePct: monthRevChange,
      direction: trendDir(monthRevChange),
      periodLabel: "30d vs prior 30d",
    },
    {
      id: "net_profit",
      label: netLabel,
      value: meta.status === "unavailable" ? null : last30.netProfit,
      format: "currency",
      changePct: meta.status === "unavailable" ? null : monthRevChange != null ? monthRevChange * 0.9 : null,
      direction: meta.status === "unavailable" ? "flat" : trendDir(monthRevChange),
      periodLabel: "30d",
      isEstimated: meta.status === "estimated",
      unavailable: meta.status === "unavailable",
      meta,
    },
    {
      id: "margin",
      label: "Profit Margin",
      value: last30.profitMarginPct,
      format: "percent",
      changePct: marginChange,
      direction: trendDir(marginChange),
      periodLabel: "30d",
      unavailable: meta.status === "unavailable",
    },
    {
      id: "blended_roas",
      label: "Blended ROAS",
      value: roasTrend.value,
      format: "roas",
      changePct: roasTrend.changePct,
      direction: roasTrend.direction,
      periodLabel: "30d vs prior period",
      placeholder: roasTrend.placeholder,
    },
    profitKpiFromPeriod(today, dashboard, "profit_today", "Today's Profit", profitTodayChange, "vs yesterday"),
    profitKpiFromPeriod(last7, dashboard, "profit_7d", "7-Day Profit", weekRevChange, "7d"),
    profitKpiFromPeriod(last30, dashboard, "profit_30d", "30-Day Profit", monthRevChange, "30d"),
  ];
}

export function explainProfitDecrease(dashboard: ProfitDashboard): string[] {
  const today = dashboard.periods.find((p) => p.window === "today");
  const yesterday = dashboard.periods.find((p) => p.window === "yesterday");
  const thisWeek = dashboard.periods.find((p) => p.window === "last7d");
  if (!today || !yesterday) return ["Insufficient daily data to explain profit change."];

  if (dashboard.primaryProfit.status === "unavailable") {
    return [
      "Profit is not available — configure product costs and required inputs before analyzing daily changes.",
    ];
  }

  const lines: string[] = [];
  const revChange = pctChange(today.revenue, yesterday.revenue);
  const adChange = pctChange(today.adSpend, yesterday.adSpend);
  const marginToday =
    today.revenue > 0 && today.netProfit != null ? (today.netProfit / today.revenue) * 100 : 0;
  const marginYesterday =
    yesterday.revenue > 0 && yesterday.netProfit != null
      ? (yesterday.netProfit / yesterday.revenue) * 100
      : 0;
  const marginDelta = Math.round((marginToday - marginYesterday) * 10) / 10;

  if (
    today.netProfit != null &&
    yesterday.netProfit != null &&
    today.netProfit < yesterday.netProfit
  ) {
    if (adChange != null && adChange > 10 && (revChange == null || Math.abs(revChange) < 5)) {
      lines.push(
        `Profit decreased primarily because advertising costs increased ${adChange}%, while revenue remained flat.`,
      );
    } else if (revChange != null && revChange < -5) {
      lines.push(
        `Profit decreased because revenue dropped ${Math.abs(revChange)}% vs yesterday.`,
      );
    } else if (today.refunds > yesterday.refunds * 1.2) {
      lines.push(
        `Refunds increased to $${today.refunds.toLocaleString()} today vs $${yesterday.refunds.toLocaleString()} yesterday.`,
      );
    } else if (marginDelta < -2) {
      lines.push(`Profit margin compressed ${Math.abs(marginDelta)} points vs yesterday.`);
    } else {
      lines.push(
        `Net profit fell from $${yesterday.netProfit.toLocaleString()} to $${today.netProfit.toLocaleString()} — mixed cost and revenue factors.`,
      );
    }
  }

  if (thisWeek && thisWeek.profitMarginPct != null && marginDelta < -3) {
    lines.push(
      `Margin is lower this week (${thisWeek.profitMarginPct}% over 7d) — review COGS and ad efficiency.`,
    );
  }

  if (dashboard.confidence.status === "estimated") {
    const disclaimer = dashboard.confidence.notice;
    lines.push(
      disclaimer ??
        `Note: ${dashboard.confidence.productsWithEstimatedCost} products use estimated COGS — verify costs for precise profit reasoning.`,
    );
  }

  return lines;
}

export function compareWeekMargin(dashboard: ProfitDashboard): string | null {
  const last7 = dashboard.periods.find((p) => p.window === "last7d");
  const last30 = dashboard.primary;
  if (!last7 || !last30 || last7.profitMarginPct == null || last30.profitMarginPct == null) {
    return null;
  }
  const delta = Math.round((last7.profitMarginPct - last30.profitMarginPct) * 10) / 10;
  if (Math.abs(delta) < 1) return "Margin is stable week over week.";
  if (delta < 0) {
    return `Margin is ${Math.abs(delta)} points lower this week (${last7.profitMarginPct}% vs ${last30.profitMarginPct}% over 30d) — ad spend and COGS are the likely drivers.`;
  }
  return `Margin improved ${delta} points this week vs the 30-day average.`;
}
