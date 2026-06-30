import type { RecommendationHistory } from "@/lib/analytics/executive-ai-behavior";

export function ExecutiveRecommendationHistory({
  history,
  compact = false,
}: {
  history: RecommendationHistory;
  compact?: boolean;
}) {
  return (
    <div className={`exec-rec-history ${compact ? "compact" : ""}`}>
      {!compact && <p className="exec-rec-history-title">Recommendation timeline</p>}
      <ol className="exec-rec-history-steps">
        {history.steps.map((step, i) => (
          <li
            key={step.id}
            className={`exec-rec-history-step ${step.complete ? "complete" : ""} ${step.active ? "active" : ""}`}
          >
            <span className="exec-rec-history-marker">{step.complete ? "✓" : i + 1}</span>
            <div>
              <strong>{step.label}</strong>
              {step.timestampLabel && (
                <span className="muted exec-rec-history-time">{step.timestampLabel}</span>
              )}
              {step.value && <span className="exec-rec-history-value positive">{step.value}</span>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
