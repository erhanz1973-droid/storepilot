"use client";

import type { AnalyticsDateRange } from "@/lib/analytics/types";
import { ANALYTICS_DATE_RANGE_LABELS } from "@/lib/analytics/types";

const PRESETS: AnalyticsDateRange[] = [
  "today",
  "yesterday",
  "last7d",
  "last30d",
  "last90d",
];

type Props = {
  value: AnalyticsDateRange;
  onChange: (range: AnalyticsDateRange) => void;
};

export function DateRangeSelector({ value, onChange }: Props) {
  return (
    <div className="analytics-date-range" role="group" aria-label="Date range">
      {PRESETS.map((range) => (
        <button
          key={range}
          type="button"
          className={`analytics-range-btn ${value === range ? "active" : ""}`}
          onClick={() => onChange(range)}
        >
          {ANALYTICS_DATE_RANGE_LABELS[range]}
        </button>
      ))}
      <button
        type="button"
        className={`analytics-range-btn ${value === "custom" ? "active" : ""}`}
        onClick={() => onChange("custom")}
        title="Custom range — coming soon"
      >
        {ANALYTICS_DATE_RANGE_LABELS.custom}
      </button>
    </div>
  );
}
