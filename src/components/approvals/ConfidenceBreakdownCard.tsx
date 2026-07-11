import type { ConfidenceBreakdown } from "@/lib/approvals/decision-center-types";
import { MetricInfo } from "./MetricInfo";

export function ConfidenceBreakdownCard({ breakdown }: { breakdown: ConfidenceBreakdown }) {
  return (
    <section className="decision-confidence-card">
      <div className="decision-confidence-headline">
        <h5>
          AI Confidence <MetricInfo metricKey="confidence" />
        </h5>
        <div className="decision-confidence-score">
          <strong className="decision-confidence-pct">{breakdown.confidencePct}%</strong>
          <span
            className={`decision-confidence-label decision-confidence-label-${
              breakdown.qualitativeLabel.startsWith("High")
                ? "high"
                : breakdown.qualitativeLabel.startsWith("Moderate")
                  ? "moderate"
                  : "low"
            }`}
          >
            {breakdown.qualitativeLabel}
          </span>
        </div>
      </div>

      <p className="muted">{breakdown.summary}</p>

      {breakdown.reducedBecause.length > 0 && (
        <div className="decision-signal-group">
          <span className="decision-signal-label">Reduced because</span>
          <ul>
            {breakdown.reducedBecause.map((s) => (
              <li key={s} className="decision-signal-missing">
                • {s}
              </li>
            ))}
          </ul>
          <p className="decision-confidence-boost muted">
            Confidence would increase to approximately {breakdown.potentialConfidencePct}% after
            these integrations.
          </p>
        </div>
      )}

      {breakdown.availableSignals.length > 0 && (
        <div className="decision-signal-group">
          <span className="decision-signal-label">Available data</span>
          <ul>
            {breakdown.availableSignals.map((s) => (
              <li key={s} className="decision-signal-available">
                ✅ {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
