import type { FinancialImpact } from "@/lib/reports/types";

function fmt(n: number) {
  return `+$${n.toLocaleString()}/mo`;
}

export function FinancialImpactCard({ impact }: { impact: FinancialImpact }) {
  return (
    <section className="card reports-financial">
      <div className="reports-section-head">
        <span className="reports-section-icon" aria-hidden>
          💰
        </span>
        <h3>Financial Impact</h3>
      </div>
      <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.88rem" }}>
        Estimated projections vs measured results — estimated values are not yet realized until
        outcomes complete their measurement window.
      </p>
      <ul className="reports-financial-list">
        {impact.lines.map((row) => (
          <li key={row.label}>
            <span className="reports-financial-label">{row.label}</span>
            <div className="reports-financial-values">
              <div>
                <span className="muted">Estimated</span>
                <strong className="positive">{fmt(row.estimatedMonthly)}</strong>
              </div>
              <div>
                <span className="muted">Measured</span>
                <strong>
                  {row.measuredMonthly != null ? fmt(row.measuredMonthly) : "Not available yet"}
                </strong>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
