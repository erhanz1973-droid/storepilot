import type { CustomerRecord } from "@/lib/customers/types";

function fmt(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function CustomerRepeatBuyersPanel({
  customers,
  onSelect,
}: {
  customers: CustomerRecord[];
  onSelect: (c: CustomerRecord) => void;
}) {
  if (customers.length === 0) {
    return (
      <div className="card customers-empty-state">
        <h3 style={{ marginTop: 0 }}>Repeat Buyers</h3>
        <p style={{ margin: "0 0 12px", lineHeight: 1.5 }}>
          No repeat buyers found yet.
        </p>
        <p className="muted" style={{ margin: 0, lineHeight: 1.5, fontSize: "0.875rem" }}>
          Once customers place two or more orders, they will appear here with:
        </p>
        <ul className="customers-empty-list">
          <li>Lifetime Spend</li>
          <li>Orders</li>
          <li>Average Order Value</li>
          <li>Last Purchase</li>
          <li>Customer Lifetime Value</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="card customers-repeat-panel">
      <h3 style={{ margin: "0 0 12px" }}>Repeat Buyers</h3>
      <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.875rem" }}>
        Customers with 2+ orders — your core retention base.
      </p>
      <div className="customers-mini-table-wrap">
        <table className="customers-mini-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Orders</th>
              <th>Lifetime Spend</th>
              <th>AOV</th>
            </tr>
          </thead>
          <tbody>
            {customers.slice(0, 8).map((c) => (
              <tr key={c.id} className="clickable" onClick={() => onSelect(c)}>
                <td><strong>{c.name}</strong></td>
                <td>{c.ordersCount}</td>
                <td>{fmt(c.lifetimeRevenue)}</td>
                <td>{fmt(c.aov)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
