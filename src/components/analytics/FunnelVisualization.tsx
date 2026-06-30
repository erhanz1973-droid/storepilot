import type { FunnelStep } from "@/lib/analytics/types";

type Props = {
  steps: FunnelStep[];
  aiExplanation?: string;
};

export function FunnelVisualization({ steps, aiExplanation }: Props) {
  const max = Math.max(...steps.map((s) => s.count), 1);

  return (
    <div className="analytics-funnel card">
      <h3>Conversion Funnel</h3>
      <div className="analytics-funnel-steps">
        {steps.map((step, i) => (
          <div key={step.id} className="analytics-funnel-step">
            <div
              className="analytics-funnel-bar"
              style={{ width: `${Math.max(8, (step.count / max) * 100)}%` }}
            >
              <span className="analytics-funnel-label">{step.label}</span>
              <span className="analytics-funnel-count">{step.count.toLocaleString()}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="analytics-funnel-drop">
                <span>↓ {step.conversionPct.toFixed(1)}% convert</span>
                <span className="muted">
                  {step.dropPct.toFixed(1)}% drop · {step.lostUsers.toLocaleString()} lost
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      {aiExplanation && (
        <div className="analytics-funnel-ai">
          <p className="muted" style={{ margin: "0 0 4px", fontSize: "0.8rem", fontWeight: 600 }}>
            AI Insight
          </p>
          <p style={{ margin: 0 }}>{aiExplanation}</p>
        </div>
      )}
    </div>
  );
}
