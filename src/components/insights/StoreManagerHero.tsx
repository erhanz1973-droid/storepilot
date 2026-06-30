import type { StoreManagerDashboard } from "@/lib/insights/types";

export function StoreManagerHero({ dashboard }: { dashboard: StoreManagerDashboard }) {
  const connected = dashboard.integrationHealth.filter((c) => c.status === "connected").length;
  const live = dashboard.integrationHealth.filter((c) => c.dataMode === "live").length;

  return (
    <div
      className="card"
      style={{
        marginBottom: 16,
        background: "linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(16, 185, 129, 0.06))",
        border: "1px solid var(--border)",
      }}
    >
      <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        AI Commerce Advisor
      </p>
      <h2 style={{ margin: "0 0 12px", fontSize: "1.35rem", lineHeight: 1.35 }}>
        {dashboard.dailyQuestion}
      </h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: "0.9rem" }}>
        <span>
          <strong>{dashboard.opportunityFeed.length}</strong>{" "}
          <span className="muted">opportunities</span>
        </span>
        <span>
          <strong>{dashboard.priorityQueue.length}</strong>{" "}
          <span className="muted">prioritized actions</span>
        </span>
        <span>
          <strong>{live}</strong>{" "}
          <span className="muted">live sources</span>
          <span className="muted"> / {connected} connected</span>
        </span>
      </div>
    </div>
  );
}
