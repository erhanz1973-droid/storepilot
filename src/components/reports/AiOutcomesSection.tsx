import type { AiOutcomeStats } from "@/lib/reports/types";

function fmt(n: number) {
  return `$${n.toLocaleString()}`;
}

export function AiOutcomesSection({ stats }: { stats: AiOutcomeStats }) {
  return (
    <section className="card reports-ai-outcomes">
      <div className="reports-section-head">
        <span className="reports-section-icon" aria-hidden>
          🤖
        </span>
        <h3>AI Recommendations Outcome</h3>
      </div>
      <p className="muted reports-ai-outcomes-lead">
        This is how StorePilot AI performed for your store this week.
      </p>
      <div className="reports-ai-outcomes-grid">
        <div className="reports-ai-stat">
          <span className="muted">Recommendations generated</span>
          <strong>{stats.generated}</strong>
        </div>
        <div className="reports-ai-stat">
          <span className="muted">Approved</span>
          <strong>{stats.approved}</strong>
        </div>
        <div className="reports-ai-stat">
          <span className="muted">Completed</span>
          <strong>{stats.completed}</strong>
        </div>
        <div className="reports-ai-stat">
          <span className="muted">Estimated recovery</span>
          <strong className="positive">{fmt(stats.estimatedRecovery)}</strong>
        </div>
        <div className="reports-ai-stat">
          <span className="muted">Actual measured recovery</span>
          <strong>{stats.actualRecovery > 0 ? fmt(stats.actualRecovery) : "$0"}</strong>
        </div>
        <div className="reports-ai-stat highlight">
          <span className="muted">Accuracy</span>
          <strong>
            {stats.accuracyAvailable ? `${stats.accuracyPct}%` : "Building…"}
          </strong>
        </div>
      </div>

      {!stats.accuracyAvailable && (
        <div className="reports-outcome-measurement">
          <h4>Outcome Measurement</h4>
          <p>{stats.measurementStatus}</p>
          <dl className="reports-outcome-progress">
            <div>
              <dt>Recommendations completed</dt>
              <dd>{stats.completedProgressLabel}</dd>
            </div>
          </dl>
          <p className="muted reports-outcome-eta">{stats.accuracyEta}</p>
        </div>
      )}
    </section>
  );
}
