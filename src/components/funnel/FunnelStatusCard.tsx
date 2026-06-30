import { FunnelConfidenceBadge } from "@/components/funnel/FunnelConfidenceBadge";
import type { Ga4ConnectionStatus } from "@/lib/funnel/types";
import Link from "next/link";

const STATUS_CLASS: Record<Ga4ConnectionStatus, string> = {
  connected: "funnel-status-connected",
  estimated: "funnel-status-estimated",
  unavailable: "funnel-status-unavailable",
};

export function FunnelStatusCard({
  status,
  label,
  notice,
}: {
  status: Ga4ConnectionStatus;
  label: string;
  notice: string;
}) {
  return (
    <div className={`card funnel-status-card ${STATUS_CLASS[status]}`}>
      <div className="funnel-status-header">
        <div>
          <span className="muted" style={{ fontSize: "0.8rem" }}>GA4 Status</span>
          <h3 style={{ margin: "4px 0 0" }}>{label}</h3>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.875rem" }}>
            {notice}
          </p>
        </div>
        <FunnelConfidenceBadge
          status={
            status === "connected"
              ? "verified"
              : status === "estimated"
                ? "estimated"
                : "unavailable"
          }
        />
      </div>
      {status === "unavailable" && (
        <Link href="/connections" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
          Connect GA4
        </Link>
      )}
      {status === "estimated" && (
        <Link href="/connections" className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}>
          Verify Events
        </Link>
      )}
    </div>
  );
}
