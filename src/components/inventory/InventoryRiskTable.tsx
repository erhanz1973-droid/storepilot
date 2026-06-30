"use client";

import { InventoryDataBadge } from "@/components/inventory/InventoryDataBadge";
import type { InventorySkuRow } from "@/lib/inventory/types";
import { INVENTORY_SEGMENT_LABELS } from "@/lib/inventory/types";

function formatMoney(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function InventoryRiskTable({
  rows,
  onSelect,
}: {
  rows: InventorySkuRow[];
  onSelect: (row: InventorySkuRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="card inventory-risk-table">
        <h3 style={{ marginTop: 0 }}>At-Risk Inventory</h3>
        <p className="muted" style={{ margin: 0 }}>
          No dead stock, slow movers, or stockout risks detected.
        </p>
      </div>
    );
  }

  return (
    <div className="card inventory-risk-table">
      <h3 style={{ margin: "0 0 12px" }}>At-Risk Inventory</h3>
      <div className="inventory-table-wrap">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Segment</th>
              <th>On Hand</th>
              <th>Velocity</th>
              <th>Est. Stockout</th>
              <th>Value</th>
              <th>Action</th>
              <th>Confidence</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.productId}
                className="inventory-table-row"
                onClick={() => onSelect(row)}
              >
                <td>
                  <strong>{row.title}</strong>
                </td>
                <td>
                  <span className={`inventory-segment-pill inventory-pill-${row.segment}`}>
                    {INVENTORY_SEGMENT_LABELS[row.segment]}
                  </span>
                </td>
                <td>{row.inventory}</td>
                <td>{row.velocityPerDay}/day</td>
                <td>{row.estimatedStockoutLabel}</td>
                <td>{formatMoney(row.inventoryValue)}</td>
                <td>
                  {row.recommendation ? (
                    <span className="inventory-action-label">{row.recommendation.label}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {row.recommendation ? `${row.recommendation.confidencePct}%` : "—"}
                </td>
                <td className="inventory-action-reason">
                  {row.recommendation?.reason ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InventoryDetailDrawer({
  row,
  open,
  onClose,
}: {
  row: InventorySkuRow | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open || !row) return null;

  return (
    <div className="product-attribution-drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="product-attribution-drawer inventory-detail-drawer"
        onClick={(e) => e.stopPropagation()}
        aria-label={`${row.title} inventory`}
      >
        <div className="product-attribution-drawer-header">
          <div>
            <h3 style={{ margin: 0 }}>{row.title}</h3>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
              {INVENTORY_SEGMENT_LABELS[row.segment]}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <section className="product-attribution-drawer-section">
          <h4>Stock &amp; Velocity</h4>
          <div className="inventory-drawer-grid">
            <div>
              <span className="muted">On Hand</span>
              <strong>{row.inventory}</strong>
            </div>
            <div>
              <span className="muted">Units Sold (30d)</span>
              <strong>{row.unitsSold30d}</strong>
            </div>
            <div>
              <span className="muted">Velocity</span>
              <strong>{row.velocityPerDay}/day</strong>
            </div>
            <div>
              <span className="muted">Est. Stockout</span>
              <strong>{row.estimatedStockoutLabel}</strong>
            </div>
            <div>
              <span className="muted">Inventory Value</span>
              <strong>{formatMoney(row.inventoryValue)}</strong>
            </div>
            <div>
              <span className="muted">Revenue (30d)</span>
              <strong>{formatMoney(row.revenue30d)}</strong>
            </div>
            <div>
              <span className="muted">Net Profit (30d)</span>
              <strong>{formatMoney(row.netProfit)}</strong>
              <InventoryDataBadge status={row.profitStatus} />
            </div>
          </div>
        </section>

        {row.recommendation && (
          <section className="product-attribution-drawer-section recommendation">
            <h4>Recommendation</h4>
            <p style={{ margin: "0 0 8px" }}>
              <strong>{row.recommendation.label}</strong> — {row.recommendation.summary}
            </p>
            <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.875rem" }}>
              {row.recommendation.reason}
            </p>
            <p className="positive" style={{ margin: 0 }}>
              Est. impact: +{formatMoney(row.recommendation.expectedImpact)}/month ·{" "}
              {row.recommendation.confidencePct}% confidence
            </p>
          </section>
        )}
      </aside>
    </div>
  );
}
