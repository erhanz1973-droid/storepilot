"use client";

import Link from "next/link";
import type { ExecutiveBrief } from "@/lib/analytics/build-executive-ceo-os";
import { EvidenceBulletList, SupportedByList } from "./SupportedByList";

export function ExecutiveBriefCard({ brief }: { brief: ExecutiveBrief }) {
  return (
    <section className="card exec-brief" aria-labelledby="exec-brief-heading">
      <header className="exec-brief-header">
        <span className="exec-brief-eyebrow">StorePilot Executive AI</span>
        <p className="exec-brief-greeting">{brief.greeting}</p>
        <p className="exec-brief-intro">{brief.introLine}</p>
      </header>

      <div className="exec-brief-section exec-brief-coverage">
        <h3 className="exec-brief-section-title">Business Coverage</h3>
        <p className="exec-brief-coverage-score">{brief.businessCoverage.scorePct}%</p>
        {brief.businessCoverage.confidenceLimitation ? (
          <p className="exec-brief-coverage-note muted">{brief.businessCoverage.confidenceLimitation}</p>
        ) : null}
      </div>

      <div className="exec-brief-section exec-brief-sources">
        <h3 className="exec-brief-section-title">Today&apos;s Executive Briefing is based on</h3>
        <ul className="exec-brief-source-list">
          {brief.basedOnSources.map((label) => (
            <li key={label} className="connected">
              <span className="exec-brief-source-check" aria-hidden>
                ✓
              </span>
              {label}
            </li>
          ))}
        </ul>
        {brief.notAvailableSources.length > 0 ? (
          <>
            <h4 className="exec-brief-subsection-title">Not available</h4>
            <ul className="exec-brief-source-list">
              {brief.notAvailableSources.map((label) => (
                <li key={label} className="disconnected">
                  <span className="exec-brief-source-check" aria-hidden>
                    ○
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="exec-brief-data-footer muted">{brief.dataBasisFooter}</p>
      </div>

      {brief.advertisingIntelligence ? (
        <div className="exec-brief-section exec-brief-ad-intel">
          <h3 className="exec-brief-section-title">{brief.advertisingIntelligence.headline}</h3>
          <p className="exec-brief-ad-intel-body">{brief.advertisingIntelligence.body}</p>
          <p className="exec-brief-ad-intel-lead muted">
            If you are already running advertising, connect Meta Ads and/or Google Ads so I can:
          </p>
          <ul className="exec-brief-ad-intel-bullets">
            {brief.advertisingIntelligence.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="exec-brief-ad-intel-closing muted">{brief.advertisingIntelligence.closing}</p>
          <Link className="button primary exec-brief-ad-intel-cta" href={brief.advertisingIntelligence.ctaHref}>
            {brief.advertisingIntelligence.ctaLabel}
          </Link>
        </div>
      ) : null}

      <div className="exec-brief-section exec-brief-findings">
        <h3 className="exec-brief-section-title">Today&apos;s findings</h3>
        <ul className="exec-brief-finding-list">
          {brief.findings.map((finding) => (
            <li key={finding}>{finding}</li>
          ))}
        </ul>
      </div>

      {brief.recommendations.length > 0 ? (
        <div className="exec-brief-section exec-brief-recs">
          <h3 className="exec-brief-section-title">Recommendations</h3>
          <p className="muted exec-brief-kind-note">
            Evidence-based items from connected data. Hypotheses are labeled — never presented as facts.
          </p>
          <ul className="exec-brief-rec-list">
            {brief.recommendations.map((r) => (
              <li key={r.title} className={`exec-brief-rec-item evidence-standing-${r.standing}`}>
                <div className="exec-brief-rec-head">
                  <span className={`exec-brief-standing-badge evidence-standing-${r.standing}`}>
                    {r.standingLabel}
                  </span>
                  <strong>{r.title}</strong>
                </div>
                <SupportedByList sources={r.supportedBy} />
                {r.standingNote ? (
                  <p className="muted exec-brief-standing-note">{r.standingNote}</p>
                ) : null}
                <EvidenceBulletList points={r.evidence} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {brief.decisionEvidence ? (
        <div className="exec-brief-section exec-brief-decision-evidence">
          <h3 className="exec-brief-section-title">Evidence for today&apos;s decision</h3>
          <p>
            <span
              className={`exec-brief-standing-badge evidence-standing-${brief.decisionEvidence.standing}`}
            >
              {brief.decisionEvidence.label}
            </span>
          </p>
          <SupportedByList sources={brief.decisionEvidence.supportedBy} />
          {brief.decisionEvidence.explanation.trim() ? (
            <p className="muted exec-brief-standing-note">{brief.decisionEvidence.explanation}</p>
          ) : null}
          <EvidenceBulletList points={brief.decisionEvidence.evidence} />
        </div>
      ) : null}

      {brief.opportunities.length > 0 ? (
        <div className="exec-brief-section exec-brief-opps">
          <h3 className="exec-brief-section-title">Opportunities</h3>
          <p className="muted exec-brief-kind-note">
            Suggested without live advertising data — not evidence-based recommendations.
          </p>
          <ul className="exec-brief-finding-list">
            {brief.opportunities.map((o) => (
              <li key={o.title}>
                {o.title}
                <span className="muted"> — {o.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        className={`exec-brief-section exec-brief-concern${
          brief.primaryConcern.actionRequired ? " exec-brief-concern-action" : ""
        }`}
      >
        <h3 className="exec-brief-section-title">Primary concern</h3>
        <p className="exec-brief-concern-headline">{brief.primaryConcern.headline}</p>
        <p className="exec-brief-concern-body">{brief.primaryConcern.body}</p>
      </div>

      <div className="exec-brief-section exec-brief-recommendation">
        <h3 className="exec-brief-section-title">If I were running this business today…</h3>
        <p className="exec-brief-recommendation-body">{brief.aiRecommendation}</p>
      </div>

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
