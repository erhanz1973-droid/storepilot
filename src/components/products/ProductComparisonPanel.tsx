"use client";

import type { EnrichedProductCard } from "@/lib/products/page-view";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function ProductComparisonPanel({
  products,
  onClear,
}: {
  products: EnrichedProductCard[];
  onClear: () => void;
}) {
  if (products.length < 2) return null;

  const metrics: {
    label: string;
    fn: (p: EnrichedProductCard) => string;
  }[] = [
    { label: "Revenue", fn: (p) => formatMoney(p.revenue) },
    { label: "Net Profit", fn: (p) => formatMoney(p.netProfit) },
    { label: "Margin", fn: (p) => `${p.marginPct}%` },
    { label: "Ad Spend", fn: (p) => formatMoney(p.adCost) },
    { label: "ROAS", fn: (p) => p.productRoas?.toFixed(2) ?? "—" },
    { label: "Inventory", fn: (p) => String(p.inventory) },
    {
      label: "Trend",
      fn: (p) => {
        const g = p.trends.revenueGrowthPct;
        return g != null ? `${g >= 0 ? "+" : ""}${g}%` : "—";
      },
    },
  ];

  return (
    <div className="product-comparison-panel">
      <div className="product-comparison-header">
        <strong>Comparing {products.length} products</strong>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="product-comparison-table-wrap">
        <table className="product-comparison-table">
          <thead>
            <tr>
              <th>Metric</th>
              {products.map((p) => (
                <th key={p.productId}>{p.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.label}>
                <td>{m.label}</td>
                {products.map((p) => (
                  <td key={p.productId}>{m.fn(p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
