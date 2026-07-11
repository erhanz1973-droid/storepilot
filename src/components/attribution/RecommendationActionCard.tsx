import type { AttributionStrategyAction } from "@/lib/attribution/decision-engine-types";
import type { ImpactVerificationStatus } from "@/lib/attribution/decision-engine-types";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function riskClass(level: string): string {
  if (level === "Low") return "positive";
  if (level === "High") return "negative";
  return "";
}

function verificationBadgeClass(status: ImpactVerificationStatus): string {
  if (status === "Verified") return "status-verified";
  if (status === "Estimated") return "status-estimated";
  return "status-simulated";
}

function VerificationBadge({ status }: { status: ImpactVerificationStatus }) {
  return (
    <span className={`attribution-verification-badge ${verificationBadgeClass(status)}`}>
      {status}
    </span>
  );
}

export function RecommendationActionCard({ action }: { action: AttributionStrategyAction }) {
  return (
    <article
      className={`attribution-action-card ${action.isLastResort ? "last-resort" : ""} ${
        action.isPackage ? "is-package" : ""
      }`}
    >
      <header className="attribution-action-card-header">
        <span className="attribution-strategy-rank">{action.rank}.</span>
        <div>
          <strong>{action.title}</strong>
          {action.priorityScore != null && (
            <span className="attribution-priority-score">
              Priority Score {action.priorityScore} / 100
            </span>
          )}
        </div>
      </header>

      {action.isPackage && action.packageSteps && action.packageSteps.length > 0 && (
        <div className="attribution-package-steps">
          <span className="muted">Actions</span>
          <ul>
            {action.packageSteps.map((step) => (
              <li key={step}>• {step}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="attribution-action-reason">
        <span className="muted">Reason</span> {action.reason}
      </p>

      <dl className="attribution-action-metrics-grid">
        <div>
          <dt>Expected Impact</dt>
          <dd className="positive">
            +{formatMoney(action.impact.estimatedMonthlyImprovement)}/mo
            <VerificationBadge status={action.impact.simulationStatus} />
          </dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{action.confidencePct}%</dd>
        </div>
        <div>
          <dt>Risk</dt>
          <dd className={riskClass(action.riskLevel)}>{action.riskLevel}</dd>
        </div>
        <div>
          <dt>Implementation</dt>
          <dd>{action.implementationTime ?? "7–14 days"}</dd>
        </div>
        <div>
          <dt>Rollback</dt>
          <dd>{action.rollbackAvailable !== false ? "Available" : "Limited"}</dd>
        </div>
      </dl>

      {action.rankExplanation && (
        <p className="muted attribution-action-rank-note">{action.rankExplanation}</p>
      )}
    </article>
  );
}
