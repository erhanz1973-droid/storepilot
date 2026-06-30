import type { CustomerSegmentRow } from "@/lib/customers/types";

function fmt(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function CustomerRevenueBySegment({ segments }: { segments: CustomerSegmentRow[] }) {
  const withRevenue = segments.filter(
    (s) => s.revenueStatus === "verified" && s.revenueContribution != null && s.revenueContribution > 0,
  );

  if (withRevenue.length === 0) {
    return (
      <div className="card customers-revenue-segment-panel unavailable">
        <h3 style={{ margin: "0 0 8px" }}>Revenue by Customer Segment</h3>
        <p style={{ margin: "0 0 4px", fontWeight: 600 }}>Revenue unavailable</p>
        <p className="muted" style={{ margin: 0 }}>
          Waiting for complete customer-order sync.
        </p>
      </div>
    );
  }

  const maxRev = Math.max(...withRevenue.map((s) => s.revenueContribution!), 1);

  return (
    <div className="card customers-revenue-segment-panel">
      <h3 style={{ margin: "0 0 12px" }}>Revenue by Customer Segment</h3>
      <div className="customers-revenue-segment-list">
        {withRevenue.map((seg) => (
          <div key={seg.id} className="customers-revenue-segment-row">
            <div className="customers-revenue-segment-head">
              <strong>{seg.label}</strong>
              <span>
                {fmt(seg.revenueContribution!)} · {seg.shareOfRevenuePct ?? 0}%
              </span>
            </div>
            <div className="customers-revenue-segment-bar">
              <div
                className="fill"
                style={{ width: `${(seg.revenueContribution! / maxRev) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
