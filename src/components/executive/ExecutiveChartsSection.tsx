"use client";

import { useState } from "react";
import type { ChartDefinition } from "@/lib/analytics/types";
import { TrendChart } from "@/components/analytics/TrendChart";

type Props = {
  primaryCharts: ChartDefinition[];
  secondaryCharts: ChartDefinition[];
};

export function ExecutiveChartsSection({ primaryCharts, secondaryCharts }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="exec-charts">
      <div className="analytics-charts-grid exec-charts-primary">
        {primaryCharts.map((chart) => (
          <TrendChart key={chart.id} chart={chart} />
        ))}
      </div>

      {secondaryCharts.length > 0 && (
        <>
          <button
            type="button"
            className="exec-charts-toggle btn btn-ghost"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
          >
            {expanded ? "Hide additional charts" : `Show ${secondaryCharts.length} more charts`}
          </button>
          {expanded && (
            <div className="analytics-charts-grid exec-charts-secondary">
              {secondaryCharts.map((chart) => (
                <TrendChart key={chart.id} chart={chart} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
