"use client";

import type { BlendedRoasKpi } from "@/lib/profit/roas";

function formatRoas(kpi: BlendedRoasKpi): string {
  if (kpi.insufficientData || kpi.roas == null) return "—";
  return kpi.roas.toFixed(2);
}

function trendSymbol(direction: BlendedRoasKpi["direction"]): string {
  if (direction === "up") return "↑";
  if (direction === "down") return "↓";
  return "→";
}

function trendClass(kpi: BlendedRoasKpi): string {
  if (kpi.insufficientData) return "roas-insufficient";
  if (kpi.direction === "up") return "roas-improving";
  if (kpi.direction === "down") return "roas-declining";
  return "roas-flat";
}

export function BlendedRoasKpiStrip({ kpis }: { kpis: BlendedRoasKpi[] }) {
  return (
    <div className="profit-kpi-strip roas-kpi-strip">
      {kpis.map((kpi) => (
        <div
          key={kpi.id}
          className={`profit-kpi-card roas-kpi-card ${trendClass(kpi)}`}
        >
          <span className="muted profit-kpi-card-label">{kpi.label}</span>
          <strong className="profit-kpi-card-value">{formatRoas(kpi)}</strong>
          {kpi.insufficientData ? (
            <span className="muted" style={{ fontSize: "0.75rem" }}>
              Insufficient data
            </span>
          ) : kpi.changePct != null ? (
            <span className={`profit-kpi-trend ${trendClass(kpi)}`} style={{ fontSize: "0.8rem" }}>
              {trendSymbol(kpi.direction)} {kpi.changePct > 0 ? "+" : ""}
              {kpi.changePct}% <span className="muted">{kpi.periodLabel}</span>
            </span>
          ) : (
            <span className="muted" style={{ fontSize: "0.75rem" }}>
              {kpi.periodLabel}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
