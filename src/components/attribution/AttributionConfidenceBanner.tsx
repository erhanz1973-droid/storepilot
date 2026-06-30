import type { AttributionConfidence } from "@/lib/attribution/models";

const LEVEL_CLASS: Record<AttributionConfidence["level"], string> = {
  High: "confidence-high",
  Medium: "confidence-medium",
  Low: "confidence-low",
};

export function AttributionConfidenceBanner({ confidence }: { confidence: AttributionConfidence }) {
  return (
    <div className={`attribution-confidence-banner ${LEVEL_CLASS[confidence.level]}`}>
      <div>
        <strong>Attribution confidence: {confidence.level}</strong> ({confidence.scorePct}/100)
        <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.875rem" }}>
          {confidence.reason}
        </p>
      </div>
      <dl className="confidence-metrics">
        <div>
          <dt>Tracking</dt>
          <dd>{confidence.trackingCompletenessPct}%</dd>
        </div>
        <div>
          <dt>Identity</dt>
          <dd>{confidence.identityResolutionPct}%</dd>
        </div>
        <div>
          <dt>Avg touchpoints</dt>
          <dd>{confidence.avgTouchpoints}</dd>
        </div>
      </dl>
      {confidence.missingData.length > 0 && (
        <p className="confidence-missing" style={{ margin: "8px 0 0", fontSize: "0.8125rem" }}>
          Missing: {confidence.missingData.join(" · ")}
        </p>
      )}
    </div>
  );
}
