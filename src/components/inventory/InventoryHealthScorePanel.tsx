import { InventoryDataBadge } from "@/components/inventory/InventoryDataBadge";
import type { InventoryHealthBreakdown } from "@/lib/inventory/summary";

export function InventoryHealthScorePanel({
  breakdown,
}: {
  breakdown: InventoryHealthBreakdown;
}) {
  return (
    <div className="card inventory-health-panel">
      <div className="inventory-health-header">
        <div>
          <h3 style={{ margin: 0 }}>Inventory Health</h3>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.875rem" }}>
            {breakdown.explanation}
          </p>
        </div>
        <div className="inventory-health-overall">
          <strong>{breakdown.overall}/100</strong>
          <InventoryDataBadge status={breakdown.status} />
        </div>
      </div>
      <div className="inventory-health-factors">
        {breakdown.factors.map((factor) => (
          <div key={factor.id} className="inventory-health-factor">
            <div className="inventory-health-factor-label">
              <span>{factor.label}</span>
              <strong>{factor.score}%</strong>
            </div>
            <div className="inventory-health-factor-bar">
              <div
                className="inventory-health-factor-fill"
                style={{ width: `${factor.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
