import type { TrendAnalysis } from "@/lib/insights/types";

function formatValue(value: number, unit: TrendAnalysis["metrics"][0]["unit"]): string {
  if (unit === "currency") {
    return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }
  if (unit === "percent") return `${value.toFixed(2)}%`;
  if (unit === "ratio") return value.toFixed(2);
  return value.toLocaleString();
}

function arrow(direction: "up" | "down" | "flat"): string {
  if (direction === "up") return "↑";
  if (direction === "down") return "↓";
  return "→";
}

export function TrendSummaryPanel({ trends }: { trends: TrendAnalysis }) {
  if (trends.metrics.length === 0) return null;

  const byWindow = {
    "7d": trends.metrics.filter((m) => m.window === "7d"),
    "30d": trends.metrics.filter((m) => m.window === "30d"),
    "90d": trends.metrics.filter((m) => m.window === "90d"),
  };

  return (
    <div className="card">
      <h3 style={{ marginBottom: 4 }}>Trend Detection</h3>
      <p className="muted" style={{ marginTop: 0, marginBottom: 12, fontSize: "0.9rem" }}>
        {trends.interpretation}
      </p>

      {(["7d", "30d", "90d"] as const).map((window) => {
        const metrics = byWindow[window];
        if (metrics.length === 0) return null;
        return (
          <div key={window} style={{ marginBottom: 16 }}>
            <h4 style={{ margin: "0 0 8px", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Last {window === "7d" ? "7 days" : window === "30d" ? "30 days" : "90 days"}
            </h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {metrics.map((m) => (
                <div key={m.id} className="metric-pill">
                  <span>{m.label}</span>
                  <span>
                    {arrow(m.direction)}{" "}
                    {m.changePct != null ? `${Math.abs(m.changePct).toFixed(0)}%` : "—"}
                  </span>
                  <span className="muted" style={{ fontSize: "0.75rem" }}>
                    {formatValue(m.current, m.unit)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
