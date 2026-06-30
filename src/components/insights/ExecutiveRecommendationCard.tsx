"use client";

import { useState } from "react";
import Link from "next/link";
import type { ExecutiveRecommendation } from "@/lib/insights/executive-recommendations";

const PRIORITY_CLASS: Record<ExecutiveRecommendation["priority"], string> = {
  critical: "exec-rec-critical",
  high: "exec-rec-high",
  medium: "exec-rec-medium",
  low: "exec-rec-medium",
};

const LIFECYCLE_CLASS: Record<ExecutiveRecommendation["lifecycle"], string> = {
  new: "exec-lifecycle-new",
  approved: "exec-lifecycle-approved",
  applied: "exec-lifecycle-applied",
  monitoring: "exec-lifecycle-monitoring",
  successful: "exec-lifecycle-success",
  dismissed: "exec-lifecycle-dismissed",
};

type Props = {
  recommendation: ExecutiveRecommendation;
  compact?: boolean;
};

export function ExecutiveRecommendationCard({ recommendation: rec, compact }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className={`card exec-recommendation-card ${PRIORITY_CLASS[rec.priority]}`}>
      <div className="exec-rec-header">
        <div>
          <div className="exec-rec-badges">
            <span className={`exec-lifecycle-badge ${LIFECYCLE_CLASS[rec.lifecycle]}`}>
              {rec.lifecycleLabel}
            </span>
            {rec.mergedCount > 1 && (
              <span className="exec-merged-badge">{rec.mergedCount} signals merged</span>
            )}
          </div>
          <h4 className="exec-rec-entity">{rec.entityName}</h4>
        </div>
        <div className="exec-rec-scores">
          <div className="exec-priority-score">
            <strong>{rec.priorityScore}</strong>
            <span className="muted">/ 100</span>
          </div>
          <span className="muted exec-confidence">{rec.confidencePct}% confidence</span>
        </div>
      </div>

      <div className="exec-rec-body">
        <section>
          <p className="exec-rec-label">Problem</p>
          <p className="exec-rec-text">{rec.problem}</p>
        </section>

        {!compact && (
          <>
            <section>
              <p className="exec-rec-label">Impact</p>
              <p className="exec-rec-impact">
                {rec.impactMonthly > 0
                  ? `Estimated monthly profit recovery: $${rec.impactMonthly.toLocaleString()}`
                  : rec.impactLabel}
              </p>
            </section>

            <section>
              <p className="exec-rec-label">Action</p>
              <p className="exec-rec-action">{rec.action}</p>
            </section>

            {rec.expectedOutcomes.length > 0 && (
              <section className="exec-rec-outcomes">
                <p className="exec-rec-label">Expected result</p>
                <ul>
                  {rec.expectedOutcomes.map((outcome) => (
                    <li key={outcome}>{outcome}</li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        <button
          type="button"
          className="exec-rec-expand btn btn-ghost btn-sm"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide reasoning" : "Why am I seeing this?"}
        </button>

        {expanded && (
          <div className="exec-rec-reasoning">
            <p className="exec-rec-label">Because</p>
            <ul>
              {rec.reasoning.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {rec.cause && rec.cause !== rec.problem && (
              <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.875rem" }}>
                {rec.cause}
              </p>
            )}
          </div>
        )}
      </div>

      {rec.lifecycle === "new" && (
        <div className="exec-rec-footer">
          <Link href={`/decisions#${rec.decisionId}`} className="btn btn-primary btn-sm">
            Review & Approve
          </Link>
        </div>
      )}
    </article>
  );
}
