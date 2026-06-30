import type { CustomerSegmentRow } from "@/lib/customers/types";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function CustomerSegmentsPanel({ segments }: { segments: CustomerSegmentRow[] }) {
  const active = segments.filter((s) => s.count > 0 || s.countStatus === "verified");

  if (active.every((s) => s.count === 0)) {
    return (
      <div className="card customers-empty-state">
        <h3 style={{ marginTop: 0 }}>Customer Segments</h3>
        <p className="muted" style={{ margin: 0 }}>
          Segments appear once customer records are synced from Shopify.
        </p>
      </div>
    );
  }

  return (
    <div className="card customers-segments-panel">
      <h3 style={{ margin: "0 0 12px" }}>Customer Segments</h3>
      <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.875rem" }}>
        Automatically grouped by purchase behavior and value.
      </p>
      <div className="customers-segments-grid">
        {active.filter((s) => s.count > 0).map((seg) => (
          <div key={seg.id} className="customers-segment-card">
            <span className="customers-segment-label">{seg.label}</span>
            <strong className="customers-segment-count">{seg.count.toLocaleString()}</strong>
            {seg.revenueStatus === "verified" && seg.revenueContribution != null ? (
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                {formatMoney(seg.revenueContribution)} revenue
              </span>
            ) : (
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                {seg.revenueNotice ?? "Revenue unavailable"}
              </span>
            )}
            {seg.shareOfRevenuePct != null && seg.shareOfRevenuePct > 0 && (
              <span className="customers-segment-share">{seg.shareOfRevenuePct}% of sample revenue</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
