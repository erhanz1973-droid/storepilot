import type { ProfitConfidence } from "@/lib/profit/types";
import { PROFIT_INPUT_LABELS } from "@/lib/profit/types";
import Link from "next/link";

const STATUS_BADGE: Record<ProfitConfidence["status"], string> = {
  verified: "Verified Profit",
  estimated: "Estimated Profit",
  unavailable: "Profit Not Available",
};

export function ProfitSetupCompact({
  confidence,
  setupComplete,
}: {
  confidence: ProfitConfidence;
  setupComplete: boolean;
}) {
  if (setupComplete && confidence.missingInputs.length === 0) {
    return (
      <div className="card profit-setup-compact complete">
        <div className="profit-setup-compact-row">
          <div>
            <span className={`estimated-profit-badge status-${confidence.status}`}>
              {STATUS_BADGE[confidence.status]}
            </span>
            <strong style={{ marginLeft: 8 }}>{confidence.scorePct}% Confidence</strong>
          </div>
          <Link href="/analytics/profit/setup" className="btn btn-ghost btn-sm">
            Review Setup
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card profit-setup-compact">
      <div className="profit-setup-compact-row">
        <div>
          <span className={`estimated-profit-badge status-${confidence.status}`}>
            {STATUS_BADGE[confidence.status]}
          </span>
          <strong style={{ marginLeft: 8 }}>
            {confidence.status === "unavailable" ? "—" : `${confidence.scorePct}%`} Confidence
          </strong>
        </div>
        <Link href="/analytics/profit/setup" className="btn btn-primary btn-sm">
          Complete Setup
        </Link>
      </div>

      {confidence.missingInputs.length > 0 && (
        <div className="profit-setup-missing">
          <span className="muted" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
            Missing
          </span>
          <ul className="profit-missing-list">
            {confidence.missingInputs.map((id) => (
              <li key={id}>{PROFIT_INPUT_LABELS[id]}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
