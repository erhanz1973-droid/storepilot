import type { FunnelConfidence } from "@/lib/funnel/types";

const LABELS: Record<FunnelConfidence, string> = {
  verified: "Verified",
  estimated: "Estimated",
  unavailable: "Not Available",
};

const CLASS: Record<FunnelConfidence, string> = {
  verified: "funnel-badge-verified",
  estimated: "funnel-badge-estimated",
  unavailable: "funnel-badge-unavailable",
};

export function FunnelConfidenceBadge({
  status,
  notice,
}: {
  status: FunnelConfidence;
  notice?: string;
}) {
  return (
    <span className={`funnel-confidence-badge ${CLASS[status]}`} title={notice}>
      {LABELS[status]}
    </span>
  );
}
