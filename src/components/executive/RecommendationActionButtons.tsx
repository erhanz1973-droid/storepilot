"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { DecisionRejectFeedbackModal } from "@/components/decisions/DecisionRejectFeedbackModal";
import type { DecisionRejectionReason } from "@/lib/decisions/engine/types";

export type RecommendationActionPayload = {
  decisionId?: string;
  recommendationId?: string;
  opportunityKey?: string;
  title: string;
  confidencePct?: number;
  expectedImpactLabel?: string;
  futureAction?: string;
};

type ActionButton = {
  id: string;
  label: string;
  action: "approve" | "later" | "reject";
  variant: "primary" | "secondary" | "ghost";
};

type Props = {
  payload: RecommendationActionPayload;
  buttons?: ActionButton[];
  compact?: boolean;
};

const DEFAULT_BUTTONS: ActionButton[] = [
  { id: "primary", label: "Approve", action: "approve", variant: "primary" },
  { id: "reduce", label: "Reduce Budget", action: "later", variant: "secondary" },
  { id: "ignore", label: "Ignore", action: "reject", variant: "ghost" },
];

export function RecommendationActionButtons({
  payload,
  buttons = DEFAULT_BUTTONS,
  compact = false,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useOptimistic<"open" | "done">("open");
  const [rejectOpen, setRejectOpen] = useState(false);

  const canPersist = Boolean(payload.recommendationId || payload.opportunityKey || payload.decisionId);

  if (status === "done") {
    return (
      <p className="muted" style={{ margin: compact ? 0 : "12px 0 0", fontSize: "0.85rem" }}>
        Action recorded — view outcome in Decisions.
      </p>
    );
  }

  async function submit(action: "approve" | "later" | "reject", rejectionReason?: DecisionRejectionReason) {
    if (!canPersist) {
      router.push("/decisions");
      return;
    }
    setStatus("done");
    const res = await fetch("/api/decisions/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recommendationId: payload.recommendationId,
        opportunityKey: payload.opportunityKey,
        title: payload.title,
        action,
        confidencePct: payload.confidencePct,
        decisionId: payload.decisionId,
        futureAction: payload.futureAction,
        expectedImpactLabel: payload.expectedImpactLabel,
        rejectionReason,
      }),
    });
    if (!res.ok) setStatus("open");
    else router.refresh();
  }

  function run(action: "approve" | "later" | "reject", rejectionReason?: DecisionRejectionReason) {
    startTransition(() => submit(action, rejectionReason));
  }

  return (
    <>
      <div className={`recommendation-action-buttons ${compact ? "compact" : ""}`}>
        {buttons.map((btn) => (
          <button
            key={btn.id}
            type="button"
            className={`btn btn-${btn.variant === "primary" ? "primary" : btn.variant === "secondary" ? "secondary" : "ghost"}`}
            disabled={isPending}
            onClick={() => {
              if (btn.action === "reject") setRejectOpen(true);
              else run(btn.action);
            }}
          >
            {isPending ? "…" : btn.label}
          </button>
        ))}
      </div>
      <DecisionRejectFeedbackModal
        open={rejectOpen}
        pending={isPending}
        onClose={() => setRejectOpen(false)}
        onConfirm={(reason) => {
          setRejectOpen(false);
          run("reject", reason);
        }}
      />
    </>
  );
}
