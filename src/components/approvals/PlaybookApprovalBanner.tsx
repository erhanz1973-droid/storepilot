"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function PlaybookApprovalBanner() {
  const params = useSearchParams();
  const playbookId = params.get("playbook");
  const batch = params.get("batch");

  if (!playbookId && !batch) return null;

  const message =
    batch === "top3"
      ? "Three high-impact actions from today's AI Playbook are ready for your review. Approve below to queue them for launch."
      : playbookId
        ? `Revenue playbook "${decodeURIComponent(playbookId)}" was sent for approval. Review and approve the matching action below before anything launches.`
        : null;

  if (!message) return null;

  return (
    <div className="card playbook-approval-banner" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Playbook awaiting approval</h3>
      <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.9rem" }}>
        {message}
      </p>
      <Link href="/analytics/sales" className="btn btn-ghost btn-sm">
        Back to Revenue Playbooks
      </Link>
    </div>
  );
}
