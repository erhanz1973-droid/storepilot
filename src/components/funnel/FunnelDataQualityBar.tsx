import { FunnelConfidenceBadge } from "@/components/funnel/FunnelConfidenceBadge";
import type { FunnelConfidence, FunnelDataTier } from "@/lib/funnel/types";
import Link from "next/link";

const TIER_HINT: Record<FunnelDataTier, string | null> = {
  step_level: null,
  session_level: "Step-level drop-offs need GA4 ecommerce events.",
  commerce_only: "Session and step-level data need GA4.",
};

export function FunnelDataQualityBar({
  dataTier,
  confidence,
  confidenceScore,
  notice,
}: {
  dataTier: FunnelDataTier;
  confidence: FunnelConfidence;
  confidenceScore: number;
  notice: string;
}) {
  const hint = TIER_HINT[dataTier];

  return (
    <div className="funnel-data-quality-bar">
      <div className="funnel-data-quality-main">
        <span className="muted" style={{ fontSize: "0.8rem" }}>
          Data confidence
        </span>
        <strong>{confidenceScore}%</strong>
        <FunnelConfidenceBadge status={confidence} />
        <span className="muted funnel-data-quality-notice">{notice}</span>
      </div>
      {hint && (
        <Link href="/connections" className="funnel-data-quality-link">
          {hint} Connections →
        </Link>
      )}
    </div>
  );
}
