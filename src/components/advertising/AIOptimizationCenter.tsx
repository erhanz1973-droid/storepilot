import Link from "next/link";
import type { OptimizationPackage } from "@/lib/advertising/types";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const APPROVAL_LABEL = {
  pending: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  none: "Not Submitted",
} as const;

export function AIOptimizationCenter({ packages }: { packages: OptimizationPackage[] }) {
  if (packages.length === 0) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Today&apos;s AI Actions</h2>
        <p className="muted" style={{ margin: 0 }}>
          No actionable packages right now — performance looks stable across connected campaigns.
        </p>
      </div>
    );
  }

  return (
    <div className="card adv-optimization-center">
      <h2 style={{ marginTop: 0 }}>Today&apos;s AI Actions</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.875rem" }}>
        Consolidated decisions — one package per campaign instead of overlapping recommendations.
      </p>

      <ol className="adv-optimization-list">
        {packages.map((pkg) => (
          <li key={pkg.id} className={`adv-optimization-card ${pkg.isPackage ? "adv-package-card" : ""}`}>
            <div className="adv-opt-header">
              <span className="adv-opt-rank">#{pkg.rank}</span>
              <div>
                <strong>{pkg.isPackage ? pkg.title.replace(" Optimization", "") : pkg.title}</strong>
                {pkg.campaignName && (
                  <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.85rem" }}>
                    {pkg.campaignName}
                  </p>
                )}
              </div>
            </div>

            {pkg.isPackage && (
              <div className="adv-package-steps">
                <span className="muted adv-package-steps-label">This package includes</span>
                <ul className="adv-package-step-list">
                  {pkg.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </div>
            )}

            {pkg.simulation && (
              <div className="adv-package-simulation">
                <strong className="adv-simulation-label">If you apply this recommendation…</strong>
                <p className="adv-simulation-narrative">{pkg.simulation.narrative}</p>
                <dl className="adv-simulation-grid">
                  <div>
                    <dt>Expected profit</dt>
                    <dd className="positive">+{fmt(pkg.simulation.expectedProfitMonthly)}/mo</dd>
                  </div>
                  <div>
                    <dt>Expected ROAS</dt>
                    <dd>{pkg.simulation.expectedRoas.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>Risk</dt>
                    <dd className={`adv-risk adv-risk-${pkg.simulation.risk.toLowerCase()}`}>
                      {pkg.simulation.risk}
                    </dd>
                  </div>
                  <div>
                    <dt>Rollback</dt>
                    <dd>{pkg.simulation.rollbackAvailable ? "Available" : "Not available"}</dd>
                  </div>
                  <div>
                    <dt>Confidence</dt>
                    <dd>{pkg.simulation.confidencePct}%</dd>
                  </div>
                </dl>
              </div>
            )}

            {!pkg.simulation && (
              <div className="adv-opt-grid">
                <div>
                  <span className="muted">Expected Profit</span>
                  <strong className="positive">+{fmt(pkg.expectedProfitMonthly)}</strong>
                </div>
                <div>
                  <span className="muted">Time</span>
                  <strong>{pkg.estimatedTime}</strong>
                </div>
                <div>
                  <span className="muted">Risk</span>
                  <strong className={`adv-risk adv-risk-${pkg.risk.toLowerCase()}`}>{pkg.risk}</strong>
                </div>
                <div>
                  <span className="muted">Confidence</span>
                  <strong>{pkg.confidencePct}%</strong>
                </div>
              </div>
            )}

            <div className="adv-opt-footer">
              <span className={`adv-approval-badge adv-approval-${pkg.approvalStatus}`}>
                {APPROVAL_LABEL[pkg.approvalStatus]}
              </span>
              {pkg.decisionId && (
                <Link href="/decisions" className="btn btn-ghost btn-sm">
                  View in Decisions
                </Link>
              )}
              {pkg.campaignId && (
                <Link href={`/advertising/campaigns/${pkg.campaignId}`} className="btn btn-ghost btn-sm">
                  See timeline
                </Link>
              )}
              <Link href="/approvals" className="btn btn-primary btn-sm">
                {pkg.isPackage ? "Approve package" : "Submit to Approval Center"}
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
