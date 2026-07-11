import type {
  ProfitConfidenceCategory,
  ProfitConfidenceExplanation,
  SetupImpactItem,
} from "@/lib/profit/profit-page-view";
import type { ProfitConfidence } from "@/lib/profit/types";
import Link from "next/link";

const STATE_LABEL: Record<ProfitConfidenceCategory["state"], string> = {
  verified: "Verified",
  estimated: "Estimated",
  missing: "Missing",
};

const STATE_CLASS: Record<ProfitConfidenceCategory["state"], string> = {
  verified: "confidence-verified",
  estimated: "confidence-estimated",
  missing: "confidence-missing",
};

function SetupImpactsPanel({
  impacts,
  setupComplete,
}: {
  impacts: SetupImpactItem[];
  setupComplete: boolean;
}) {
  if (setupComplete && impacts.length === 0) return null;

  return (
    <div className="profit-setup-impacts">
      <div className="profit-setup-impacts-head">
        <h4 style={{ margin: 0 }}>Complete Setup</h4>
        {!setupComplete && (
          <Link href="/analytics/profit/setup" className="btn btn-primary btn-sm">
            Complete Setup
          </Link>
        )}
      </div>
      {impacts.length > 0 ? (
        <ul className="profit-setup-impact-list">
          {impacts.map((item) => (
            <li key={item.id}>
              <strong>{item.label}</strong>
              <span className="muted">{item.impact}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          All key profit inputs are connected.
        </p>
      )}
    </div>
  );
}

export function ProfitConfidenceBreakdown({
  categories,
  confidence,
  explanation,
  setupImpacts,
  setupComplete,
}: {
  categories: ProfitConfidenceCategory[];
  confidence: ProfitConfidence;
  explanation: ProfitConfidenceExplanation;
  setupImpacts: SetupImpactItem[];
  setupComplete: boolean;
}) {
  const statusClass =
    confidence.status === "verified"
      ? "confidence-high"
      : confidence.status === "estimated"
        ? "confidence-medium"
        : "confidence-low";

  return (
    <div className={`card profit-confidence-breakdown ${statusClass}`}>
      <div className="profit-confidence-breakdown-header">
        <h3 style={{ margin: 0 }}>Profit Confidence</h3>
        <div className="profit-overall-confidence">
          <span className="muted" style={{ fontSize: "0.75rem" }}>
            Profit Confidence
          </span>
          <strong>{confidence.status === "unavailable" ? "—" : `${confidence.scorePct}%`}</strong>
        </div>
      </div>

      <div className="profit-confidence-explanation">
        {explanation.verifiedLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        {explanation.estimatedLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        {explanation.missingLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <p className="profit-confidence-closing">{explanation.closingLine}</p>
      </div>

      <div className="profit-confidence-grid">
        {categories.map((cat) => (
          <div key={cat.id} className={`profit-confidence-row ${STATE_CLASS[cat.state]}`}>
            <span className="profit-confidence-cat-label">{cat.label}</span>
            <span className={`profit-confidence-state ${STATE_CLASS[cat.state]}`}>
              {STATE_LABEL[cat.state]}
            </span>
          </div>
        ))}
      </div>

      <SetupImpactsPanel impacts={setupImpacts} setupComplete={setupComplete} />
    </div>
  );
}
