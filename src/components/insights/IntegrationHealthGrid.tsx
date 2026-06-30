"use client";

import { useRouter } from "next/navigation";
import type { IntegrationHealthCard } from "@/lib/integrations/health";

const STATUS_ICON: Record<IntegrationHealthCard["status"], string> = {
  connected: "🟢",
  disconnected: "🔴",
  error: "🔴",
  waiting: "🟡",
  demo: "🟡",
};

const STATUS_LABEL: Record<IntegrationHealthCard["status"], string> = {
  connected: "Connected",
  disconnected: "Not Connected",
  error: "Sync Failed",
  waiting: "Waiting Authorization",
  demo: "Demo Mode",
};

function IntegrationHealthCardView({ card }: { card: IntegrationHealthCard }) {
  const router = useRouter();

  async function handleRetry() {
    if (!card.syncEndpoint) return;
    await fetch(card.syncEndpoint, { method: "POST" });
    router.refresh();
  }

  return (
    <div className="card" style={{ margin: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h4 style={{ margin: "0 0 4px" }}>{card.label}</h4>
          <p style={{ margin: 0, fontSize: "0.95rem" }}>
            {STATUS_ICON[card.status]} {STATUS_LABEL[card.status]}
            {card.dataMode === "live" && card.status === "connected" ? " · Live" : ""}
          </p>
        </div>
        {card.connectHref && card.status !== "connected" && (
          <a href={card.connectHref} className="btn btn-secondary" style={{ fontSize: "0.85rem" }}>
            Connect
          </a>
        )}
      </div>

      {card.syncFailed && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(220, 38, 38, 0.08)",
            fontSize: "0.9rem",
          }}
        >
          <strong>Sync failed</strong>
          {card.errorMessage && (
            <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.85rem" }}>
              {card.errorMessage.slice(0, 160)}
            </p>
          )}
          {card.lastSuccessfulSyncAt && (
            <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.85rem" }}>
              Last successful sync: {new Date(card.lastSuccessfulSyncAt).toLocaleString()}
            </p>
          )}
          {card.syncEndpoint && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: 8, fontSize: "0.85rem" }}
              onClick={handleRetry}
            >
              Retry sync
            </button>
          )}
        </div>
      )}

      <div className="stack" style={{ marginTop: 12, gap: 6 }}>
        {card.metrics
          .filter((m) => m.label !== "Last Sync" && m.label !== "Status")
          .map((metric) => (
            <div key={metric.label} className="breakdown-row" style={{ fontSize: "0.9rem" }}>
              <span className="muted">{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
      </div>
    </div>
  );
}

export function IntegrationHealthGrid({ cards }: { cards: IntegrationHealthCard[] }) {
  return (
    <div>
      <h3 style={{ marginBottom: 4 }}>Integration Health</h3>
      <p className="muted" style={{ marginTop: 0, marginBottom: 12, fontSize: "0.9rem" }}>
        Live data freshness across your connected sources
      </p>
      <div className="grid-2">
        {cards.map((card) => (
          <IntegrationHealthCardView key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}
