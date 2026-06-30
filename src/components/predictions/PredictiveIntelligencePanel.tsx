import type { PredictiveInsight } from "@/lib/predictions/engine";

const SEVERITY_BADGE: Record<PredictiveInsight["severity"], string> = {
  info: "badge-medium",
  warning: "badge-high",
  critical: "badge-critical",
};

export function PredictiveIntelligencePanel({
  insights,
}: {
  insights: PredictiveInsight[];
}) {
  if (insights.length === 0) return null;

  return (
    <div className="card">
      <h3>Predictive Intelligence</h3>
      <p className="muted" style={{ marginTop: 4, marginBottom: 16, fontSize: "0.875rem" }}>
        Forward-looking forecasts — warnings before problems occur
      </p>
      <div className="stack">
        {insights.map((insight) => (
          <article
            key={insight.id}
            className="predictive-insight-row"
            style={{
              padding: "12px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <span className={`badge ${SEVERITY_BADGE[insight.severity]}`}>
                  {insight.horizonDays}d horizon
                </span>
                <h4 style={{ margin: "8px 0 4px", fontSize: "0.95rem" }}>{insight.title}</h4>
                <p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                  {insight.prediction}
                </p>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 700 }}>{insight.confidencePct}%</div>
                <div className="muted" style={{ fontSize: "0.75rem" }}>
                  confidence
                </div>
              </div>
            </div>
            {insight.supportingData.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  marginTop: 8,
                  flexWrap: "wrap",
                  fontSize: "0.8rem",
                }}
              >
                {insight.supportingData.map((d) => (
                  <span key={d.label} className="muted">
                    <strong>{d.label}:</strong> {d.value}
                  </span>
                ))}
              </div>
            )}
            {insight.primaryFactors.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <p className="muted" style={{ margin: "0 0 4px", fontSize: "0.75rem", fontWeight: 600 }}>
                  Primary factors
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.8rem" }}>
                  {insight.primaryFactors.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {insight.possibleActions.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <p className="muted" style={{ margin: "0 0 4px", fontSize: "0.75rem", fontWeight: 600 }}>
                  Possible actions
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.8rem" }}>
                  {insight.possibleActions.map((a) => (
                    <li key={a.label}>
                      <strong>{a.label}</strong> — {a.detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
