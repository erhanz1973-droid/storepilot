import type { CustomerGeoRow } from "@/lib/customers/types";

function fmt(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function CustomerGeoPanel({ regions }: { regions: CustomerGeoRow[] }) {
  if (regions.length === 0) {
    return (
      <div className="card">
        <h3 style={{ margin: 0 }}>Geographic Distribution</h3>
        <p className="muted" style={{ margin: "8px 0 0" }}>
          Connect customer addresses to see regional revenue concentration.
        </p>
      </div>
    );
  }

  const maxRev = Math.max(...regions.map((r) => r.revenue), 1);

  return (
    <div className="card customers-geo-panel">
      <h3 style={{ margin: "0 0 12px" }}>Geographic Distribution</h3>
      <div className="customers-geo-list">
        {regions.map((r) => (
          <div key={r.region} className="customers-geo-row">
            <div className="customers-geo-label">
              <strong>{r.region}</strong>
              <span className="muted">{r.customers} customers · {fmt(r.revenue)}</span>
            </div>
            <div className="customers-geo-bar-wrap">
              <div
                className="customers-geo-bar"
                style={{ width: `${(r.revenue / maxRev) * 100}%` }}
              />
              <span className="customers-geo-share">{r.sharePct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
