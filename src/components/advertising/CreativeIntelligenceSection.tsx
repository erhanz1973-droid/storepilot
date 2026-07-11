import type { CreativeIntelRow } from "@/lib/advertising/types";
import { HEALTH_TIER_LABELS } from "@/lib/advertising/types";
import { CreativePreviewThumb } from "./CreativePreviewThumb";

const TREND_ICON = { up: "↑", down: "↓", flat: "→" } as const;

const SEVERITY_CLASS = {
  high: "adv-problem-high",
  medium: "adv-problem-medium",
  low: "adv-problem-low",
} as const;

function fatigueLabel(score: number | undefined): string {
  if (score == null) return "—";
  if (score >= 70) return "High fatigue";
  if (score >= 45) return "Moderate fatigue";
  return "Fresh";
}

export function CreativeIntelligenceSection({ creatives }: { creatives: CreativeIntelRow[] }) {
  if (creatives.length === 0) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Creative Intelligence</h2>
        <p className="muted" style={{ margin: 0 }}>No creative performance data yet.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Creative Intelligence</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.875rem" }}>
        AI-scored creatives with fatigue detection, suggested refreshes, and estimated uplift.
      </p>
      <div className="adv-creative-grid">
        {creatives.slice(0, 12).map((c) => (
          <article key={c.id} className={`adv-creative-card adv-tier-${c.healthTier}`}>
            <CreativePreviewThumb type={c.previewType} label={c.name} />
            <div className="adv-creative-header">
              <strong>{c.name}</strong>
              <div className="adv-creative-health-score">
                <span className="muted" style={{ fontSize: "0.7rem" }}>Creative Health</span>
                <span className={`adv-creative-score ${c.creativeScore >= 75 ? "high" : c.creativeScore < 35 ? "low" : ""}`}>
                  {c.creativeScore}
                </span>
              </div>
            </div>
            <p className="muted" style={{ margin: "4px 0 8px", fontSize: "0.8rem" }}>{c.campaignName}</p>

            {c.fatigueScore != null && (
              <div className="adv-creative-fatigue-bar">
                <div className="adv-fatigue-bar-header">
                  <span className="muted">Creative fatigue</span>
                  <strong className={c.fatigueScore >= 70 ? "negative" : ""}>{c.fatigueScore}/100</strong>
                </div>
                <div className="adv-fatigue-track">
                  <div
                    className={`adv-fatigue-fill ${c.fatigueScore >= 70 ? "high" : c.fatigueScore >= 45 ? "medium" : "low"}`}
                    style={{ width: `${c.fatigueScore}%` }}
                  />
                </div>
                <span className="muted" style={{ fontSize: "0.75rem" }}>{fatigueLabel(c.fatigueScore)}</span>
              </div>
            )}

            {c.problems.length > 0 && (
              <div className="adv-creative-problems">
                <span className="muted adv-problems-label">Problems detected</span>
                <ul className="adv-problems-list">
                  {c.problems.map((p) => (
                    <li key={p.label} className={SEVERITY_CLASS[p.severity]}>{p.label}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="adv-creative-ai-comment">{c.aiCommentary}</p>

            {c.suggestions && (
              <div className="adv-creative-suggestions">
                <span className="muted adv-suggestions-label">AI refresh suggestions</span>
                <ul className="adv-suggestions-list">
                  {c.suggestions.headline && <li><strong>Headline:</strong> {c.suggestions.headline}</li>}
                  {c.suggestions.cta && <li><strong>CTA:</strong> {c.suggestions.cta}</li>}
                  {c.suggestions.imageReplacement && (
                    <li><strong>Visual:</strong> {c.suggestions.imageReplacement}</li>
                  )}
                </ul>
                {c.suggestions.estimatedUpliftPct != null && (
                  <p className="adv-uplift-estimate positive">
                    Estimated uplift after refresh: +{c.suggestions.estimatedUpliftPct}% CTR
                  </p>
                )}
              </div>
            )}

            <dl className="adv-creative-metrics">
              <div><dt>CTR Trend</dt><dd className={`adv-trend adv-trend-${c.ctrTrend}`}>{TREND_ICON[c.ctrTrend]}</dd></div>
              <div><dt>Fatigue</dt><dd className={`adv-fatigue adv-fatigue-${c.fatigue}`}>{c.fatigue}</dd></div>
              <div><dt>Frequency</dt><dd>{c.frequency}</dd></div>
              <div><dt>Engagement</dt><dd>{c.engagement}</dd></div>
            </dl>
            <div className="adv-creative-footer">
              <span className={`adv-tier-pill adv-tier-${c.healthTier}`}>{HEALTH_TIER_LABELS[c.healthTier]}</span>
              <span className="adv-rec-pill">{c.recommendation}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
