import Link from "next/link";
import type { DailyPriority } from "@/lib/advertising/types";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function DailyPriorityCard({ priority }: { priority: DailyPriority }) {
  return (
    <div className="card adv-daily-priority">
      <span className="muted adv-daily-priority-eyebrow">If you only have 10 minutes today…</span>
      <h2 style={{ margin: "6px 0 8px" }}>{priority.title}</h2>
      <p className="adv-daily-priority-action">
        <strong>{priority.action}</strong>
        {priority.campaignName && (
          <span className="muted"> — {priority.campaignName}</span>
        )}
      </p>
      <p className="adv-daily-priority-narrative">{priority.narrative}</p>

      <dl className="adv-daily-priority-metrics">
        <div>
          <dt>Estimated monthly impact</dt>
          <dd className="positive">+{fmt(priority.expectedMonthlyImpact)}</dd>
        </div>
        <div>
          <dt>Estimated completion</dt>
          <dd>{priority.estimatedMinutes} minutes</dd>
        </div>
        <div>
          <dt>Business risk</dt>
          <dd className={`adv-risk adv-risk-${priority.risk.toLowerCase()}`}>{priority.risk}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{priority.confidencePct}%</dd>
        </div>
      </dl>

      <div className="adv-daily-priority-actions">
        <Link href="/approvals" className="btn btn-primary">
          Approve this action
        </Link>
        {priority.campaignId && (
          <Link href={`/advertising/campaigns/${priority.campaignId}`} className="btn btn-ghost">
            See why →
          </Link>
        )}
      </div>
    </div>
  );
}
