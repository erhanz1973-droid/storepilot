import type { AudienceRow } from "@/lib/advertising/types";
import { HEALTH_TIER_LABELS } from "@/lib/advertising/types";
import { formatRoas } from "@/lib/attribution/format-roas";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const OVERLAP_LEVEL_LABEL = { low: "Low", medium: "Medium", high: "High" } as const;

export function AudienceAnalysisSection({ audiences }: { audiences: AudienceRow[] }) {
  if (audiences.length === 0) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Audience Analysis</h2>
        <p className="muted" style={{ margin: 0 }}>No audience segments detected yet.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Audience Analysis</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.875rem" }}>
        Broad, Lookalike, Interest, Retargeting, and Custom audiences — performance and overlap waste.
      </p>
      <div className="adv-audience-grid">
        {audiences.map((a) => (
          <article key={a.type} className="adv-audience-card">
            <div className="adv-audience-header">
              <strong>{a.label}</strong>
              <span className={`adv-health-pill adv-tier-${a.healthTier}`}>{a.healthScore}</span>
            </div>
            <dl className="adv-audience-metrics">
              <div><dt>Spend</dt><dd>{fmt(a.spend)}</dd></div>
              <div><dt>CPA</dt><dd>{fmt(a.cpa)}</dd></div>
              <div><dt>ROAS</dt><dd>{formatRoas(a.roas)}</dd></div>
              <div><dt>Frequency</dt><dd>{a.frequency}</dd></div>
              <div className="adv-overlap-cell">
                <dt>Overlap</dt>
                <dd>
                  <span className="adv-overlap-pct">{a.overlapPct}%</span>
                  <span className={`adv-overlap-level adv-overlap-${a.overlapLevel}`}>
                    {OVERLAP_LEVEL_LABEL[a.overlapLevel]}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Estimated Waste</dt>
                <dd className="negative">{fmt(a.estimatedWasteMonthly)}/mo</dd>
              </div>
            </dl>
            <div className="adv-audience-footer">
              <span className={`adv-tier-pill adv-tier-${a.healthTier}`}>{HEALTH_TIER_LABELS[a.healthTier]}</span>
              <span className="adv-rec-pill">{a.recommendation}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
