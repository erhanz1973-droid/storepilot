import type { ProfitKpiTrend } from "@/lib/profit/types";

function formatValue(kpi: ProfitKpiTrend): string {
  if (kpi.unavailable) return "Not Available";
  if (kpi.placeholder && kpi.format === "roas") return "—";
  if (kpi.value == null) return "—";
  if (kpi.format === "currency") {
    return kpi.value.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  }
  if (kpi.format === "percent") return `${kpi.value}%`;
  return kpi.value.toFixed(2);
}

function trendSymbol(direction: ProfitKpiTrend["direction"]): string {
  if (direction === "up") return "↑";
  if (direction === "down") return "↓";
  return "→";
}

function roasTrendClass(kpi: ProfitKpiTrend): string {
  if (kpi.placeholder) return "roas-insufficient";
  if (kpi.format !== "roas") return `trend-${kpi.direction}`;
  if (kpi.direction === "up") return "roas-improving";
  if (kpi.direction === "down") return "roas-declining";
  return "roas-flat";
}

export function ProfitKpiStrip({ kpis }: { kpis: ProfitKpiTrend[] }) {
  return (
    <div className="profit-kpi-strip">
      {kpis.map((kpi) => (
        <div
          key={kpi.id}
          className={`profit-kpi-card ${kpi.isEstimated ? "estimated" : ""} ${kpi.unavailable ? "unavailable" : ""} ${kpi.placeholder ? "placeholder roas-insufficient" : ""}`}
        >
          <span className="muted profit-kpi-card-label">{kpi.label}</span>
          <strong className="profit-kpi-card-value">{formatValue(kpi)}</strong>
          {kpi.placeholder ? (
            <span className="muted" style={{ fontSize: "0.75rem" }}>
              Insufficient data
            </span>
          ) : kpi.changePct != null ? (
            <span
              className={`profit-kpi-trend ${roasTrendClass(kpi)}`}
              style={{ fontSize: "0.8rem" }}
            >
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
