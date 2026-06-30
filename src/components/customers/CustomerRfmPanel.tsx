import type { CustomerRfmSegment } from "@/lib/customers/types";

export function CustomerRfmPanel({ segments }: { segments: CustomerRfmSegment[] }) {
  const active = segments.filter((s) => s.count > 0);

  return (
    <div className="card customers-rfm-panel">
      <h3 style={{ margin: "0 0 12px" }}>RFM Segmentation</h3>
      <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.875rem" }}>
        Recency, frequency, and monetary value groupings for targeted campaigns.
      </p>
      <div className="customers-rfm-grid">
        {active.map((seg) => (
          <div key={seg.id} className="customers-rfm-card">
            <strong>{seg.label}</strong>
            <span className="customers-rfm-count">{seg.count.toLocaleString()}</span>
            <span className="muted" style={{ fontSize: "0.78rem" }}>{seg.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
