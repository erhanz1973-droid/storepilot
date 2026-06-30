"use client";

import {
  lifecycleStatusLabel,
  measurementDaysRemaining,
  resolveRecommendationStatus,
} from "@/lib/recommendations/lifecycle";
import { submitApprovalAction } from "@/actions/approvals";
import type { Recommendation, RecommendationStatus } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";

type Props = {
  recommendation: Recommendation;
  approvalStatus?: RecommendationStatus;
  snoozedUntil?: string;
  showExplain?: boolean;
  onExplain?: () => void;
  explainLoading?: boolean;
  onStatusChange?: (status: RecommendationStatus) => void;
  ignoreLabel?: string;
};

export function RecommendationLifecycleActions({
  recommendation,
  approvalStatus,
  snoozedUntil,
  showExplain,
  onExplain,
  explainLoading,
  onStatusChange,
  ignoreLabel = "Ignore",
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(
    resolveRecommendationStatus(recommendation, approvalStatus),
  );

  const setStatus = onStatusChange ?? setOptimisticStatus;

  const snoozeActive =
    optimisticStatus === "snoozed" &&
    snoozedUntil &&
    new Date(snoozedUntil).getTime() > Date.now();

  const daysLeft = measurementDaysRemaining(
    recommendation.implementedAt,
    recommendation.measurementWindowDays ?? 7,
  );

  function submit(status: RecommendationStatus, snoozeDays?: number) {
    startTransition(async () => {
      setStatus(status);
      await submitApprovalAction({
        recommendationId: recommendation.id,
        status,
        snoozeDays,
      });
      router.refresh();
    });
  }

  if (optimisticStatus === "pending" && !snoozeActive) {
    return (
      <div className="actions-row lifecycle-actions">
        <button
          className="btn btn-primary"
          disabled={isPending}
          onClick={() => submit("approved")}
          type="button"
        >
          {isPending ? "…" : "Approve"}
        </button>
        <button
          className="btn btn-ghost"
          disabled={isPending}
          onClick={() => submit("snoozed", 7)}
          type="button"
        >
          Snooze 7d
        </button>
        <button
          className="btn btn-danger-ghost"
          disabled={isPending}
          onClick={() => submit("ignored")}
          type="button"
        >
          {ignoreLabel}
        </button>
        {showExplain && onExplain && (
          <button
            className="btn btn-ghost"
            disabled={explainLoading}
            onClick={onExplain}
            type="button"
          >
            {explainLoading ? "…" : "Explain"}
          </button>
        )}
      </div>
    );
  }

  if (optimisticStatus === "approved") {
    return (
      <div className="lifecycle-actions-block">
        <p className="lifecycle-status-banner lifecycle-status-approved">
          Approved — implement this change in your store, then mark it below so StorePilot can
          measure results.
        </p>
        <div className="actions-row lifecycle-actions">
          <button
            className="btn btn-primary btn-lg"
            disabled={isPending}
            onClick={() => submit("implemented")}
            type="button"
          >
            {isPending ? "…" : "Mark Implemented"}
          </button>
          {showExplain && onExplain && (
            <button
              className="btn btn-ghost"
              disabled={explainLoading}
              onClick={onExplain}
              type="button"
            >
              {explainLoading ? "…" : "Explain"}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (optimisticStatus === "implemented") {
    return (
      <div className="lifecycle-actions-block">
        <p className="lifecycle-status-banner lifecycle-status-measuring">
          <strong>Measuring…</strong>
          {daysLeft != null && daysLeft > 0
            ? ` Waiting for measurement window — ${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining.`
            : " Waiting for measurement window — results will appear soon."}
        </p>
        {showExplain && onExplain && (
          <div className="actions-row lifecycle-actions">
            <button
              className="btn btn-ghost"
              disabled={explainLoading}
              onClick={onExplain}
              type="button"
            >
              {explainLoading ? "…" : "Explain"}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (optimisticStatus === "measured") {
    return (
      <div className="lifecycle-measured-outcome">
        <div className="outcome-grid">
          <div className="outcome-stat">
            <span className="muted">Expected Impact</span>
            <strong>{recommendation.expectedImpact}</strong>
          </div>
          <div className="outcome-stat">
            <span className="muted">Actual Impact</span>
            <strong>{recommendation.actualImpact ?? "—"}</strong>
          </div>
          <div className="outcome-stat">
            <span className="muted">Prediction Accuracy</span>
            <strong>
              {recommendation.predictionAccuracy != null
                ? `${recommendation.predictionAccuracy}%`
                : "—"}
            </strong>
          </div>
        </div>
        {recommendation.outcomeSummary && (
          <div style={{ marginTop: 12 }}>
            <p className="muted" style={{ margin: "0 0 4px", fontWeight: 500 }}>
              Outcome Summary
            </p>
            <p style={{ margin: 0, lineHeight: 1.5 }}>{recommendation.outcomeSummary}</p>
          </div>
        )}
        {showExplain && onExplain && (
          <div className="actions-row lifecycle-actions" style={{ marginTop: 12 }}>
            <button
              className="btn btn-ghost"
              disabled={explainLoading}
              onClick={onExplain}
              type="button"
            >
              {explainLoading ? "…" : "Explain"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <p className="muted lifecycle-status-muted">
      Status: <strong>{lifecycleStatusLabel(optimisticStatus)}</strong>
      {snoozeActive && snoozedUntil
        ? ` — snoozed until ${new Date(snoozedUntil).toLocaleDateString()}`
        : ""}
    </p>
  );
}
