import type { RecoveryProgress } from "@/lib/analytics/executive-ai-behavior";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function ExecutiveRecoveryProgressCard({ progress }: { progress: RecoveryProgress }) {
  if (progress.goalMonthly <= 0) return null;

  return (
    <section className="exec-advisor-recovery-progress card">
      <h2 className="exec-advisor-section-title">Recovery Progress</h2>
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
        <p className="muted exec-recovery-progress-status">
          <span className="exec-advisor-digest-sub">Status</span>
          {progress.statusMessage}
        </p>
      )}
    </section>
  );
}
