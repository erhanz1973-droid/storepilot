import type { CollectionProfitRow, ProductProfitRow } from "@/lib/profit/types";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function ProductProfitTable({
  rows,
  title,
  showCostSource = false,
}: {
  rows: ProductProfitRow[];
  title: string;
  showCostSource?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="card">
        <h3>{title}</h3>
        <p className="muted" style={{ margin: 0 }}>No product profit data for this period.</p>
      </div>
    );
  }

  return (
    <div className="card profit-table-card">
      <h3>{title}</h3>
      <div className="profit-table-wrap">
        <table className="profit-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Revenue</th>
              <th>COGS</th>
              <th>Gross Profit</th>
              <th>Margin</th>
              <th>Units</th>
              {showCostSource && <th>Cost</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.productId} className={row.losingMoney ? "losing-row" : ""}>
                <td>{row.title}</td>
                <td>{formatMoney(row.revenue)}</td>
                <td>{formatMoney(row.cogs)}</td>
                <td className={row.grossProfit < 0 ? "negative" : "positive"}>
                  {formatMoney(row.grossProfit)}
                </td>
                <td>{row.marginPct}%</td>
                <td>{row.unitsSold}</td>
                {showCostSource && (
                  <td>
                    {row.unitCost != null ? formatMoney(row.unitCost) : "—"}
                    {row.costSource === "estimated" && (
                      <span className="cost-est-badge">est.</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CollectionProfitTable({ rows }: { rows: CollectionProfitRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="card profit-table-card">
      <h3>Profit by Collection</h3>
      <div className="profit-table-wrap">
        <table className="profit-table">
          <thead>
            <tr>
              <th>Collection</th>
              <th>Revenue</th>
              <th>COGS</th>
              <th>Gross Profit</th>
              <th>Margin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.collectionId}>
                <td>{row.title}</td>
                <td>{formatMoney(row.revenue)}</td>
                <td>{formatMoney(row.cogs)}</td>
                <td>{formatMoney(row.grossProfit)}</td>
                <td>{row.marginPct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
