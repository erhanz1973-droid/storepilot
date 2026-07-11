import Link from "next/link";
import type { AdvertisingPlatformRow } from "@/lib/advertising/types";
import { HEALTH_TIER_LABELS } from "@/lib/advertising/types";
import { formatRoas } from "@/lib/attribution/format-roas";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function PlatformSummaryGrid({ platforms }: { platforms: AdvertisingPlatformRow[] }) {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Platform Summary</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.875rem" }}>
        Connected advertising platforms — spend, revenue, and health at a glance.
      </p>
      <div className="adv-platform-grid">
        {platforms.map((p) => (
          <article key={p.id} className={`adv-platform-card ${p.connected ? "connected" : "disconnected"}`}>
            <div className="adv-platform-header">
              <strong>{p.label}</strong>
              <span className={`adv-connection-badge ${p.connected ? "on" : "off"}`}>
                {p.connected ? "Connected" : "Not Connected"}
              </span>
            </div>
            {p.connected ? (
              <>
                <dl className="adv-platform-metrics">
                  <div><dt>Spend</dt><dd>{fmt(p.spend)}</dd></div>
                  <div><dt>Revenue</dt><dd>{fmt(p.revenue)}</dd></div>
                  <div><dt>ROAS</dt><dd>{formatRoas(p.roas)}</dd></div>
                  <div>
                    <dt>Profit</dt>
                    <dd className={p.profit != null && p.profit < 0 ? "negative" : "positive"}>
                      {p.profit != null ? fmt(p.profit) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Health Score</dt>
                    <dd>
                      {p.healthScore != null ? (
                        <>
                          {p.healthScore}/100
                          {p.healthTier && (
                            <span className={`adv-tier-pill adv-tier-${p.healthTier}`}>
                              {HEALTH_TIER_LABELS[p.healthTier]}
                            </span>
                          )}
                        </>
                      ) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Last Sync</dt>
                    <dd>{p.lastSync ? new Date(p.lastSync).toLocaleString() : "—"}</dd>
                  </div>
                </dl>
                {p.profitExplanation && p.profit != null && p.profit < 0 && p.roas >= 2 && (
                  <div className="adv-profit-why">
                    <strong className="adv-profit-why-label">Why?</strong>
                    <p className="muted" style={{ margin: "4px 0 6px", fontSize: "0.8rem" }}>
                      {p.profitExplanation.headline}
                    </p>
                    <ul className="adv-profit-why-chain">
                      {p.profitExplanation.chain.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="muted" style={{ margin: "12px 0 0", fontSize: "0.85rem" }}>
                <Link href="/connections">Connect {p.label}</Link> to unlock campaign intelligence.
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
