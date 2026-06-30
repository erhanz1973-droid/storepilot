import type { ProfitConfidence } from "@/lib/profit/types";
import { PROFIT_INPUT_LABELS } from "@/lib/profit/types";
import Link from "next/link";

const STATUS_CLASS: Record<ProfitConfidence["status"], string> = {
  verified: "confidence-high",
  estimated: "confidence-medium",
  unavailable: "confidence-low",
};

const STATUS_BADGE: Record<ProfitConfidence["status"], string> = {
  verified: "Verified Profit",
  estimated: "Estimated Profit",
  unavailable: "Profit Not Available",
};

export function ProfitConfidenceBanner({
  confidence,
}: {
  confidence: ProfitConfidence;
}) {
  const statusClass = STATUS_CLASS[confidence.status];

  return (
    <div className={`card profit-confidence-banner ${statusClass}`}>
      <div className="profit-confidence-header">
        <div>
          <span className={`estimated-profit-badge status-${confidence.status}`}>
            {STATUS_BADGE[confidence.status]}
          </span>
          <h3 style={{ margin: "8px 0 0" }}>Profit Confidence</h3>
        </div>
        <div className="profit-confidence-score">
          <strong>{confidence.status === "unavailable" ? "—" : `${confidence.scorePct}%`}</strong>
          {confidence.status !== "unavailable" && (
            <span className={`confidence-level-pill ${statusClass}`}>
              {confidence.status === "verified" ? "Verified" : `${confidence.scorePct}%`}
            </span>
          )}
        </div>
      </div>

      {confidence.status === "unavailable" ? (
        <p className="profit-confidence-warning">
          {confidence.notice ?? "Complete Profit Setup to unlock accurate profitability analytics."}
        </p>
      ) : confidence.status === "estimated" ? (
        <p className="profit-confidence-warning">{confidence.notice}</p>
      ) : (
        <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.875rem" }}>
          All required profit inputs are connected. AI can confidently analyze profitability.
        </p>
      )}

      {confidence.missingInputs.length > 0 && (
        <div className="profit-missing-inputs" style={{ marginTop: 12 }}>
          <strong style={{ fontSize: "0.875rem" }}>Missing or estimated</strong>
          <ul className="profit-missing-list">
            {confidence.missingInputs.map((id) => (
              <li key={id}>{PROFIT_INPUT_LABELS[id]}</li>
            ))}
          </ul>
        </div>
      )}

      {confidence.setupRequired && (
        <div style={{ marginTop: 12 }}>
          <Link href="/analytics/profit/setup" className="btn btn-primary btn-sm">
            Complete Profit Setup
          </Link>
        </div>
      )}

      <p className="muted" style={{ margin: "12px 0 0", fontSize: "0.875rem" }}>
        <strong>Reason:</strong> {confidence.reason}
      </p>
    </div>
  );
}
