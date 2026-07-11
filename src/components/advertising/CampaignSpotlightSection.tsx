"use client";

import Link from "next/link";
import type { CampaignSpotlight } from "@/lib/advertising/types";
import { formatRoas } from "@/lib/attribution/format-roas";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function SpotlightCard({
  item,
  variant,
}: {
  item: CampaignSpotlight;
  variant: "winner" | "loser";
}) {
  return (
    <article className={`adv-spotlight-card adv-spotlight-${variant}`}>
      <div className="adv-spotlight-header">
        <div>
          <strong>{item.campaign}</strong>
          <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>
            {item.platformLabel}
          </span>
        </div>
        <span className={`adv-health-pill adv-tier-${item.healthScore >= 70 ? "healthy" : item.healthScore < 40 ? "critical" : "needs_review"}`}>
          {item.healthScore}
        </span>
      </div>

      <dl className="adv-spotlight-metrics">
        <div><dt>ROAS</dt><dd>{formatRoas(item.roas)}</dd></div>
        <div>
          <dt>Profit</dt>
          <dd className={item.profit < 0 ? "negative" : "positive"}>{fmt(item.profit)}</dd>
        </div>
      </dl>

      <p className="adv-spotlight-reason">{item.reason}</p>
      <span className="adv-next-action">{item.nextAction}</span>

      {item.timelinePreview.length > 0 && (
        <ul className="adv-spotlight-timeline">
          {item.timelinePreview.map((t) => (
            <li key={t.id}>
              <span className="adv-timeline-date">{t.date}</span>
              <span>{t.label}</span>
            </li>
          ))}
        </ul>
      )}

      <Link href={`/advertising/campaigns/${item.id}`} className="btn btn-ghost btn-sm adv-spotlight-link">
        Open workspace →
      </Link>
    </article>
  );
}

export function CampaignSpotlightSection({
  winners,
  losers,
}: {
  winners: CampaignSpotlight[];
  losers: CampaignSpotlight[];
}) {
  return (
    <div className="adv-spotlight-section">
      {losers.length > 0 && (
        <div className="card adv-spotlight-group">
          <h3 style={{ marginTop: 0 }}>Top Losers — act first</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: "0.875rem" }}>
            Campaigns consuming budget without adequate return.
          </p>
          <div className="adv-spotlight-grid">
            {losers.map((c) => (
              <SpotlightCard key={c.id} item={c} variant="loser" />
            ))}
          </div>
        </div>
      )}

      {winners.length > 0 && (
        <div className="card adv-spotlight-group">
          <h3 style={{ marginTop: 0 }}>Top Winners — scale opportunities</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: "0.875rem" }}>
            Highest ROAS and profit — candidates for budget increases.
          </p>
          <div className="adv-spotlight-grid">
            {winners.map((c) => (
              <SpotlightCard key={c.id} item={c} variant="winner" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
