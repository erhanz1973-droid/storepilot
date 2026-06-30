import type { ChannelAttributionRow } from "@/lib/attribution/models";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function ChannelProfitTable({ rows }: { rows: ChannelAttributionRow[] }) {
  return (
    <div className="card profit-table-card">
      <h3>Revenue & Profit by Channel</h3>
      <div className="profit-table-wrap">
        <table className="profit-table">
          <thead>
            <tr>
              <th>Channel</th>
              <th>Attributed Revenue</th>
              <th>Attributed Profit</th>
              <th>Spend</th>
              <th>Profit ROAS</th>
              <th>Assisted Revenue</th>
              <th>Assist Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.channelId}>
                <td>{row.channelLabel}</td>
                <td>{formatMoney(row.attributedRevenue)}</td>
                <td className={row.attributedProfit < 0 ? "negative" : "positive"}>
                  {formatMoney(row.attributedProfit)}
                </td>
                <td>{row.adSpend > 0 ? formatMoney(row.adSpend) : "—"}</td>
                <td>{row.profitRoas != null ? row.profitRoas.toFixed(2) : "—"}</td>
                <td>{row.assistedRevenue > 0 ? formatMoney(row.assistedRevenue) : "—"}</td>
                <td>{row.assistRatePct > 0 ? `${row.assistRatePct}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
