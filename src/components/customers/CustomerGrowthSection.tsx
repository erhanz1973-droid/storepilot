"use client";

import { TrendChart } from "@/components/analytics/TrendChart";
import type { CustomersPageView } from "@/lib/customers/types";
import { useState } from "react";

const PERIODS: { id: keyof CustomersPageView["growthCharts"]; label: string }[] = [
  { id: "last7d", label: "7 Days" },
  { id: "last30d", label: "30 Days" },
  { id: "last90d", label: "90 Days" },
];

export function CustomerGrowthSection({
  charts,
}: {
  charts: CustomersPageView["growthCharts"];
}) {
  const [period, setPeriod] = useState<keyof CustomersPageView["growthCharts"]>("last30d");
  const chart = charts[period];

  return (
    <div className="customers-growth-section">
      <div className="customers-growth-header">
        <h3 style={{ margin: 0 }}>Customer Growth</h3>
        <div className="customers-growth-tabs">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`customers-growth-tab ${period === p.id ? "active" : ""}`}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <TrendChart chart={chart} comparePrevious={false} />
    </div>
  );
}
