import type { IntegrationConfidence } from "@/lib/integrations/confidence";

const LEVEL_CLASS: Record<IntegrationConfidence["level"], string> = {
  High: "confidence-high",
  Medium: "confidence-medium",
  Low: "confidence-low",
};

export function IntegrationConfidenceBanner({
  confidence,
}: {
  confidence: IntegrationConfidence;
}) {
  return (
    <div className={`card profit-confidence-banner ${LEVEL_CLASS[confidence.level]}`}>
      <div className="profit-confidence-header">
        <div>
          <h3 style={{ margin: 0 }}>Data Confidence</h3>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.875rem" }}>
            {confidence.message}
          </p>
        </div>
        <div className="profit-confidence-score">
          <strong>{confidence.scorePct}%</strong>
          <span className={`confidence-level-pill ${LEVEL_CLASS[confidence.level]}`}>
            {confidence.level}
          </span>
        </div>
      </div>
      <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.875rem" }}>
        <strong>Live data:</strong> {confidence.liveDataPct}% ·{" "}
        {confidence.connectedIntegrations.slice(0, 5).join(", ")}
        {confidence.connectedIntegrations.length > 5 ? "…" : ""}
        {confidence.estimatedAreas.length > 0 && (
          <>
            {" · "}
            <strong>Still estimated:</strong> {confidence.estimatedAreas.join(", ")}
          </>
        )}
      </p>
    </div>
  );
}
