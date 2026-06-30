import type { DecisionForecastScenario } from "@/lib/approvals/decision-center-types";

function fmtMoney(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`;
}

export function DecisionForecastPanel({ forecast }: { forecast: DecisionForecastScenario }) {
  return (
    <div className="decision-forecast-panel">
      <h5>If Approved</h5>
      <dl className="decision-forecast-grid">
        <div>
          <dt>Estimated Profit</dt>
          <dd className="decision-exec-positive">{fmtMoney(forecast.estimatedProfit)}/mo</dd>
        </div>
        <div>
          <dt>Estimated Revenue</dt>
          <dd>{fmtMoney(forecast.estimatedRevenue)}/mo</dd>
        </div>
        {forecast.estimatedAdSpend !== 0 && (
          <div>
            <dt>Estimated Ad Spend</dt>
            <dd>{fmtMoney(forecast.estimatedAdSpend)}/mo</dd>
          </div>
        )}
        {forecast.roasBefore && (
          <div>
            <dt>Estimated ROAS</dt>
            <dd>
              {forecast.roasBefore}
              {forecast.roasAfter ? ` → ${forecast.roasAfter}` : ""}
            </dd>
          </div>
        )}
        <div>
          <dt>Confidence</dt>
          <dd>{forecast.confidencePct}%</dd>
        </div>
      </dl>
      <p className="muted decision-forecast-summary">{forecast.summary}</p>
    </div>
  );
}
