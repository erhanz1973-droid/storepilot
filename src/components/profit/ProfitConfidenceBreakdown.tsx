import type { ProfitConfidenceCategory } from "@/lib/profit/profit-page-view";
import type { ProfitConfidence } from "@/lib/profit/types";

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

export function ProfitConfidenceBreakdown({
  categories,
  confidence,
}: {
  categories: ProfitConfidenceCategory[];
  confidence: ProfitConfidence;
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
            Overall Profit Confidence
          </span>
          <strong>{confidence.status === "unavailable" ? "—" : `${confidence.scorePct}%`}</strong>
        </div>
      </div>

      <div className="profit-confidence-grid">
        {categories.map((cat) => (
          <div key={cat.id} className={`profit-confidence-row ${STATE_CLASS[cat.state]}`}>
            <span className="profit-confidence-cat-label">{cat.label}</span>
            <span className={`profit-confidence-state ${STATE_CLASS[cat.state]}`}>
              {STATE_LABEL[cat.state]}
            </span>
            <span className="profit-confidence-pct">{cat.confidencePct}%</span>
          </div>
        ))}
      </div>

      {confidence.notice && (
        <p className="profit-confidence-warning" style={{ marginTop: 12, marginBottom: 0 }}>
          {confidence.notice}
        </p>
      )}
    </div>
  );
}
