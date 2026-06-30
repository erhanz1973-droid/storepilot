import type { MetricCard } from "@/lib/analytics/types";

function changeClass(pct: number | null | undefined): string {
  if (pct == null) return "";
  if (pct > 0) return "metric-change-up";
  if (pct < 0) return "metric-change-down";
  return "";
}

function formatChange(pct: number | null | undefined): string {
  if (pct == null) return "";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}% vs prior`;
}

export function MetricGrid({ metrics }: { metrics: MetricCard[] }) {
  return (
    <div className="analytics-metric-grid">
      {metrics.map((m) => (
        <div
          key={m.id}
          className={`analytics-metric-card ${m.emphasize ? "analytics-metric-hero" : ""} ${m.tone ? `tone-${m.tone}` : ""}`}
        >
          <p className="analytics-metric-label">{m.label}</p>
          <p className="analytics-metric-value">{m.value}</p>
          {m.sublabel && <p className="analytics-metric-sublabel">{m.sublabel}</p>}
          {m.changePct != null && (
            <p className={`analytics-metric-change ${changeClass(m.changePct)}`}>
              {formatChange(m.changePct)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function MetricGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="analytics-metric-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="analytics-metric-card skeleton" />
      ))}
    </div>
  );
}
