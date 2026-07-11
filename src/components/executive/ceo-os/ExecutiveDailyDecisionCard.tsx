"use client";

import Link from "next/link";
import type { ExecutiveCeoDailyDecision } from "@/lib/analytics/build-executive-ceo-os";
import { EvidenceStrengthBadge } from "@/components/executive/advisor/EvidenceStrengthBadge";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function ExecutiveDailyDecisionCard({ decision }: { decision: ExecutiveCeoDailyDecision }) {
  return (
    <section className="card exec-ceo-daily-decision">
      <span className="exec-ceo-eyebrow">If you only make one decision today</span>
      <h2 style={{ margin: "6px 0 8px" }}>{decision.title}</h2>
      <p className="exec-ceo-action">
        <strong>{decision.action}</strong>
      </p>
      <p className="exec-ceo-opinion">{decision.ceoOpinion}</p>
      <p className="exec-ceo-narrative">{decision.narrative}</p>

      {(decision.evidence || decision.evidencePoints.length > 0) && (
        <div className="exec-ceo-evidence">
          <span className="muted" style={{ fontSize: "0.8rem" }}>Supporting evidence</span>
          {decision.evidence && (
            <EvidenceStrengthBadge evidence={decision.evidence} showExplanation />
          )}
          {decision.evidencePoints.length > 0 && (
            <ul className="exec-ceo-evidence-list">
              {decision.evidencePoints.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <dl className="exec-ceo-decision-metrics">
        <div>
          <dt>Expected impact</dt>
          <dd className="positive">+{fmt(decision.expectedMonthlyImpact)}/mo</dd>
        </div>
        <div>
          <dt>Time required</dt>
          <dd>{decision.estimatedMinutes} min</dd>
        </div>
        <div>
          <dt>Risk</dt>
          <dd>{decision.risk}</dd>
        </div>
      </dl>

      <div className="exec-ceo-decision-actions">
        <Link href={decision.approvalHref} className="btn btn-primary">
          Approve this decision
        </Link>
        {decision.moduleHref && (
          <Link href={decision.moduleHref} className="btn btn-ghost">
            See evidence →
          </Link>
        )}
      </div>
    </section>
  );
}
