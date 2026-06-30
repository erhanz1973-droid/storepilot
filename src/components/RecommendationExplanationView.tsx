import { MetricPills } from "@/components/MetricPills";
import type { RecommendationExplanation } from "@/lib/ai/types";

export function RecommendationExplanationView({
  explanation,
}: {
  explanation: RecommendationExplanation;
}) {
  return (
    <div className="explain-panel">
      <h4>Analysis: {explanation.title}</h4>

      <div className="stack" style={{ marginTop: 12 }}>
        <section>
          <p className="muted" style={{ margin: "0 0 4px", fontWeight: 500 }}>
            Why it was generated
          </p>
          <p style={{ margin: 0, lineHeight: 1.5 }}>{explanation.why}</p>
        </section>

        <section>
          <p className="muted" style={{ margin: "0 0 8px", fontWeight: 500 }}>
            Supporting metrics
          </p>
          <MetricPills metrics={explanation.supportingMetrics} />
        </section>

        <section>
          <p className="muted" style={{ margin: "0 0 4px", fontWeight: 500 }}>
            Risks
          </p>
          <ul className="explain-risks">
            {explanation.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </section>

        <section>
          <p className="muted" style={{ margin: "0 0 4px", fontWeight: 500 }}>
            Expected outcome
          </p>
          <p style={{ margin: 0 }}>{explanation.expectedOutcome}</p>
        </section>

        {explanation.actualOutcome && (
          <section>
            <p className="muted" style={{ margin: "0 0 4px", fontWeight: 500 }}>
              Actual outcome
            </p>
            <p style={{ margin: 0 }}>{explanation.actualOutcome}</p>
          </section>
        )}

        {explanation.predictionAccuracy != null && (
          <section>
            <p className="muted" style={{ margin: "0 0 4px", fontWeight: 500 }}>
              Prediction accuracy
            </p>
            <p style={{ margin: 0 }}>{explanation.predictionAccuracy}%</p>
          </section>
        )}

        <section>
          <p className="muted" style={{ margin: "0 0 4px", fontWeight: 500 }}>
            Confidence ({Math.round(explanation.confidenceScore * 100)}%)
          </p>
          <p style={{ margin: 0, lineHeight: 1.5 }}>{explanation.confidenceBreakdown}</p>
        </section>
      </div>
    </div>
  );
}
