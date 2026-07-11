import type { RecoveryProgress } from "@/lib/analytics/executive-ai-behavior";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function stepIcon(status: RecoveryProgress["steps"][0]["status"]): string {
  if (status === "complete") return "✓";
  if (status === "current") return "→";
  return "○";
}

export function ExecutiveRecoveryProgressCard({ progress }: { progress: RecoveryProgress }) {
  if (progress.goalMonthly <= 0) return null;

  return (
    <section className="exec-advisor-recovery-progress card">
      <h2 className="exec-advisor-section-title">Recovery Progress</h2>

      <ol className="exec-recovery-onboarding-steps">
        {progress.steps.map((step) => (
          <li
            key={step.id}
            className={`exec-recovery-onboarding-step exec-recovery-step-${step.status}`}
          >
            <span className="exec-recovery-step-icon" aria-hidden>
              {stepIcon(step.status)}
            </span>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>

      <div className="exec-recovery-progress-grid">
        <div>
          <span className="muted">Recovery Goal</span>
          <strong>{fmt(progress.goalMonthly)}/month</strong>
        </div>
        <div>
          <span className="muted">Recovered</span>
          <strong className={progress.hasMeasurements ? "positive" : ""}>
            {progress.recoveredLabel}
          </strong>
        </div>
        {progress.hasMeasurements && (
          <div>
            <span className="muted">Remaining</span>
            <strong>{fmt(progress.remainingMonthly)}</strong>
          </div>
        )}
      </div>

      {progress.hasMeasurements ? (
        <div className="exec-recovery-progress-bar-wrap">
          <div className="exec-recovery-progress-bar">
            <div
              className="exec-recovery-progress-fill"
              style={{ width: `${progress.progressPct}%` }}
            />
          </div>
          <strong className="exec-recovery-progress-pct">{progress.progressPct}%</strong>
        </div>
      ) : (
        <p className="muted exec-recovery-progress-status">{progress.statusMessage}</p>
      )}
    </section>
  );
}
