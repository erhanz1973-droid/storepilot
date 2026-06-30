"use client";

import { DecisionRejectFeedbackModal } from "@/components/decisions/DecisionRejectFeedbackModal";
import type { DecisionItem } from "@/lib/decisions/center";
import type { DecisionRejectionReason } from "@/lib/decisions/engine/types";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";

type Props = {
  item: DecisionItem;
};

const ACTION_STATUS: Record<"approve" | "later" | "reject", DecisionItem["status"]> = {
  approve: "accepted",
  later: "snoozed",
  reject: "ignored",
};

export function DecisionCardActions({ item }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useOptimistic(item.status);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);
  const [executionDetail, setExecutionDetail] = useState<string | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);

  if (status !== "open" && status !== "viewed") {
    const acceptedDetail =
      status === "accepted" && executionDetail
        ? executionDetail
        : status === "accepted"
          ? "Approved. An observation period will measure the outcome."
          : null;

    return (
      <div style={{ marginTop: 12 }}>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem", lineHeight: 1.5 }}>
          {executionMessage ??
            acceptedDetail ??
            (status === "snoozed"
              ? "Deferred — will resurface later."
              : status === "ignored"
                ? "Rejected — hidden from your queue."
                : `Status: ${status}`)}
        </p>
      </div>
    );
  }

  async function submitAction(
    action: "approve" | "later" | "reject",
    rejectionReason?: DecisionRejectionReason,
  ) {
    setStatus(ACTION_STATUS[action]);
    const res = await fetch("/api/decisions/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recommendationId: item.recommendationId,
        opportunityKey: item.opportunityKey,
        title: item.summary,
        action,
        confidencePct: item.confidencePct,
        decisionId: item.id,
        futureAction: item.futureAction,
        platform: item.platform,
        entityType: item.entityType,
        entityId: item.entityId,
        entityName: item.entityName,
        executionParams: item.executionParams,
        expectedImpactLabel: item.estimatedImpactLabel,
        rejectionReason,
        recommendationCategory: item.recommendationId ? undefined : "decision",
      }),
    });
    if (!res.ok) {
      setStatus(item.status);
      return;
    }
    const data = (await res.json()) as {
      execution?: {
        message?: string;
        executed?: boolean;
        mode?: string;
        success?: boolean;
      } | null;
      observation?: { measureDueAt?: string; measurementWindowDays?: number };
    };
    if (data.execution?.message) {
      setExecutionMessage(data.execution.message);
    }
    if (data.execution) {
      if (data.execution.executed) {
        setExecutionDetail("Action executed — observation period started.");
      } else if (data.execution.mode === "dry_run" && data.execution.success) {
        setExecutionDetail("Dry-run validated — observation scheduled when live.");
      } else if (data.execution.success === false) {
        setExecutionDetail("Automation could not run — check permissions.");
      }
    } else if (data.observation?.measureDueAt) {
      setExecutionDetail(
        `Observation period: ${data.observation.measurementWindowDays ?? 7} days`,
      );
    }
    router.refresh();
  }

  function run(action: "approve" | "later" | "reject", rejectionReason?: DecisionRejectionReason) {
    startTransition(async () => {
      await submitAction(action, rejectionReason);
    });
  }

  const canPersist = Boolean(item.recommendationId || item.opportunityKey);

  return (
    <>
      <div className="actions-row lifecycle-actions" style={{ marginTop: 14 }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={isPending || !canPersist}
          onClick={() => run("approve")}
        >
          {isPending ? "…" : "Approve"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={isPending || !canPersist}
          onClick={() => run("later")}
        >
          Later
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={isPending || !canPersist}
          onClick={() => setRejectModalOpen(true)}
        >
          Reject
        </button>
      </div>
      {executionMessage && (
        <p className="muted" style={{ margin: "10px 0 0", fontSize: "0.85rem" }}>
          {executionMessage}
        </p>
      )}
      <DecisionRejectFeedbackModal
        open={rejectModalOpen}
        pending={isPending}
        onClose={() => setRejectModalOpen(false)}
        onConfirm={(reason) => {
          setRejectModalOpen(false);
          run("reject", reason);
        }}
      />
    </>
  );
}
