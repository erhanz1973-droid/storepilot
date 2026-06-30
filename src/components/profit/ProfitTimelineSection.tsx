"use client";

import { TrendChart } from "@/components/analytics/TrendChart";
import { LazyWhenVisible } from "@/components/performance/LazyWhenVisible";
import type { ProfitPageView } from "@/lib/profit/profit-page-view";
import { useState } from "react";

const PERIODS: { id: keyof ProfitPageView["timelineCharts"]; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "last7d", label: "7 Days" },
  { id: "last30d", label: "30 Days" },
  { id: "last90d", label: "90 Days" },
];

export function ProfitTimelineSection({
  charts,
}: {
  charts: ProfitPageView["timelineCharts"];
}) {
  const [period, setPeriod] = useState<keyof ProfitPageView["timelineCharts"]>("last30d");
  const chart = charts[period];

  return (
    <div className="profit-timeline-section">
      <div className="profit-timeline-tabs">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`profit-timeline-tab ${period === p.id ? "active" : ""}`}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <LazyWhenVisible fallback={<p className="muted">Loading chart…</p>}>
        <TrendChart chart={chart} comparePrevious />
      </LazyWhenVisible>
    </div>
  );
}
