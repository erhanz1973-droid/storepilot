"use client";

import type { ExecutiveBrief } from "@/lib/analytics/build-executive-ceo-os";

export function ExecutiveBriefCard({ brief }: { brief: ExecutiveBrief }) {
  return (
    <section className="card exec-brief" aria-labelledby="exec-brief-heading">
      <header className="exec-brief-header">
        <span className="exec-brief-eyebrow">StorePilot Executive AI</span>
        <p className="exec-brief-greeting">{brief.greeting}</p>
        <p className="exec-brief-intro">{brief.introLine}</p>
      </header>

      {/* 1. What did StorePilot analyze? */}
      <div className="exec-brief-section exec-brief-sources">
        <h3 className="exec-brief-section-title">Business analyzed</h3>
        <ul className="exec-brief-source-list">
          {brief.analyzedSources.map((source) => (
            <li key={source.label} className={source.connected ? "connected" : "disconnected"}>
              <span className="exec-brief-source-check" aria-hidden>
                {source.connected ? "✓" : "—"}
              </span>
              {source.label}
            </li>
          ))}
        </ul>
      </div>

      {/* 2. What did StorePilot find? */}
      <div className="exec-brief-section exec-brief-findings">
        <h3 className="exec-brief-section-title">Today's findings</h3>
        <ul className="exec-brief-finding-list">
          {brief.findings.map((finding) => (
            <li key={finding}>{finding}</li>
          ))}
        </ul>
      </div>

      {/* 3. What concerns the AI most? */}
      <div
        className={`exec-brief-section exec-brief-concern${
          brief.primaryConcern.actionRequired ? " exec-brief-concern-action" : ""
        }`}
      >
        <h3 className="exec-brief-section-title">Primary concern</h3>
        <p className="exec-brief-concern-headline">{brief.primaryConcern.headline}</p>
        <p className="exec-brief-concern-body">{brief.primaryConcern.body}</p>
      </div>

      {/* 4. What would StorePilot do? */}
      <div className="exec-brief-section exec-brief-recommendation">
        <h3 className="exec-brief-section-title">If I were running this business today…</h3>
        <p className="exec-brief-recommendation-body">{brief.aiRecommendation}</p>
      </div>

      {/* 5. Expected Business Outcome */}
      <div className="exec-brief-section exec-brief-outcome">
        <h3 className="exec-brief-section-title">{brief.expectedOutcome.label}</h3>
        {brief.expectedOutcome.amountFormatted ? (
          <p className="exec-brief-outcome-amount">{brief.expectedOutcome.amountFormatted}</p>
        ) : null}
        <p className="exec-brief-outcome-detail muted">{brief.expectedOutcome.detail}</p>
      </div>
    </section>
  );
}
