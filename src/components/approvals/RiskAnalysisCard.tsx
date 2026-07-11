import type { RiskAnalysis } from "@/lib/approvals/decision-center-types";

const RISK_CLASS = {
  Low: "risk-low",
  Medium: "risk-medium",
  High: "risk-high",
} as const;

export function RiskAnalysisCard({ analysis }: { analysis: RiskAnalysis }) {
  return (
    <section className="decision-risk-card">
      <h5>Risk Assessment</h5>
      <div className="decision-risk-overall">
        <span className="muted">Overall Risk</span>
        <strong className={`decision-memo-risk ${RISK_CLASS[analysis.overallRisk]}`}>
          {analysis.overallRisk}
        </strong>
      </div>

      {analysis.quantifiedRisks.length > 0 && (
        <div className="decision-risk-quantified">
          {analysis.quantifiedRisks.map((r) => (
            <div key={r.label} className="decision-risk-quantified-row">
              <div className="decision-risk-quantified-main">
                <span className="muted">{r.label}</span>
                <strong>{r.estimate}</strong>
              </div>
              <div className="decision-risk-quantified-meta">
                {r.probabilityPct != null && (
                  <span>
                    Probability <strong>{r.probabilityPct}%</strong>
                  </span>
                )}
                {r.note && <span className="muted">{r.note}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="decision-risk-columns">
        {analysis.potentialRisks.length > 0 && (
          <div>
            <span className="decision-risk-subtitle">Scope of Change</span>
            <ul>
              {analysis.potentialRisks.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <span className="decision-risk-subtitle">Risk Mitigation</span>
          <ul className="decision-risk-mitigations">
            {analysis.mitigations.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
