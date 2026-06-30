"use client";

import type { EnrichedProductProfitRow } from "@/lib/profit/profit-page-view";
import { useMemo, useState } from "react";

type SortKey = keyof Pick<
  EnrichedProductProfitRow,
  | "title"
  | "revenue"
  | "grossProfit"
  | "netProfit"
  | "marginPct"
  | "adSpend"
  | "roas"
  | "unitsSold"
  | "inventory"
  | "displayStatus"
>;

const STATUS_CLASS: Record<string, string> = {
  Winner: "status-winner",
  Healthy: "status-healthy",
  "Low Margin": "status-low-margin",
  "Losing Money": "status-losing",
  "Dead Inventory": "status-dead-inventory",
  "Out of Stock": "status-oos",
  "Low Stock": "status-low-stock",
};

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function ProductProfitTableSortable({
  rows,
  title = "Product Profitability",
  onSelectProduct,
}: {
  rows: EnrichedProductProfitRow[];
  title?: string;
  onSelectProduct?: (productId: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("netProfit");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") {
        return sortAsc ? av - bv : bv - av;
      }
      return sortAsc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [rows, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function header(label: string, key: SortKey) {
    const active = sortKey === key;
    return (
      <th>
        <button type="button" className="profit-sort-btn" onClick={() => toggleSort(key)}>
          {label}
          {active ? (sortAsc ? " ↑" : " ↓") : ""}
        </button>
      </th>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="card">
        <h3>{title}</h3>
        <p className="muted" style={{ margin: 0 }}>No product profit data yet.</p>
      </div>
    );
  }

  return (
    <div className="card profit-table-card">
      <h3>{title}</h3>
      <div className="profit-table-wrap">
        <table className="profit-table profit-table-wide">
          <thead>
            <tr>
              {header("Product", "title")}
              {header("Revenue", "revenue")}
              {header("Gross Profit", "grossProfit")}
              {header("Net Profit", "netProfit")}
              {header("Margin", "marginPct")}
              {header("Ad Spend", "adSpend")}
              {header("ROAS", "roas")}
              {header("Units Sold", "unitsSold")}
              {header("Inventory", "inventory")}
              {header("Status", "displayStatus")}
              <th>Attribution</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.productId}
                className={`${row.losingMoney ? "losing-row" : ""} ${onSelectProduct ? "profit-row-clickable" : ""}`}
                onClick={onSelectProduct ? () => onSelectProduct(row.productId) : undefined}
              >
                <td>{row.title}</td>
                <td>{formatMoney(row.revenue)}</td>
                <td className={row.grossProfit < 0 ? "negative" : ""}>
                  {formatMoney(row.grossProfit)}
                </td>
                <td className={row.netProfit < 0 ? "negative" : "positive"}>
                  {formatMoney(row.netProfit)}
                  {row.costSource === "estimated" && (
                    <span className="cost-est-badge" title="Estimated COGS">est.</span>
                  )}
                </td>
                <td>{row.marginPct}%</td>
                <td>{row.adSpend > 0 ? formatMoney(row.adSpend) : "—"}</td>
                <td>{row.roas != null ? row.roas.toFixed(2) : "—"}</td>
                <td>{row.unitsSold}</td>
                <td>{row.inventory}</td>
                <td>
                  <span
                    className={`product-status-pill ${STATUS_CLASS[row.displayStatus] ?? "status-healthy"}`}
                  >
                    {row.displayStatus}
                  </span>
                </td>
                <td className="profit-attribution-cell">
                  <span className="profit-attribution-confidence">
                    {row.attributionConfidencePct > 0
                      ? `${row.attributionConfidencePct}%`
                      : "—"}
                  </span>
                  <span className="muted" style={{ fontSize: "0.75rem", display: "block" }}>
                    {row.attributionMethod}
                    {row.adCostEstimated && row.adSpend > 0 ? " · est." : ""}
                  </span>
                </td>
                <td className="profit-rec-cell muted">{row.recommendation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
