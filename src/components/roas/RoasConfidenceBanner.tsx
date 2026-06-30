import type { RoasConfidence } from "@/lib/profit/roas";

const LEVEL_CLASS: Record<RoasConfidence["level"], string> = {
  High: "confidence-high",
  Medium: "confidence-medium",
  Low: "confidence-low",
};

export function RoasConfidenceBanner({ confidence }: { confidence: RoasConfidence }) {
  return (
    <div className={`card profit-confidence-banner ${LEVEL_CLASS[confidence.level]}`}>
      <div className="profit-confidence-header">
        <div>
          <h3 style={{ margin: 0 }}>ROAS Confidence</h3>
        </div>
        <div className="profit-confidence-score">
          <strong>{confidence.scorePct}%</strong>
          <span className={`confidence-level-pill ${LEVEL_CLASS[confidence.level]}`}>
            {confidence.level}
          </span>
        </div>
      </div>
      <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.875rem" }}>
        <strong>Reason:</strong> {confidence.reason}
      </p>
    </div>
  );
}
