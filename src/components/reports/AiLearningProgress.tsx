import type { LearningProgress } from "@/lib/reports/types";

export function AiLearningProgress({ learning }: { learning: LearningProgress }) {
  return (
    <section className="card reports-learning">
      <div className="reports-section-head">
        <span className="reports-section-icon" aria-hidden>
          🧠
        </span>
        <h3>{learning.statusLabel}</h3>
      </div>
      <p className="reports-learning-description">{learning.description}</p>
      <div className="reports-learning-stats">
        <div>
          <span className="muted">Progress</span>
          <strong>
            {learning.completedCount} of {learning.minimumRequired} completed recommendations
          </strong>
        </div>
        <div>
          <span className="muted">Current learning stage</span>
          <strong>{learning.currentStage}</strong>
        </div>
        <div>
          <span className="muted">Estimated readiness</span>
          <strong>{learning.readinessPct}%</strong>
        </div>
      </div>
      <div
        className="reports-progress-track"
        role="progressbar"
        aria-valuenow={learning.readinessPct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="reports-progress-fill" style={{ width: `${learning.readinessPct}%` }} />
      </div>
      <p className="reports-learning-milestone">
        <span className="muted">Next milestone</span>
        <br />
        <strong>{learning.nextMilestone}</strong>
      </p>
    </section>
  );
}
