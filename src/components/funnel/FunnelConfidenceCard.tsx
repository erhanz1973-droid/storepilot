import { FunnelConfidenceBadge } from "@/components/funnel/FunnelConfidenceBadge";
import type { FunnelConfidence } from "@/lib/funnel/types";

export function FunnelConfidenceCard({
  confidence,
  score,
  notice,
}: {
  confidence: FunnelConfidence;
  score: number;
  notice: string;
}) {
  return (
    <div className="card funnel-confidence-card">
      <div className="funnel-confidence-header">
        <h3 style={{ margin: 0 }}>Funnel Confidence</h3>
        <FunnelConfidenceBadge status={confidence} notice={notice} />
      </div>
      <div className="funnel-confidence-score">
        <strong>{confidence === "unavailable" ? "—" : `${score}%`}</strong>
        <span className="muted" style={{ fontSize: "0.85rem" }}>{notice}</span>
      </div>
    </div>
  );
}
