"use client";

import type { FirstRunDecision } from "@/lib/first-run/types";

function fmtImpact(n: number, label: string): string {
  if (n > 0) return `+$${Math.round(n).toLocaleString()}`;
  return label;
}

export function FirstRunDecisionCard({
  decision,
  onSeeWhy,
  onApprove,
  onReject,
  onPrimary,
  approving,
}: {
  decision: FirstRunDecision;
  onSeeWhy: () => void;
  onApprove: () => void;
  onReject: () => void;
  onPrimary: () => void;
  approving?: boolean;
}) {
  const isFirstInsight = decision.presentation === "first_insight";

  return (
    <section className="card first-run-decision" aria-labelledby="first-run-decision-title">
      <p className="first-run-eyebrow">Your first AI recommendation</p>
      <h2 id="first-run-decision-title" className="first-run-decision-title">
        {decision.title}
      </h2>
      {decision.actionLabel && !isFirstInsight ? (
        <p className="first-run-decision-action">
          <strong>{decision.actionLabel}</strong>
        </p>
      ) : null}

      <p className="first-run-decision-reason">{decision.reason}</p>

      {isFirstInsight ? (
        <div className="first-run-insight-copy">
          <h3 className="first-run-section-title">Why StorePilot is recommending this</h3>
          <p>{decision.whyThisMatters}</p>
          <h3 className="first-run-section-title">What to do next</h3>
          <p>{decision.whatToDoNext}</p>
        </div>
      ) : (
        <dl className="first-run-decision-metrics">
          <div>
            <dt>Estimated monthly impact</dt>
            <dd className="positive">
              {fmtImpact(decision.impactMonthly, decision.expectedImpactLabel)}
            </dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>{decision.confidencePct}%</dd>
          </div>
          <div>
            <dt>Time required</dt>
            <dd>{decision.estimatedMinutes} minutes</dd>
          </div>
        </dl>
      )}

      {decision.evidencePoints.length > 0 ? (
        <div className="first-run-based-on">
          <h3 className="first-run-section-title">Based on</h3>
          <ul>
            {decision.evidencePoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="first-run-decision-actions">
        {isFirstInsight ? (
          <button type="button" className="btn btn-primary" onClick={onPrimary}>
            {decision.primaryCta.label}
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" onClick={onSeeWhy}>
              See Why
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onApprove}
              disabled={approving}
            >
              {approving ? "Approving…" : "Approve"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onReject} disabled={approving}>
              Not now
            </button>
          </>
        )}
      </div>
    </section>
  );
}
