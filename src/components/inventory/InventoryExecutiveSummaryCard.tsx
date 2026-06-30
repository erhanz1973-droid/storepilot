import { InventoryDataBadge } from "@/components/inventory/InventoryDataBadge";
import type { InventoryExecutiveSummary } from "@/lib/inventory/types";

type MetricKey = keyof InventoryExecutiveSummary;

const LABELS: Record<MetricKey, string> = {
  totalSkus: "Total SKUs",
  unitsOnHand: "Units On Hand",
  inventoryValue: "Inventory Value",
  deadStockValue: "Dead Stock Value",
  atRiskSkus: "At-Risk SKUs",
  inventoryCoverage: "Inventory Coverage",
};

export function InventoryExecutiveSummaryCard({
  summary,
  limitedInventoryNotice,
}: {
  summary: InventoryExecutiveSummary;
  limitedInventoryNotice?: string;
}) {
  const entries = Object.entries(LABELS) as [MetricKey, string][];

  return (
    <div className="card inventory-executive-summary">
      <h3 style={{ margin: "0 0 12px" }}>Inventory Summary</h3>
      {limitedInventoryNotice && (
        <p className="inventory-limited-notice muted" style={{ margin: "0 0 12px", fontSize: "0.875rem" }}>
          {limitedInventoryNotice}
        </p>
      )}
      <div className="inventory-summary-grid">
        {entries.map(([key, label]) => {
          const meta = summary[key];
          return (
            <div key={key} className="inventory-summary-metric">
              <span className="muted">{label}</span>
              <strong>{meta.value}</strong>
              <InventoryDataBadge status={meta.status} notice={meta.notice} />
              {meta.notice && meta.status === "unavailable" && (
                <span className="inventory-metric-notice">{meta.notice}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
