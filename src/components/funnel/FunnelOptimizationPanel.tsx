import type { FunnelOptimizationAction } from "@/lib/funnel/types";
import { FunnelConfidenceBadge } from "@/components/funnel/FunnelConfidenceBadge";

const PRIORITY_CLASS: Record<FunnelOptimizationAction["priority"], string> = {
  critical: "funnel-opt-critical",
  high: "funnel-opt-high",
  medium: "funnel-opt-medium",
};

const FOCUS_LABEL: Record<FunnelOptimizationAction["focusArea"], string> = {
  checkout: "Checkout",
  product_page: "Product page",
  traffic: "Traffic",
  mobile: "Mobile",
  channel: "Channel",
  aov: "AOV",
  retention: "Retention",
};

export function FunnelOptimizationPanel({
  actions,
}: {
  actions: FunnelOptimizationAction[];
}) {
  if (actions.length === 0) {
    return (
      <div className="card funnel-optimization-panel">
        <h3 style={{ margin: "0 0 8px" }}>Optimization Queue</h3>
        <p className="muted" style={{ margin: 0 }}>
          No high-confidence conversion fixes detected yet — sync more store data to surface opportunities.
        </p>
      </div>
    );
  }

  return (
    <div className="card funnel-optimization-panel">
      <h3 style={{ margin: "0 0 4px" }}>Optimization Queue</h3>
      <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.875rem" }}>
        Prioritized actions to improve conversion — ranked by expected profit impact.
      </p>
      <div className="funnel-optimization-list">
        {actions.map((action, i) => (
          <article key={action.id} className={`funnel-optimization-item ${PRIORITY_CLASS[action.priority]}`}>
            <div className="funnel-optimization-top">
              <span className="funnel-optimization-rank">#{i + 1}</span>
              <span className={`funnel-opt-priority ${PRIORITY_CLASS[action.priority]}`}>
                {action.priority}
              </span>
              <span className="muted funnel-optimization-focus">{FOCUS_LABEL[action.focusArea]}</span>
            </div>
            <h4 style={{ margin: "8px 0 4px" }}>{action.title}</h4>
            <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.875rem" }}>
              {action.description}
            </p>
            <p style={{ margin: "0 0 10px", fontSize: "0.9rem" }}>{action.recommendation}</p>
            <div className="funnel-optimization-meta">
              {action.expectedMonthlyImpact != null && (
                <span>
                  Est. impact:{" "}
                  <strong>
                    +$
                    {action.expectedMonthlyImpact.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                    /mo
                  </strong>
                </span>
              )}
              <span>
                Confidence: <strong>{Math.round(action.confidenceScore * 100)}%</strong>
              </span>
              <FunnelConfidenceBadge status={action.dataTier} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
