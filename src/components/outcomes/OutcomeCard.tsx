import type { DecisionOutcomeView } from "@/lib/decisions/center";
import { outcomeRatingLabel } from "@/lib/learning/outcome-scorer";
import type { OutcomeRating } from "@/lib/learning/outcome-types";

const RATING_BADGE: Record<OutcomeRating, string> = {
  successful: "badge-low",
  neutral: "badge-medium",
  needs_improvement: "badge-critical",
};

function formatCountdown(measureDueAt: string): string {
  const ms = new Date(measureDueAt).getTime() - Date.now();
  if (ms <= 0) return "Results ready — finalizing measurement";
  const days = Math.ceil(ms / 86400000);
  return `Measuring results — ${days} day${days === 1 ? "" : "s"} remaining`;
}

export function OutcomeCard({
  title,
  outcome,
  compact = false,
}: {
  title: string;
  outcome: DecisionOutcomeView;
  compact?: boolean;
}) {
  const isComplete = outcome.measureStatus === "completed";
  const isScheduled = outcome.measureStatus === "scheduled";

  return (
    <div className="outcome-card">
      <div className="outcome-card-top">
        <div>
          <p className="outcome-card-eyebrow">Outcome</p>
          <strong>{title}</strong>
        </div>
        <span className={`badge ${isComplete && outcome.outcomeRating ? RATING_BADGE[outcome.outcomeRating] : "badge-medium"}`}>
          {isComplete ? "Completed" : isScheduled ? "Monitoring" : outcome.measureStatus}
        </span>
      </div>

      {isScheduled && !isComplete && (
        <p className="muted" style={{ margin: "10px 0 0", fontSize: "0.85rem" }}>
          {formatCountdown(outcome.measureDueAt)} ({outcome.measurementWindowDays}-day window)
        </p>
      )}

      {isComplete && (
        <>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.82rem" }}>
            Results after {outcome.measurementWindowDays} days
            {outcome.measuredAt &&
              ` · Measured ${new Date(outcome.measuredAt).toLocaleDateString()}`}
          </p>

          {outcome.displayMetrics.length > 0 && (
            <div className="outcome-metric-grid">
              {outcome.displayMetrics.map((metric) => (
                <div key={metric.label} className="outcome-metric">
                  <span className="muted">{metric.label}</span>
                  <strong
                    className={
                      metric.trend === "up"
                        ? "trend-up"
                        : metric.trend === "down"
                          ? "trend-down"
                          : undefined
                    }
                  >
                    {metric.value}
                  </strong>
                </div>
              ))}
            </div>
          )}

          <div className="outcome-card-footer">
            {outcome.confidenceLabel && (
              <div>
                <span className="muted">Confidence</span>
                <strong style={{ textTransform: "capitalize" }}>{outcome.confidenceLabel}</strong>
              </div>
            )}
            {outcome.outcomeRating && (
              <div>
                <span className="muted">Recommendation status</span>
                <strong>{outcomeRatingLabel(outcome.outcomeRating)}</strong>
              </div>
            )}
            {outcome.predictionAccuracy != null && !compact && (
              <div>
                <span className="muted">Prediction accuracy</span>
                <strong>{outcome.predictionAccuracy}%</strong>
              </div>
            )}
          </div>

          {(outcome.aiVerdict || outcome.outcomeSummary) && (
            <p style={{ margin: "12px 0 0", fontSize: "0.9rem", lineHeight: 1.5 }}>
              <span className="muted">AI verdict · </span>
              {outcome.aiVerdict ?? outcome.outcomeSummary}
            </p>
          )}
        </>
      )}
    </div>
  );
}
