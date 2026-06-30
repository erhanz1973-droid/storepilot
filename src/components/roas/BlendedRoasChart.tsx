"use client";

import type { DailyMetricPoint } from "@/lib/ads/types";
import type { RoasTrendRange } from "@/lib/ads/types";
import { useMemo, useState } from "react";

type Props = {
  series: DailyMetricPoint[];
};

const RANGES: { id: RoasTrendRange; label: string; days: number }[] = [
  { id: "today", label: "Today", days: 1 },
  { id: "last7d", label: "7 Days", days: 7 },
  { id: "last30d", label: "30 Days", days: 30 },
  { id: "last90d", label: "90 Days", days: 90 },
];

function formatMoney(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

export function BlendedRoasChart({ series }: Props) {
  const [range, setRange] = useState<RoasTrendRange>("last30d");

  const { points, maxRev, maxSpend, maxRoas } = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)?.days ?? 30;
    const sliced = series.slice(-days);
    const withRoas = sliced.map((p) => ({
      ...p,
      roas: p.adSpend > 0 ? p.revenue / p.adSpend : 0,
    }));
    return {
      points: withRoas,
      maxRev: Math.max(...withRoas.map((p) => p.revenue), 1),
      maxSpend: Math.max(...withRoas.map((p) => p.adSpend), 1),
      maxRoas: Math.max(...withRoas.map((p) => p.roas), 1),
    };
  }, [series, range]);

  if (series.length === 0) {
    return (
      <div className="card">
        <h3>ROAS Trend</h3>
        <p className="muted" style={{ margin: 0 }}>Not enough history for trend charts.</p>
      </div>
    );
  }

  const width = 640;
  const height = 220;
  const pad = { top: 16, right: 16, bottom: 28, left: 48 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  function x(i: number): number {
    return pad.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  }

  function yRev(v: number): number {
    return pad.top + innerH - (v / maxRev) * innerH;
  }

  function ySpend(v: number): number {
    return pad.top + innerH - (v / maxSpend) * innerH;
  }

  function yRoas(v: number): number {
    return pad.top + innerH - (v / maxRoas) * innerH;
  }

  const revPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${yRev(p.revenue)}`)
    .join(" ");
  const spendPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${ySpend(p.adSpend)}`)
    .join(" ");
  const roasPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${yRoas(p.roas)}`)
    .join(" ");

  const labelStep = Math.max(1, Math.floor(points.length / 6));

  return (
    <div className="card roas-chart-card">
      <div className="roas-chart-header">
        <h3 style={{ margin: 0 }}>Revenue · Ad Spend · Blended ROAS</h3>
        <div className="roas-range-tabs">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`roas-range-tab ${range === r.id ? "active" : ""}`}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="roas-chart-legend">
        <span><i className="roas-legend-dot revenue" /> Revenue</span>
        <span><i className="roas-legend-dot spend" /> Ad Spend</span>
        <span><i className="roas-legend-dot roas" /> Blended ROAS</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="roas-chart-svg" role="img">
        <line
          x1={pad.left}
          y1={pad.top + innerH}
          x2={pad.left + innerW}
          y2={pad.top + innerH}
          stroke="var(--border)"
        />
        <path d={revPath} fill="none" stroke="#2563eb" strokeWidth="2" />
        <path d={spendPath} fill="none" stroke="#dc2626" strokeWidth="2" strokeDasharray="4 3" />
        <path d={roasPath} fill="none" stroke="#16a34a" strokeWidth="2.5" />
        {points.map((p, i) =>
          i % labelStep === 0 || i === points.length - 1 ? (
            <text
              key={p.date}
              x={x(i)}
              y={height - 6}
              textAnchor="middle"
              fontSize="9"
              fill="var(--muted)"
            >
              {p.date.slice(5)}
            </text>
          ) : null,
        )}
      </svg>

      <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.8rem" }}>
        Blended ROAS = total Shopify revenue ÷ total ad spend per day. Compare periods using the range tabs above.
      </p>
    </div>
  );
}
