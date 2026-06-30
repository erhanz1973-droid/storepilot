"use client";

import { memo, useCallback, useMemo, useState } from "react";
import type { ChartDefinition } from "@/lib/analytics/types";

function formatValue(value: number, format: ChartDefinition["format"]): string {
  switch (format) {
    case "currency":
      return value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${Math.round(value)}`;
    case "percent":
      return `${value.toFixed(1)}%`;
    case "ratio":
      return value.toFixed(2);
    default:
      return value.toLocaleString();
  }
}

type Props = {
  chart: ChartDefinition;
  comparePrevious?: boolean;
  height?: number;
};

function chartDataKey(chart: ChartDefinition): string {
  return chart.series
    .map((s) => s.points.map((p) => `${p.date}:${p.value}`).join(","))
    .join("|");
}

export const TrendChart = memo(function TrendChart({
  chart,
  comparePrevious = true,
  height = 220,
}: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const visibleSeries = useMemo(
    () => chart.series.filter((s) => !hidden.has(s.id)),
    [chart.series, hidden],
  );

  const maxVal = useMemo(() => {
    const vals = visibleSeries.flatMap((s) => s.points.map((p) => p.value));
    return Math.max(...vals, 1);
  }, [visibleSeries]);

  const pointCount = useMemo(
    () => Math.max(...chart.series.map((s) => s.points.length), 0),
    [chart.series],
  );

  const layout = useMemo(() => {
    const width = 720;
    const pad = { top: 16, right: 16, bottom: 28, left: 52 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const x = (i: number) =>
      pad.left + (pointCount <= 1 ? innerW / 2 : (i / (pointCount - 1)) * innerW);
    const y = (v: number) => pad.top + innerH - (v / maxVal) * innerH;
    return { width, pad, innerW, innerH, x, y };
  }, [height, maxVal, pointCount]);

  const seriesPaths = useMemo(() => {
    const { x, y } = layout;
    return visibleSeries.map((s) => ({
      id: s.id,
      color: s.color,
      d: s.points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.value)}`).join(" "),
    }));
  }, [layout, visibleSeries]);

  const toggleSeries = useCallback((id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (pointCount === 0) {
    return (
      <div className="analytics-chart card">
        <h3>{chart.title}</h3>
        <p className="muted" style={{ margin: 0 }}>
          Not enough data for this chart.
        </p>
      </div>
    );
  }

  const { width, pad, innerW, innerH, x, y } = layout;

  return (
    <div className="analytics-chart card">
      <div className="analytics-chart-header">
        <h3>{chart.title}</h3>
        <div className="analytics-chart-legend">
          {chart.series.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`analytics-legend-item ${hidden.has(s.id) ? "muted" : ""}`}
              onClick={() => toggleSeries(s.id)}
            >
              <span className="analytics-legend-dot" style={{ background: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="analytics-chart-svg" role="img">
        {seriesPaths.map((s) => (
          <path
            key={s.id}
            d={s.d}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ))}
        {hoverIdx != null && visibleSeries[0]?.points[hoverIdx] && (
          <line
            x1={x(hoverIdx)}
            x2={x(hoverIdx)}
            y1={pad.top}
            y2={pad.top + innerH}
            stroke="var(--border)"
            strokeDasharray="4 4"
          />
        )}
        {Array.from({ length: pointCount }).map((_, i) => (
          <rect
            key={i}
            x={x(i) - innerW / pointCount / 2}
            y={pad.top}
            width={innerW / pointCount}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          />
        ))}
      </svg>

      {hoverIdx != null && visibleSeries[0]?.points[hoverIdx] && (
        <div className="analytics-chart-tooltip">
          <strong>{visibleSeries[0].points[hoverIdx]!.date}</strong>
          {visibleSeries.map((s) => {
            const pt = s.points[hoverIdx];
            if (!pt) return null;
            return (
              <div key={s.id}>
                {s.label}: {formatValue(pt.value, chart.format)}
              </div>
            );
          })}
          {comparePrevious && hoverIdx > 0 && visibleSeries[0]?.points[hoverIdx - 1] && (
            <div className="muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>
              vs prior:{" "}
              {formatValue(
                visibleSeries[0].points[hoverIdx]!.value -
                  visibleSeries[0].points[hoverIdx - 1]!.value,
                chart.format,
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}, chartPropsEqual);

function chartPropsEqual(prev: Props, next: Props): boolean {
  return (
    prev.height === next.height &&
    prev.comparePrevious === next.comparePrevious &&
    prev.chart.id === next.chart.id &&
    prev.chart.title === next.chart.title &&
    prev.chart.format === next.chart.format &&
    chartDataKey(prev.chart) === chartDataKey(next.chart)
  );
}
