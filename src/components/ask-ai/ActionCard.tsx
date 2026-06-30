"use client";

import { submitApprovalAction } from "@/actions/approvals";
import type { AiActionCard } from "@/lib/ai/types";
import { useOptimistic, useTransition } from "react";

export function ActionCard({ card }: { card: AiActionCard }) {
  const [isPending, startTransition] = useTransition();
  const [approved, setApproved] = useOptimistic(false);

  function handleApprove() {
    if (!card.recommendationId || approved) return;
    startTransition(async () => {
      setApproved(true);
      await submitApprovalAction({
        recommendationId: card.recommendationId!,
        status: "approved",
      });
    });
  }

  return (
    <article className="action-card">
      <h4>{card.title}</h4>
      <p className="muted" style={{ margin: "8px 0", lineHeight: 1.5 }}>
        <strong>Reason:</strong> {card.reason}
      </p>
      <p className="muted" style={{ margin: "0 0 8px" }}>
        <strong>Estimated impact:</strong> {card.expectedImpact}
      </p>
      <p className="confidence">Confidence: {Math.round(card.confidence * 100)}%</p>
      {card.recommendationId && (
        <button
          className="btn btn-primary"
          style={{ marginTop: 10 }}
          disabled={isPending || approved}
          onClick={handleApprove}
        >
          {approved ? "Approved" : isPending ? "…" : card.actionLabel}
        </button>
      )}
    </article>
  );
}
