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
  approving,
}: {
  decision: FirstRunDecision;
  onSeeWhy: () => void;
  onApprove: () => void;
  onReject: () => void;
  approving?: boolean;
}) {
  return (
    <section className="card first-run-decision" aria-labelledby="first-run-decision-title">
      <p className="first-run-eyebrow">Today&apos;s #1 Executive Decision</p>
      <h2 id="first-run-decision-title" className="first-run-decision-title">
        {decision.title}
      </h2>
      {decision.actionLabel ? (
        <p className="first-run-decision-action">
          <strong>{decision.actionLabel}</strong>
        </p>
      ) : null}

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

      <div className="first-run-decision-actions">
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
      </div>
    </section>
  );
}
