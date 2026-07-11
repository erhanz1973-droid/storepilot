import type { TrustEnginePanel } from "@/lib/advertising/types";

export function TrustEnginePanelView({ trust }: { trust: TrustEnginePanel }) {
  return (
    <div className="card adv-trust-engine">
      <h3 style={{ marginTop: 0 }}>Why trust this analysis?</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.875rem" }}>{trust.summary}</p>

      <dl className="adv-trust-grid">
        <div>
          <dt>Data Quality</dt>
          <dd><strong>{trust.dataQualityPct}%</strong></dd>
        </div>
        <div>
          <dt>Connected Sources</dt>
          <dd>{trust.connectedSources.join(", ") || "—"}</dd>
        </div>
        <div>
          <dt>Historical Coverage</dt>
          <dd>{trust.historicalCoverageDays} days</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd><strong>{trust.confidencePct}%</strong></dd>
        </div>
        <div>
          <dt>Prediction Reliability</dt>
          <dd className={`adv-trust-reliability adv-trust-${trust.predictionReliability.toLowerCase()}`}>
            {trust.predictionReliability}
          </dd>
        </div>
      </dl>
    </div>
  );
}
