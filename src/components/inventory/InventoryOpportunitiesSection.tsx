import { RECOMMENDATION_BADGE_LABELS } from "@/lib/products/recommendations";
import type { InventoryAiInsight } from "@/lib/inventory/types";

function toneClass(tone: InventoryAiInsight["tone"]): string {
  switch (tone) {
    case "positive":
      return "inventory-insight-positive";
    case "warning":
      return "inventory-insight-warning";
    default:
      return "";
  }
}

export function InventoryAiInsights({ insights }: { insights: InventoryAiInsight[] }) {
  return (
    <div className="card inventory-ai-insights">
      <h3 style={{ margin: "0 0 12px" }}>AI Inventory Insights</h3>
      <ul className="inventory-insight-list">
        {insights.map((insight) => (
          <li key={insight.id} className={`inventory-insight-item ${toneClass(insight.tone)}`}>
            {insight.title && (
              <strong style={{ display: "block", marginBottom: 4 }}>{insight.title}</strong>
            )}
            {insight.text}
            {insight.actions && insight.actions.length > 0 && (
              <div className="inventory-insight-actions">
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  Recommended actions:
                </span>
                <ul>
                  {insight.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InventoryOpportunitiesSection({
  opportunities,
  recoveryPotential,
  allHealthy,
}: {
  opportunities: import("@/lib/inventory/types").InventoryOpportunity[];
  recoveryPotential: number;
  allHealthy: boolean;
}) {
  if (allHealthy) {
    return (
      <div className="card inventory-opportunities healthy">
        <h3 style={{ margin: "0 0 8px" }}>Inventory Health</h3>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          Inventory levels are balanced. StorePilot will alert you when clearance, restock, or
          bundle opportunities appear.
        </p>
      </div>
    );
  }

  if (opportunities.length === 0) return null;

  return (
    <div className="card inventory-opportunities">
      <div className="inventory-opportunities-header">
        <div>
          <h3 style={{ margin: 0 }}>Recovery Opportunities</h3>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.875rem" }}>
            Clearance, bundle, and restock actions
          </p>
        </div>
        <strong className="positive inventory-recovery-total">
          +$
          {recoveryPotential.toLocaleString()}
          /mo
        </strong>
      </div>
      <div className="inventory-opportunity-list">
        {opportunities.map((opp) => (
          <div key={opp.id} className="inventory-opportunity-item">
            <span>
              {RECOMMENDATION_BADGE_LABELS[opp.badge]} — {opp.productTitle}
            </span>
            <strong className="positive">
              +${opp.estimatedMonthlyImpact.toLocaleString()}
            </strong>
          </div>
        ))}
      </div>
      <p className="muted" style={{ margin: "12px 0 0", fontSize: "0.85rem" }}>
        Recommendations also flow to{" "}
        <a href="/decisions">Decisions</a> when analyzers detect risk.
      </p>
    </div>
  );
}
