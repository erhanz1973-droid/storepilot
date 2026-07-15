"use client";

import type { FirstRunDecision } from "@/lib/first-run/types";

export function FirstRunApprovePreview({ decision }: { decision: FirstRunDecision }) {
  const preview = decision.approvePreview;
  return (
    <section className="card first-run-approve-preview" aria-label="What happens if you approve">
      <h3 style={{ marginTop: 0 }}>What happens if you approve?</h3>
      <p className="muted">
        Approving records your decision and puts this into your approval workflow. StorePilot does
        not auto-change your store without your confirmation.
      </p>
      <dl className="first-run-decision-metrics">
        <div>
          <dt>Estimated monthly improvement</dt>
          <dd className="positive">{preview.estimatedMonthlyImprovement}</dd>
        </div>
        <div>
          <dt>Estimated implementation time</dt>
          <dd>{preview.estimatedImplementationTime}</dd>
        </div>
        <div>
          <dt>Risk level</dt>
          <dd>{preview.riskLevel}</dd>
        </div>
        <div>
          <dt>Expected confidence</dt>
          <dd>{preview.expectedConfidence}</dd>
        </div>
      </dl>
    </section>
  );
}
