import type { LiveKpiCard } from "@/lib/live/mission-control-types";
import { memo } from "react";

function toneClass(tone?: LiveKpiCard["tone"]): string {
  if (tone === "positive") return "live-kpi-positive";
  if (tone === "negative") return "live-kpi-negative";
  if (tone === "warning") return "live-kpi-warning";
  return "";
}

export const LiveSmartKpiGrid = memo(function LiveSmartKpiGrid({ kpis }: { kpis: LiveKpiCard[] }) {
  return (
    <div className="analytics-metric-grid live-kpi-grid">
      {kpis.map((kpi) => (
        <div
          key={kpi.id}
          className={`analytics-metric-card live-kpi-card ${toneClass(kpi.tone)} ${kpi.emphasize ? "analytics-metric-hero" : ""}`}
        >
          <p className="analytics-metric-label">{kpi.label}</p>
          <p className="analytics-metric-value">{kpi.value}</p>
          {kpi.sublabel && <p className="analytics-metric-sublabel">{kpi.sublabel}</p>}
          {kpi.reason && (
            <p className="live-kpi-reason">
              <span className="live-kpi-reason-label">Reason</span> {kpi.reason}
            </p>
          )}
          {(kpi.targetValue || kpi.statusLabel) && (
            <div className="live-kpi-meta">
              {kpi.targetValue && (
                <span>
                  <span className="muted">Target </span>
                  {kpi.targetValue}
                </span>
              )}
              {kpi.statusLabel && (
                <span className={`live-kpi-status live-kpi-status-${kpi.tone ?? "default"}`}>
                  Status {kpi.statusLabel}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
});
