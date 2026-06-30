import type { AnalyticsDateRange } from "./types";

export function dateRangeToDays(range: AnalyticsDateRange): number {
  switch (range) {
    case "today":
    case "yesterday":
      return 1;
    case "last7d":
      return 7;
    case "last30d":
      return 30;
    case "last90d":
      return 90;
    default:
      return 30;
  }
}

export function sliceSeriesByRange<T extends { date: string }>(
  series: T[],
  range: AnalyticsDateRange,
): T[] {
  const days = dateRangeToDays(range);
  if (range === "yesterday" && series.length > 1) {
    return series.slice(-Math.min(days + 1, series.length), -1);
  }
  return series.slice(-days);
}
