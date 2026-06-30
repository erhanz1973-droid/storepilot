import type { StoreStatus } from "@/lib/store-status/types";

const ANALYZED_LABELS: { key: keyof StoreStatus["analyzed"]; label: string }[] = [
  { key: "products", label: "Products" },
  { key: "campaigns", label: "Campaigns" },
  { key: "orders", label: "Orders" },
  { key: "customers", label: "Customers" },
  { key: "collections", label: "Collections" },
];

function formatCount(key: keyof StoreStatus["analyzed"], value: number): string {
  if (value === 0 && (key === "orders" || key === "customers")) return "0";
  return value.toLocaleString();
}

export function StoreStatusCard({
  status,
  compact = false,
}: {
  status: StoreStatus;
  compact?: boolean;
}) {
  const connected = status.integrations.filter((i) => i.connected);

  return (
    <article className={compact ? "store-status-card compact" : "card store-status-card"}>
      <div className="store-status-header">
        <div>
          <p className="muted store-status-eyebrow">Store Status</p>
          <h3 style={{ margin: "4px 0 0", fontSize: compact ? "1rem" : "1.15rem" }}>
            {status.headline}
          </h3>
        </div>
        <span className="store-status-sync muted">
          Synced {new Date(status.lastSyncedAt).toLocaleString()}
        </span>
      </div>

      {!compact && connected.length > 0 && (
        <div className="store-status-integrations">
          <span className="muted" style={{ fontSize: "0.8rem" }}>
            Integrations connected
          </span>
          <div className="store-status-integration-pills">
            {connected.map((i) => (
              <span key={i.label} className="store-status-pill connected">
                {i.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="store-status-analyzed">
        <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.85rem", fontWeight: 500 }}>
          AI analyzed
        </p>
        <div className="store-status-analyzed-grid">
          {ANALYZED_LABELS.map(({ key, label }) => (
            <div key={key} className="store-status-analyzed-item">
              <span className="store-status-analyzed-value">
                {formatCount(key, status.analyzed[key])}
              </span>
              <span className="muted store-status-analyzed-label">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="store-status-reassurance">{status.reassuranceMessage}</p>

      <div className="store-status-reasons">
        <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.85rem", fontWeight: 500 }}>
          Why opportunities are unavailable
        </p>
        <ul>
          {status.unavailableReasons.map((r) => (
            <li key={r.id}>{r.message}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}
