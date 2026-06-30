import type { ProfitConfidence, ProfitStatus } from "@/lib/profit/types";
import { profitStatusLabel } from "@/lib/profit/metric-value";
import Link from "next/link";

const STATUS_CLASS: Record<ProfitStatus, string> = {
  verified: "profit-badge-verified",
  estimated: "profit-badge-estimated",
  unavailable: "profit-badge-unavailable",
};

export function ProfitConfidenceBadge({
  confidence,
  compact = false,
  showSetupLink = false,
}: {
  confidence: Pick<ProfitConfidence, "status" | "scorePct" | "setupRequired">;
  compact?: boolean;
  showSetupLink?: boolean;
}) {
  const label = profitStatusLabel(confidence.status);
  const score =
    confidence.status === "unavailable" ? null : `${confidence.scorePct}%`;

  return (
    <span className={`profit-confidence-badge ${STATUS_CLASS[confidence.status]} ${compact ? "compact" : ""}`}>
      <span className="profit-confidence-badge-label">{label}</span>
      {score && <span className="profit-confidence-badge-score">{score}</span>}
      {showSetupLink && confidence.setupRequired && (
        <Link href="/analytics/profit/setup" className="profit-confidence-badge-link">
          Setup
        </Link>
      )}
    </span>
  );
}
