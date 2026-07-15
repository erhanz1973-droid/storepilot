"use client";

import Link from "next/link";
import type {
  ExecutiveCeoDailyDecision,
  ExecutiveEvidencePipeline,
  ExecutiveMode,
  ExecutiveObserveContext,
} from "@/lib/analytics/build-executive-ceo-os";
import { EvidenceStrengthBadge } from "@/components/executive/advisor/EvidenceStrengthBadge";
import { MetricInfo } from "@/components/approvals/MetricInfo";
import { DECISION_IMPACT_COPY } from "@/lib/impact/decision-impact";
import { explainedFromImpactPresentation } from "@/lib/calculations/audit/from-presentation";

function oneLine(text: string, max = 140): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trim()}…`;
}

export function ExecutiveDailyDecisionCard({
  decision,
  mode = "ACTION_REQUIRED",
  evidencePipeline,
  observeContext,
  thresholdCurrent,
  thresholdRequired,
}: {
  decision: ExecutiveCeoDailyDecision;
  mode?: ExecutiveMode;
  evidencePipeline?: ExecutiveEvidencePipeline | null;
  observeContext?: ExecutiveObserveContext | null;
  thresholdCurrent?: number;
  thresholdRequired?: number;
}) {
  if (!decision.hasDecision) {
    const isObserving = mode === "OBSERVE";

    return (
      <section
        className="card exec-ceo-daily-decision exec-ceo-daily-decision-empty"
        aria-labelledby="exec-ceo-decision-heading"
      >
        <div className="exec-ceo-decision-hero">
          <span className="exec-ceo-eyebrow">
            {isObserving ? "Executive Mode · Building Evidence" : "Executive Mode"}
          </span>
          <h2 id="exec-ceo-decision-heading" className="exec-ceo-decision-action">
            {decision.emptyMessage ?? "No executive decision required today."}
          </h2>
          <p className="exec-ceo-decision-summary">
            {decision.emptyDetail ??
              "Your business is operating within acceptable thresholds. We'll notify you when a meaningful opportunity appears."}
          </p>
        </div>

        {isObserving && evidencePipeline ? (
          <div className="exec-evidence-pipeline" aria-label="Evidence collection pipeline">
            <ol className="exec-evidence-pipeline-steps">
              {evidencePipeline.steps.map((step) => (
                <li
                  key={step.label}
                  className={`exec-evidence-step${step.active ? " exec-evidence-step-active" : ""}`}
                >
                  <span className="exec-evidence-step-value">{step.value}</span>
                  <span className="exec-evidence-step-label">{step.label}</span>
                </li>
              ))}
            </ol>
            <div className="exec-evidence-pipeline-stage">
              <span className="exec-evidence-stage-arrow" aria-hidden>↓</span>
              <strong className="exec-evidence-stage-label">{evidencePipeline.currentStageLabel}</strong>
            </div>
          </div>
        ) : null}

        {isObserving && thresholdCurrent != null && thresholdRequired ? (
          <div className="exec-observe-threshold" aria-label="Executive score">
            <div className="exec-observe-threshold-row">
              <span className="exec-observe-threshold-title">Current Executive Score</span>
              <strong>{thresholdCurrent} / {thresholdRequired}</strong>
            </div>
            <div className="exec-observe-threshold-bar" role="progressbar" aria-valuenow={thresholdCurrent} aria-valuemin={0} aria-valuemax={thresholdRequired}>
              <span style={{ width: `${Math.min(100, (thresholdCurrent / Math.max(thresholdRequired, 1)) * 100)}%` }} />
            </div>
            <span className="exec-observe-threshold-status muted">Building Evidence</span>
          </div>
        ) : null}

        {isObserving && observeContext ? (
          <div className="exec-observe-context">
            {observeContext.reasons.length > 0 ? (
              <div className="exec-observe-reasons">
                <p className="exec-observe-context-heading">We're continuing to monitor because:</p>
                <ul>
                  {observeContext.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {observeContext.triggers.length > 0 ? (
              <div className="exec-observe-triggers">
                <p className="exec-observe-context-heading">Executive action will be recommended if:</p>
                <ul>
                  {observeContext.triggers.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="exec-observe-next-review">
              <span className="exec-observe-next-review-label">Next Executive Review</span>
              <strong className="exec-observe-next-review-value">{observeContext.nextReviewLabel}</strong>
              <p className="muted exec-observe-next-review-detail">{observeContext.nextReviewDetail}</p>
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  const summary = oneLine(decision.ceoOpinion || decision.narrative);
  const detail =
    decision.narrative && decision.narrative !== decision.ceoOpinion
      ? decision.narrative
      : null;
  const impact = decision.impactPresentation;
  const recoveryExplained = explainedFromImpactPresentation(impact, {
    formula: impact.heroTooltip,
    confidencePct: impact.confidencePct,
  });
  const isCritical = mode === "CRITICAL";

  return (
    <section
      className={`card exec-ceo-daily-decision${isCritical ? " exec-ceo-daily-decision-critical" : ""}`}
      aria-labelledby="exec-ceo-decision-heading"
    >
      <div className="exec-ceo-decision-hero">
        <span className="exec-ceo-eyebrow">
          {isCritical ? "Critical Executive Decision" : "Today's #1 Executive Decision"}
        </span>
        <h2 id="exec-ceo-decision-heading" className="exec-ceo-decision-action">
          {decision.action}
        </h2>

        <div className="exec-ceo-impact-hero" aria-label={impact.heroLabel}>
          <span className="exec-ceo-impact-label">
            {impact.heroLabel}{" "}
            <MetricInfo
              metricKey="recoverable_profit_opportunity"
              title={impact.heroLabel}
              explained={recoveryExplained}
            />
          </span>
          <p className="exec-ceo-impact-value">{impact.heroValueFormatted}</p>
          <span className="exec-ceo-impact-period">per month</span>
          {impact.showNetProfitSecondary ? (
            <p className="exec-ceo-impact-net">
              {impact.netProfitLabel}{" "}
              <strong>{impact.netProfitFormatted}</strong>
            </p>
          ) : null}
        </div>

        <div className="exec-ceo-decision-actions">
          <Link href={decision.approvalHref} className="btn btn-primary exec-ceo-approve-btn">
            {isCritical ? "Approve immediately" : "Approve this decision"}
          </Link>
          {decision.moduleHref ? (
            <Link href={decision.moduleHref} className="btn btn-ghost exec-ceo-secondary-cta">
              See evidence →
            </Link>
          ) : null}
        </div>

        <div className="exec-ceo-support-metrics" role="list" aria-label="Decision details">
          <div className="exec-ceo-support-metric" role="listitem">
            <span className="exec-ceo-support-label">{DECISION_IMPACT_COPY.aiConfidence}</span>
            <strong>{impact.confidencePct}%</strong>
          </div>
          <div className="exec-ceo-support-metric" role="listitem">
            <span className="exec-ceo-support-label">Time</span>
            <strong>{decision.estimatedMinutes} min</strong>
          </div>
          <div className="exec-ceo-support-metric" role="listitem">
            <span className="exec-ceo-support-label">Risk</span>
            <strong>{decision.risk}</strong>
          </div>
          {decision.evidence ? (
            <div className="exec-ceo-support-metric" role="listitem">
              <span className="exec-ceo-support-label">Evidence</span>
              <EvidenceStrengthBadge evidence={decision.evidence} />
            </div>
          ) : null}
        </div>

        {summary ? <p className="exec-ceo-decision-summary">{summary}</p> : null}
      </div>

      {(detail || decision.evidencePoints.length > 0) && (
        <details className="exec-ceo-decision-details">
          <summary>Why this matters</summary>
          {detail ? <p className="exec-ceo-decision-detail-copy">{detail}</p> : null}
          {decision.evidencePoints.length > 0 ? (
            <ul className="exec-ceo-evidence-list">
              {decision.evidencePoints.slice(0, 4).map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          ) : null}
        </details>
      )}
    </section>
  );
}
