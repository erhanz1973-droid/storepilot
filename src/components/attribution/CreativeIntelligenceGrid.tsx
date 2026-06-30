import type { CreativeAttributionRow } from "@/lib/attribution/models";

const STATUS_LABEL: Record<CreativeAttributionRow["status"], string> = {
  winning: "⭐ Winning",
  fatigued: "⚠ Fatigued",
  underperforming: "↓ Underperforming",
  neutral: "Neutral",
};

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function CreativeIntelligenceGrid({ creatives }: { creatives: CreativeAttributionRow[] }) {
  const featured = creatives.slice(0, 8);
  if (featured.length === 0) {
    return (
      <div className="card">
        <h3>Creative Intelligence</h3>
        <p className="muted" style={{ margin: 0 }}>No creative-level data yet.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Creative Intelligence</h3>
      <p className="muted" style={{ margin: "4px 0 12px", fontSize: "0.875rem" }}>
        Specific diagnostics — not generic pause/scale labels
      </p>
      <div className="creative-grid">
        {featured.map((c) => (
          <article key={c.creativeId} className={`creative-card creative-${c.status}`}>
            <div className="creative-card-header">
              <strong>{c.creativeName}</strong>
              <span className={`creative-status creative-status-${c.status}`}>
                {STATUS_LABEL[c.status]}
              </span>
            </div>
            <p className="muted" style={{ margin: "4px 0 8px", fontSize: "0.8125rem" }}>
              {c.campaignName}
            </p>
            <dl className="creative-metrics">
              <div><dt>Profit</dt><dd className={c.profit < 0 ? "negative" : "positive"}>{formatMoney(c.profit)}</dd></div>
              <div><dt>ROAS</dt><dd>{c.roas?.toFixed(2) ?? "—"}</dd></div>
              <div><dt>CTR</dt><dd>{c.ctr}%</dd></div>
              <div><dt>Spend</dt><dd>{formatMoney(c.spend)}</dd></div>
            </dl>
            {c.insight && (
              <p className="creative-insight">{c.insight}</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
