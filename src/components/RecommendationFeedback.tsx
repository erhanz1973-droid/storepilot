"use client";

import { useState } from "react";

type Props = {
  recommendationId: string;
};

export function RecommendationFeedback({ recommendationId }: Props) {
  const [submitted, setSubmitted] = useState<"helpful" | "not_helpful" | null>(null);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(helpful: boolean, reasonText?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recommendations/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendationId,
          helpful,
          reason: reasonText,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to submit feedback");
      }
      setSubmitted(helpful ? "helpful" : "not_helpful");
      setShowReason(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleNotHelpful() {
    setShowReason(true);
  }

  if (submitted) {
    return (
      <p className="muted" style={{ margin: "12px 0 0", fontSize: "0.875rem" }}>
        Thanks — your feedback helps improve StorePilot recommendations.{" "}
        <a href="/feedback?type=ai_recommendation">View in Feedback Center</a>
      </p>
    );
  }

  return (
    <div className="recommendation-feedback" style={{ marginTop: 12 }}>
      <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.875rem" }}>
        Was this recommendation helpful?
      </p>
      <div className="actions-row">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={loading}
          onClick={() => submit(true)}
        >
          👍 Helpful
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={loading}
          onClick={handleNotHelpful}
        >
          👎 Not Helpful
        </button>
      </div>
      {showReason && (
        <div style={{ marginTop: 10 }}>
          <label htmlFor={`feedback-reason-${recommendationId}`} className="muted" style={{ fontSize: "0.875rem" }}>
            What was wrong?
          </label>
          <textarea
            id={`feedback-reason-${recommendationId}`}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. numbers didn't match my store, not actionable, already tried this…"
            style={{ width: "100%", marginTop: 6, padding: 8, fontSize: "0.875rem" }}
          />
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 8 }}
            disabled={loading || reason.trim().length < 3}
            onClick={() => submit(false, reason.trim())}
          >
            Submit feedback
          </button>
        </div>
      )}
      {error && (
        <p style={{ color: "var(--critical)", marginTop: 8, fontSize: "0.875rem" }}>{error}</p>
      )}
    </div>
  );
}
