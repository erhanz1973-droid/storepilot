import type { ExecutiveSummary } from "@/lib/insights/executive-summary";

function formatCurrency(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatPct(pct: number | null): string {
  if (pct == null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

const SYNC_BADGE: Record<ExecutiveSummary["lastSyncStatus"], string> = {
  healthy: "badge-low",
  stale: "badge-medium",
  error: "badge-critical",
};

export function ExecutiveSummaryStrip({ summary }: { summary: ExecutiveSummary }) {
  const cards = [
    {
      label: "Store Health",
      value: String(summary.storeHealthScore),
      sub: "/ 100",
      change: null as number | null,
    },
    {
      label: "Revenue (30d)",
      value: formatCurrency(summary.revenue30d),
      sub: null,
      change: summary.revenueChangePct,
    },
    {
      label: "Profit (30d)",
      value: formatCurrency(summary.profit30d),
      sub: null,
      change: summary.profitChangePct,
    },
    {
      label: "ROAS",
      value: summary.roas > 0 ? summary.roas.toFixed(2) : "—",
      sub: null,
      change: summary.roasChangePct,
    },
    {
      label: "Critical Issues",
      value: String(summary.criticalIssueCount),
      sub: null,
      change: null,
      alert: summary.criticalIssueCount > 0,
    },
    {
      label: "Opportunities",
      value: String(summary.opportunityCount),
      sub: null,
      change: null,
    },
  ];

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div>
          <p className="muted" style={{ margin: "0 0 4px", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            AI Commerce Advisor
          </p>
          <h2 style={{ margin: 0, fontSize: "1.25rem" }}>{summary.headline}</h2>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <span className={`badge ${SYNC_BADGE[summary.lastSyncStatus]}`}>{summary.lastSyncStatus}</span>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.8rem" }}>
            Last sync {new Date(summary.lastSyncAt).toLocaleString()}
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
        }}
      >
        {cards.map((card) => (
          <div
            key={card.label}
            style={{
              padding: "12px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: card.alert ? "rgba(239, 68, 68, 0.06)" : "var(--surface)",
            }}
          >
            <p className="muted" style={{ margin: "0 0 4px", fontSize: "0.8rem" }}>
              {card.label}
            </p>
            <div style={{ fontSize: "1.35rem", fontWeight: 700, lineHeight: 1.2 }}>
              {card.value}
              {card.sub && (
                <span className="muted" style={{ fontSize: "0.85rem", fontWeight: 400 }}>
                  {" "}
                  {card.sub}
                </span>
              )}
            </div>
            {card.change != null && (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "0.8rem",
                  color: card.change >= 0 ? "var(--success)" : "var(--danger)",
                }}
              >
                {formatPct(card.change)} vs prior
              </p>
            )}
          </div>
        ))}
      </div>

      {summary.topRecommendation && (
        <div
          style={{
            marginTop: 16,
            padding: "12px 14px",
            borderRadius: 8,
            background: "linear-gradient(135deg, rgba(59, 130, 246, 0.06), rgba(16, 185, 129, 0.04))",
            border: "1px solid var(--border)",
          }}
        >
          <p className="muted" style={{ margin: "0 0 4px", fontSize: "0.8rem", fontWeight: 600 }}>
            AI Recommendation of the Day
          </p>
          <p style={{ margin: "0 0 4px", fontWeight: 600 }}>{summary.topRecommendation.title}</p>
          <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.9rem" }}>
            {summary.topRecommendation.recommendation}
          </p>
          {summary.topRecommendation.why.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.85rem" }}>
              {summary.topRecommendation.why.slice(0, 4).map((w) => (
                <li key={w.label} style={{ marginBottom: 2 }}>
                  <strong>{w.label}:</strong> {w.value}
                </li>
              ))}
              <li>
                <strong>Confidence:</strong> {summary.topRecommendation.confidence}%
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
