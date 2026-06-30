"use client";

import type { CampaignAttributionRow } from "@/lib/attribution/models";
import { useMemo, useState } from "react";

type SortKey = keyof Pick<
  CampaignAttributionRow,
  | "campaignName"
  | "attributedRevenue"
  | "netProfit"
  | "roas"
  | "breakEvenRoas"
  | "roasGapPct"
  | "adSpend"
  | "orders"
  | "cac"
>;

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatGap(gap: number | null): string {
  if (gap == null) return "—";
  return `${gap > 0 ? "-" : "+"}${Math.abs(gap)}%`;
}

export function CampaignProfitTableSortable({ rows }: { rows: CampaignAttributionRow[] }) {
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

  return (
    <div className="card profit-table-card">
      <h3>Campaign Profitability</h3>
      <p className="muted" style={{ marginTop: 4, marginBottom: 12, fontSize: "0.875rem" }}>
        Sorted by true net profit — break-even ROAS explains why campaigns lose money
      </p>
      <div className="profit-table-wrap">
        <table className="profit-table">
          <thead>
            <tr>
              {header("Campaign", "campaignName")}
              {header("Current ROAS", "roas")}
              {header("Break-even ROAS", "breakEvenRoas")}
              {header("Gap", "roasGapPct")}
              {header("Net Profit", "netProfit")}
              {header("Spend", "adSpend")}
              {header("Revenue", "attributedRevenue")}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.campaignId} className={row.netProfit < 0 ? "losing-row" : ""}>
                <td>{row.campaignName}</td>
                <td>{row.roas != null ? row.roas.toFixed(2) : "—"}</td>
                <td>{row.breakEvenRoas != null ? row.breakEvenRoas.toFixed(2) : "—"}</td>
                <td className={row.roasGapPct != null && row.roasGapPct > 0 ? "negative" : ""}>
                  {formatGap(row.roasGapPct)}
                </td>
                <td className={row.netProfit < 0 ? "negative" : "positive"}>
                  {formatMoney(row.netProfit)}
                </td>
                <td>{formatMoney(row.adSpend)}</td>
                <td>{formatMoney(row.attributedRevenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
