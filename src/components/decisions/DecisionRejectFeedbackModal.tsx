"use client";

import {
  DECISION_REJECTION_LABELS,
  type DecisionRejectionReason,
} from "@/lib/decisions/engine/types";

const REASONS: DecisionRejectionReason[] = [
  "too_aggressive",
  "need_more_evidence",
  "will_execute_later",
  "already_doing",
  "business_preference",
  "other",
];

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: DecisionRejectionReason, note?: string) => void;
  pending?: boolean;
};

export function DecisionRejectFeedbackModal({
  open,
  onClose,
  onConfirm,
  pending,
}: Props) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 420, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>Why are you rejecting this decision?</h3>
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          Your feedback improves future recommendations.
        </p>
        <div className="stack" style={{ gap: 8, marginBottom: 16 }}>
          {REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              className="btn btn-secondary"
              style={{ justifyContent: "flex-start", textAlign: "left" }}
              disabled={pending}
              onClick={() => onConfirm(reason)}
            >
              {DECISION_REJECTION_LABELS[reason]}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={pending}>
          Cancel
        </button>
      </div>
    </div>
  );
}
