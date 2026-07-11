import type { RecommendationExplanation } from "@/lib/analytics/executive-advisor";

export function RecommendationWhyPanel({
  explanation,
  compact = false,
}: {
  explanation: RecommendationExplanation;
  compact?: boolean;
}) {
  return (
    <details className={`exec-advisor-why-panel ${compact ? "compact" : ""}`}>
      <summary className="exec-advisor-why-panel-summary">Why this recommendation?</summary>
      <div className="exec-advisor-why-panel-body">
        <div className="exec-advisor-why-panel-section">
          <span className="muted">Data sources used</span>
          <ul>
            {explanation.dataSources.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="exec-advisor-why-panel-section">
          <span className="muted">Business rules triggered</span>
          <ul>
            {explanation.businessRulesTriggered.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        <div className="exec-advisor-why-panel-section">
          <span className="muted">AI reasoning</span>
          <p>{explanation.aiReasoning}</p>
        </div>
        <div className="exec-advisor-why-panel-section">
          <span className="muted">Assumptions</span>
          <ul>
            {explanation.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
        <div className="exec-advisor-why-panel-section">
          <span className="muted">Estimated impact</span>
          <p>{explanation.estimatedImpact}</p>
        </div>
        <div className="exec-advisor-why-panel-section">
          <span className="muted">AI evidence</span>
          <p>{explanation.confidenceExplanation}</p>
        </div>
      </div>
    </details>
  );
}
