import type { ExecutiveDailyBrief } from "@/lib/autopilot/types";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function ExecutiveBriefCard({ brief }: { brief: ExecutiveDailyBrief }) {
  return (
    <div className="card executive-brief-card">
      <div className="executive-brief-header">
        <h3>{brief.title}</h3>
        <span className="muted" style={{ fontSize: "0.8125rem" }}>
          {new Date(brief.generatedAt).toLocaleString()}
        </span>
      </div>
      <p className="executive-brief-headline">{brief.headline}</p>

      <dl className="brief-metrics-grid">
        <div><dt>Revenue (30d)</dt><dd>{formatMoney(brief.metrics.revenue30d)}</dd></div>
        <div><dt>Net Profit</dt><dd className="positive">{formatMoney(brief.metrics.netProfit30d)}</dd></div>
        <div><dt>Blended ROAS</dt><dd>{brief.metrics.blendedRoas?.toFixed(2) ?? "—"}</dd></div>
        <div><dt>CAC</dt><dd>{brief.metrics.cac != null ? formatMoney(brief.metrics.cac) : "—"}</dd></div>
      </dl>

      <div className="brief-sections">
        {brief.sections.map((s) => (
          <div key={s.label} className="brief-section">
            <span className="brief-section-label">{s.label}</span>
            <span>{s.content}</span>
          </div>
        ))}
      </div>

      <p className="muted" style={{ marginTop: 12, marginBottom: 0, fontSize: "0.8125rem" }}>
        Brief confidence: {brief.confidencePct}%
      </p>
    </div>
  );
}
