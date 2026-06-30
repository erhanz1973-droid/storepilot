import type {
  ComparisonStatus,
  DiffSeverity,
  MatchScoreResult,
  MetricComparisonRow,
  ValidationSnapshot,
} from "./types";

const WARN_THRESHOLD_PCT = 1;
const FAIL_THRESHOLD_PCT = 5;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeDeviationPct(
  dashboard: number,
  api: number,
): number {
  const base = Math.max(Math.abs(api), 0.01);
  return round2((Math.abs(dashboard - api) / base) * 100);
}

export function diffSeverity(differencePct: number | null): DiffSeverity {
  if (differencePct === null) return "red";
  if (differencePct <= 0) return "green";
  if (differencePct <= WARN_THRESHOLD_PCT) return "green";
  if (differencePct <= FAIL_THRESHOLD_PCT) return "yellow";
  return "red";
}

export function comparisonStatus(differencePct: number | null, exactMatch = false): ComparisonStatus {
  if (exactMatch) return differencePct === 0 ? "pass" : "fail";
  if (differencePct === null) return "fail";
  if (differencePct <= WARN_THRESHOLD_PCT) return "pass";
  if (differencePct <= FAIL_THRESHOLD_PCT) return "warn";
  return "fail";
}

function compareNumeric(metric: string, dashboard: number, api: number): MetricComparisonRow {
  const differencePct = computeDeviationPct(dashboard, api);
  const severity = diffSeverity(differencePct);
  return {
    metric,
    dashboard: round2(dashboard),
    api: round2(api),
    differencePct,
    status: comparisonStatus(differencePct),
    severity,
  };
}

function compareExact(metric: string, dashboard: string, api: string): MetricComparisonRow {
  const match = dashboard.toUpperCase() === api.toUpperCase();
  return {
    metric,
    dashboard,
    api,
    differencePct: match ? 0 : 100,
    status: match ? "pass" : "fail",
    severity: match ? "green" : "red",
  };
}

/** Build comparison rows for the core validation metrics. */
export function compareSnapshots(
  dashboard: ValidationSnapshot,
  api: ValidationSnapshot,
): MetricComparisonRow[] {
  return [
    compareNumeric("Campaign Count", dashboard.campaigns, api.campaigns),
    compareNumeric("Spend", dashboard.spend, api.spend),
    compareNumeric("Purchase Value", dashboard.revenue, api.revenue),
    compareNumeric("Purchases", dashboard.purchases, api.purchases),
    compareNumeric("ROAS", dashboard.roas, api.roas),
    compareExact("Currency", dashboard.currency, api.currency),
    compareExact("Date Range", dashboard.dateRange, api.dateRange),
  ];
}

/** Compute overall match score from metric comparisons (0–100). */
export function computeMatchScore(comparisons: MetricComparisonRow[]): MatchScoreResult {
  if (comparisons.length === 0) {
    return {
      percent: 0,
      status: "red",
      emoji: "🔴",
      label: "0% Match",
      passedMetrics: 0,
      totalMetrics: 0,
    };
  }

  const scores = comparisons.map((row) => {
    if (row.differencePct === null) return 0;
    return Math.max(0, round2(100 - row.differencePct));
  });

  const percent = round2(scores.reduce((a, b) => a + b, 0) / scores.length);
  const passedMetrics = comparisons.filter((c) => c.status === "pass").length;
  const totalMetrics = comparisons.length;

  let status: DiffSeverity = "red";
  let emoji = "🔴";
  if (percent >= 99.5) {
    status = "green";
    emoji = "🟢";
  } else if (percent >= 90) {
    status = "yellow";
    emoji = "🟡";
  }

  const label =
    percent === 100
      ? "100% Match"
      : `${percent % 1 === 0 ? percent.toFixed(0) : percent.toFixed(1)}% Match`;

  return {
    percent,
    status,
    emoji,
    label,
    passedMetrics,
    totalMetrics,
  };
}

export function snapshotFromMetrics(input: {
  spend: number;
  roas: number;
  revenue: number;
  purchases: number;
  campaigns: number;
  currency: string;
  dateRange?: string;
}): ValidationSnapshot {
  return {
    spend: round2(input.spend),
    roas: round2(input.roas),
    revenue: round2(input.revenue),
    purchases: round2(input.purchases),
    campaigns: input.campaigns,
    currency: input.currency,
    dateRange: input.dateRange ?? "Last 30 Days",
  };
}

export const EMPTY_SNAPSHOT: ValidationSnapshot = {
  spend: 0,
  roas: 0,
  revenue: 0,
  purchases: 0,
  campaigns: 0,
  currency: "—",
  dateRange: "Last 30 Days",
};
