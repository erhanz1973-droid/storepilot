import type { ChannelRoasRow } from "@/lib/profit/roas";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function ChannelBreakdownTable({ rows }: { rows: ChannelRoasRow[] }) {
  return (
    <div className="card profit-table-card">
      <h3>Channel Breakdown (30d)</h3>
      <div className="profit-table-wrap">
        <table className="profit-table">
          <thead>
            <tr>
              <th>Channel</th>
              <th>Spend</th>
              <th>Revenue</th>
              <th>Orders</th>
              <th>ROAS</th>
              <th>Share of Spend</th>
              <th>Share of Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.channelId} className={!row.connected && row.spend === 0 ? "channel-future" : ""}>
                <td>
                  {row.channel}
                  {!row.connected && row.channelId !== "organic" && (
                    <span className="channel-soon-badge">Soon</span>
                  )}
                </td>
                <td>{row.spend > 0 ? formatMoney(row.spend) : "—"}</td>
                <td>{row.revenue > 0 ? formatMoney(row.revenue) : "—"}</td>
                <td>{row.orders > 0 ? row.orders : "—"}</td>
                <td>{row.roas != null ? row.roas.toFixed(2) : "—"}</td>
                <td>{row.shareOfSpendPct > 0 ? `${row.shareOfSpendPct}%` : "—"}</td>
                <td>{row.shareOfRevenuePct > 0 ? `${row.shareOfRevenuePct}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
