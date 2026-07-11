import { FunnelConfidenceBadge } from "@/components/funnel/FunnelConfidenceBadge";
import type { FunnelStepView } from "@/lib/funnel/types";

function formatMoney(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function FunnelFullVisualization({
  steps,
  title = "Conversion Funnel",
  subtitle,
}: {
  steps: FunnelStepView[];
  title?: string;
  subtitle?: string;
}) {
  if (steps.length === 0) return null;

  const max = Math.max(...steps.map((s) => s.users), 1);

  return (
    <div className="card funnel-full-viz">
      <h3 style={{ margin: "0 0 4px" }}>{title}</h3>
      {subtitle && (
        <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.875rem" }}>
          {subtitle}
        </p>
      )}
      {!subtitle && <div style={{ marginBottom: 16 }} />}
      <div className="analytics-funnel-steps">
        {steps.map((step, i) => (
          <div key={step.id} className="funnel-full-step">
            <div
              className="analytics-funnel-bar"
              style={{ width: `${Math.max(8, (step.users / max) * 100)}%` }}
            >
              <span className="analytics-funnel-label">{step.label}</span>
              <span className="analytics-funnel-count">{step.users.toLocaleString()}</span>
            </div>
            <div className="funnel-step-meta">
              <span>
                Users: <strong>{step.users.toLocaleString()}</strong>
              </span>
              {i < steps.length - 1 && (
                <>
                  <span>
                    Conversion: <strong>{step.conversionPct.toFixed(1)}%</strong>
                  </span>
                  <span>
                    Drop-off: <strong>{step.dropOffPct.toFixed(1)}%</strong>
                  </span>
                  <span>
                    Est. revenue lost:{" "}
                    <strong>{formatMoney(step.revenueLost)}</strong>
                    {step.revenueLost != null && (
                      <FunnelConfidenceBadge status={step.revenueLostStatus} />
                    )}
                  </span>
                </>
              )}
            </div>
            {step.recommendation && (
              <div className="funnel-step-recommendation">
                <span className="muted" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                  AI Recommendation
                </span>
                <p style={{ margin: "4px 0 0", fontSize: "0.875rem" }}>{step.recommendation}</p>
              </div>
            )}
            {i < steps.length - 1 && (
              <div className="analytics-funnel-drop">
                <span>↓ {step.conversionPct.toFixed(1)}% convert</span>
                <span className="muted">
                  {step.dropOffPct.toFixed(1)}% drop ·{" "}
                  {(step.users - (steps[i + 1]?.users ?? 0)).toLocaleString()} lost
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
