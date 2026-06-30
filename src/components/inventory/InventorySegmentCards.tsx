import type { InventorySegmentCard } from "@/lib/inventory/types";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function InventorySegmentCards({ segments }: { segments: InventorySegmentCard[] }) {
  return (
    <div className="analytics-inventory-grid">
      {segments.map((seg) => (
        <div
          key={seg.id}
          className={`analytics-metric-card inventory-segment-card inventory-segment-${seg.id}`}
        >
          <p className="analytics-metric-label">{seg.label}</p>
          <p className="analytics-metric-value">{seg.count}</p>
          <p className="analytics-metric-sublabel">{seg.description}</p>
          {seg.footnote && (
            <p className="inventory-segment-footnote muted">{seg.footnote}</p>
          )}
          {seg.valueAtRisk > 0 && seg.id !== "fast" && (
            <p className="inventory-segment-value muted">{formatMoney(seg.valueAtRisk)} at risk</p>
          )}
        </div>
      ))}
    </div>
  );
}
