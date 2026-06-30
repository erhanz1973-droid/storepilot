"use client";

import type { SimulationAuditReport } from "@/lib/simulation-stores/audit-types";

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  pass: { bg: "rgba(34,197,94,0.15)", fg: "#22c55e" },
  warn: { bg: "rgba(234,179,8,0.15)", fg: "#eab308" },
  fail: { bg: "rgba(239,68,68,0.15)", fg: "#ef4444" },
};

function Badge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.fail;
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: "0.75rem",
        fontWeight: 600,
        background: c.bg,
        color: c.fg,
        textTransform: "uppercase",
      }}
    >
      {status}
    </span>
  );
}

export function SimulationAuditPanel({ audit }: { audit: SimulationAuditReport }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <strong>Audit — {audit.scenarioLabel}</strong>
        <Badge status={audit.overallVerdict} />
        <span className="muted" style={{ fontSize: "0.8rem" }}>
          {new Date(audit.auditedAt).toLocaleString()}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 8,
          fontSize: "0.85rem",
        }}
      >
        <div>
          <span className="muted">Meta ROAS (7d)</span>
          <div>
            <strong>{audit.adMetrics.metaRoas7d}x</strong>
            <span className="muted"> · ${audit.adMetrics.metaSpend7d.toFixed(0)} spend</span>
          </div>
        </div>
        <div>
          <span className="muted">Google ROAS (7d)</span>
          <div>
            <strong>{audit.adMetrics.googleRoas7d}x</strong>
            <span className="muted"> · ${audit.adMetrics.googleSpend7d.toFixed(0)} spend</span>
          </div>
        </div>
        <div>
          <span className="muted">Store (30d)</span>
          <div>
            <strong>${audit.adMetrics.revenue30d.toLocaleString()}</strong>
            <span className="muted"> · {audit.adMetrics.orders30d} orders</span>
          </div>
        </div>
        <div>
          <span className="muted">Decisions</span>
          <div>
            <Badge status={audit.decisions.verdict} />{" "}
            <span className="muted">
              {audit.decisions.passCount} pass · {audit.decisions.warnCount} warn ·{" "}
              {audit.decisions.failCount} fail
            </span>
          </div>
        </div>
      </div>

      <div>
        <p className="muted" style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 600 }}>
          Ad & store data checks
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.85rem" }}>
          {audit.dataChecks.map((c) => (
            <li key={c.id} style={{ marginBottom: 4 }}>
              <Badge status={c.status} /> {c.label}: {c.detail}
            </li>
          ))}
        </ul>
      </div>

      {audit.productAdAudit.campaigns.length > 0 && (
        <div>
          <p className="muted" style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 600 }}>
            Campaign success (reklam başarısı)
          </p>
          <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
            <thead>
              <tr className="muted" style={{ textAlign: "left" }}>
                <th style={{ padding: "4px 8px 4px 0" }}>Campaign</th>
                <th>Spend</th>
                <th>Revenue</th>
                <th>ROAS</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {audit.productAdAudit.campaigns.map((c) => (
                <tr key={c.campaignId}>
                  <td style={{ padding: "4px 8px 4px 0" }}>
                    {c.campaignName}
                    <span className="muted" style={{ fontSize: "0.75rem" }}>
                      {" "}
                      ({c.platform})
                    </span>
                  </td>
                  <td>${c.spend7d.toFixed(0)}</td>
                  <td>${c.revenue7d.toFixed(0)}</td>
                  <td>{c.roas7d}x</td>
                  <td>
                    <Badge status={c.successVerdict} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {audit.productAdAudit.products.length > 0 && (
        <div>
          <p className="muted" style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 600 }}>
            Product ad → sales (ürün reklamı → satış)
          </p>
          <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
            <thead>
              <tr className="muted" style={{ textAlign: "left" }}>
                <th style={{ padding: "4px 8px 4px 0" }}>Product</th>
                <th>Units</th>
                <th>Rev (30d)</th>
                <th>Ad share</th>
                <th>ROAS</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {audit.productAdAudit.products.map((p) => (
                <tr key={p.productId}>
                  <td style={{ padding: "4px 8px 4px 0" }}>{p.productTitle}</td>
                  <td>{p.unitsSold30d}</td>
                  <td>${p.revenue30d.toFixed(0)}</td>
                  <td>${p.allocatedAdSpend7d.toFixed(0)}</td>
                  <td>{p.productRoas7d > 0 ? `${p.productRoas7d}x` : "—"}</td>
                  <td>
                    <Badge status={p.adsToSalesVerdict} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.8rem" }}>
            {audit.productAdAudit.attributedOrderCount} attributed orders · $
            {audit.productAdAudit.attributedOrderRevenue.toFixed(0)} journey revenue
          </p>
        </div>
      )}

      {audit.decisions.matches.length > 0 && (
        <div>
          <p className="muted" style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 600 }}>
            Expected decisions vs engine output
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.85rem" }}>
            {audit.decisions.matches.map((m, i) => (
              <li key={`${m.expectedLabel}-${i}`} style={{ marginBottom: 6 }}>
                <Badge status={m.verdict} /> <strong>{m.expectedLabel}</strong>
                {m.actualSummary && (
                  <span className="muted"> → {m.actualSummary.slice(0, 80)}</span>
                )}
                <div className="muted" style={{ fontSize: "0.8rem" }}>
                  {m.reason}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {audit.decisions.samples.length > 0 && (
        <div>
          <p className="muted" style={{ margin: "0 0 6px", fontSize: "0.8rem", fontWeight: 600 }}>
            Top decisions ({audit.decisions.decisionCount} total)
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.85rem" }}>
            {audit.decisions.samples.map((d, i) => (
              <li key={`${d.summary}-${i}`} style={{ marginBottom: 4 }}>
                <strong>{d.summary}</strong>
                <div className="muted" style={{ fontSize: "0.8rem" }}>
                  {d.recommendedAction}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {audit.decisions.forbiddenHits.length > 0 && (
        <div style={{ color: "#ef4444", fontSize: "0.85rem" }}>
          <strong>Forbidden decisions detected:</strong>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            {audit.decisions.forbiddenHits.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="muted" style={{ fontSize: "0.8rem" }}>
        Validation gate:{" "}
        {audit.gate.canGenerateRecommendations ? "recommendations allowed" : "blocked"} · trusted:{" "}
        {audit.gate.trustedProviderIds.join(", ") || "none"}
        {audit.validationSuite.blockers.length > 0 && (
          <> · blockers: {audit.validationSuite.blockers.join("; ")}</>
        )}
      </div>
    </div>
  );
}
