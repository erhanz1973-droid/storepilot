import type { InventorySummary } from "@/lib/types";

function statColor(type: "total" | "inStock" | "outOfStock" | "lowStock", value: number): string {
  if (type === "outOfStock" && value > 0) return "var(--critical)";
  if (type === "lowStock" && value > 0) return "var(--high)";
  if (type === "inStock") return "var(--low)";
  return "var(--text)";
}

export function InventoryCard({ summary }: { summary: InventorySummary }) {
  const rows = [
    { label: "Products", value: summary.totalProducts, type: "total" as const },
    { label: "In Stock", value: summary.inStock, type: "inStock" as const },
    { label: "Out of Stock", value: summary.outOfStock, type: "outOfStock" as const },
    { label: "Low Stock", value: summary.lowStock, type: "lowStock" as const },
  ];

  return (
    <div className="card">
      <h3>Inventory</h3>
      <div className="inventory-stats">
        {rows.map((row) => (
          <div key={row.label} className="inventory-stat-row">
            <span className="muted">{row.label}</span>
            <span
              className="inventory-stat-value"
              style={{ color: statColor(row.type, row.value) }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
      <p className="muted" style={{ margin: "12px 0 0", fontSize: "0.75rem" }}>
        Low stock threshold: ≤{summary.lowStockThreshold} units
      </p>
    </div>
  );
}
