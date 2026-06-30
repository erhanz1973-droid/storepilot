import type { ProfitForecast } from "@/lib/autopilot/types";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function ProfitForecastPanel({ forecasts }: { forecasts: ProfitForecast[] }) {
  return (
    <div className="card">
      <h3>Profit Forecast</h3>
      <p className="muted" style={{ marginTop: 4, marginBottom: 12, fontSize: "0.875rem" }}>
        Optimistic · Expected · Conservative scenarios
      </p>
      <div className="forecast-grid">
        {forecasts.map((f) => (
          <div key={f.horizonDays} className="forecast-col">
            <h4>{f.horizonDays} days</h4>
            <dl className="forecast-scenarios">
              <div>
                <dt>Expected profit</dt>
                <dd>{formatMoney(f.expected.profit)}</dd>
              </div>
              <div>
                <dt>Optimistic</dt>
                <dd className="positive">{formatMoney(f.optimistic.profit)}</dd>
              </div>
              <div>
                <dt>Conservative</dt>
                <dd>{formatMoney(f.conservative.profit)}</dd>
              </div>
              <div>
                <dt>Expected revenue</dt>
                <dd>{formatMoney(f.expected.revenue)}</dd>
              </div>
              <div>
                <dt>ROAS</dt>
                <dd>{f.expected.roas?.toFixed(2) ?? "—"}</dd>
              </div>
            </dl>
            <span className="muted" style={{ fontSize: "0.75rem" }}>{f.confidencePct}% confidence</span>
          </div>
        ))}
      </div>
    </div>
  );
}
