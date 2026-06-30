import type { SalesTrends } from "@/lib/connectors/types";

export type TrendDirection = "up" | "down" | "flat" | "unknown";

export type PeriodComparison = {
  currentRevenue: number;
  previousRevenue: number;
  currentOrders: number;
  previousOrders: number;
  changePct: number | null;
  direction: TrendDirection;
};

export type SalesTrendAnalysis = {
  hasSufficientHistory: boolean;
  weekOverWeek: PeriodComparison | null;
  monthOverMonth: PeriodComparison | null;
  /** True only when a valid comparison shows a meaningful decline */
  salesDecreased: boolean;
  confidencePenalty: number;
};

const FLAT_THRESHOLD_PCT = 2;

function comparePeriod(
  currentRevenue: number,
  previousRevenue: number,
  currentOrders: number,
  previousOrders: number,
  hasBaseline: boolean,
): PeriodComparison | null {
  if (!hasBaseline) return null;

  let changePct: number | null = null;
  let direction: TrendDirection = "unknown";

  if (previousRevenue > 0) {
    changePct = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
    if (Math.abs(changePct) <= FLAT_THRESHOLD_PCT) direction = "flat";
    else if (changePct < 0) direction = "down";
    else direction = "up";
  } else if (currentRevenue > 0) {
    changePct = 100;
    direction = "up";
  } else {
    direction = "flat";
    changePct = 0;
  }

  return {
    currentRevenue,
    previousRevenue,
    currentOrders,
    previousOrders,
    changePct,
    direction,
  };
}

export function analyzeSalesTrends(trends: SalesTrends | undefined): SalesTrendAnalysis {
  if (!trends) {
    return {
      hasSufficientHistory: false,
      weekOverWeek: null,
      monthOverMonth: null,
      salesDecreased: false,
      confidencePenalty: 0.35,
    };
  }

  const hasWeekBaseline = trends.lastWeek.orders > 0;
  const hasMonthBaseline = trends.previous30Days.orders > 0;
  const hasSufficientHistory = hasWeekBaseline || hasMonthBaseline;

  const weekOverWeek = comparePeriod(
    trends.thisWeek.revenue,
    trends.lastWeek.revenue,
    trends.thisWeek.orders,
    trends.lastWeek.orders,
    hasWeekBaseline,
  );

  const monthOverMonth = comparePeriod(
    trends.last30Days.revenue,
    trends.previous30Days.revenue,
    trends.last30Days.orders,
    trends.previous30Days.orders,
    hasMonthBaseline,
  );

  const salesDecreased =
    weekOverWeek?.direction === "down" || monthOverMonth?.direction === "down";

  const confidencePenalty = hasSufficientHistory ? 0 : 0.35;

  return {
    hasSufficientHistory,
    weekOverWeek,
    monthOverMonth,
    salesDecreased,
    confidencePenalty,
  };
}

export function formatTrendLine(label: string, comparison: PeriodComparison): string {
  const current = comparison.currentRevenue.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const previous = comparison.previousRevenue.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  if (comparison.direction === "unknown") {
    return `• **${label}:** ${current} (${comparison.currentOrders} orders) vs ${previous} prior period — insufficient prior revenue to calculate change.`;
  }

  const pct =
    comparison.changePct === null
      ? "n/a"
      : `${comparison.changePct > 0 ? "+" : ""}${comparison.changePct.toFixed(1)}%`;

  const verb =
    comparison.direction === "down"
      ? "decreased"
      : comparison.direction === "up"
        ? "increased"
        : "held steady";

  return `• **${label}:** ${current} (${comparison.currentOrders} orders) vs ${previous} (${comparison.previousOrders} orders) prior — revenue ${verb} (${pct}).`;
}

export const INSUFFICIENT_SALES_HISTORY_MESSAGE =
  "I cannot determine whether sales decreased because there isn't enough historical sales data.";

export const CAMPAIGN_INSUFFICIENT_DELIVERY_MESSAGE =
  "This campaign has not accumulated enough delivery data to evaluate performance.";

export function campaignHasDeliveryData(campaign: {
  spend7d: number;
  impressions7d: number;
  revenue7d: number;
}): boolean {
  return campaign.spend7d > 0 && campaign.impressions7d > 0 && campaign.revenue7d > 0;
}
