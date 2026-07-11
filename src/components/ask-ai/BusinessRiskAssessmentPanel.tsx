"use client";

import type { BusinessRiskAssessment } from "@/lib/insights/business-risk-assessment";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function BusinessRiskAssessmentPanel({
  assessment,
}: {
  assessment: BusinessRiskAssessment;
}) {
  const { primaryRisk, categories, recommendationSteps } = assessment;
  const secondaryCategories = categories.filter((c) => c.priorityRank > 1).slice(0, 3);

  return (
    <div className="risk-executive-briefing">
      <section className="risk-exec-summary card">
        <p className="risk-section-label">Executive Briefing</p>
        <p className="risk-exec-summary-text">{assessment.executiveBriefing}</p>
      </section>

      <section className="risk-primary-card card">
        <p className="risk-section-label">Biggest Business Risk</p>
        <h3 className="risk-primary-title">{primaryRisk.title}</h3>
        <dl className="risk-primary-metrics">
          <div>
            <dt>Urgency</dt>
            <dd>{primaryRisk.urgency}</dd>
          </div>
          <div>
            <dt>Estimated Financial Exposure</dt>
            <dd className="risk-impact-positive">
              {primaryRisk.estimatedExposureMonthly > 0
                ? `${formatMoney(primaryRisk.estimatedExposureMonthly)}/month`
                : primaryRisk.estimatedExposureDisplay}
            </dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>{primaryRisk.confidencePct}%</dd>
          </div>
          <div>
            <dt>Likelihood</dt>
            <dd>{primaryRisk.probabilityPct}%</dd>
          </div>
          <div>
            <dt>Time Horizon</dt>
            <dd>{primaryRisk.timeHorizon}</dd>
          </div>
        </dl>
        <p className="risk-recommended-action">
          <span className="risk-section-label">Recommended Action</span>
          {primaryRisk.recommendedAction}
        </p>
      </section>

      <section className="risk-why-primary">
        <p className="risk-section-label">Why this is the biggest risk</p>
        <p className="risk-consequence-text">{primaryRisk.businessConsequence}</p>
        <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.85rem", lineHeight: 1.5 }}>
          {primaryRisk.rankingRationale}
        </p>
      </section>

      {primaryRisk.riskTimeline.length > 0 && (
        <section className="risk-timeline-section">
          <p className="risk-section-label">Risk Timeline</p>
          <div className="risk-timeline-chain">
            {primaryRisk.riskTimeline.map((entry, idx) => (
              <div key={entry.horizon} className="risk-timeline-step">
                {idx > 0 && <span className="risk-timeline-arrow">↓</span>}
                <div>
                  <strong>{entry.horizon}</strong>
                  <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
                    {entry.consequence}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {primaryRisk.inactionImpact.length > 0 && (
        <section className="risk-inaction-section card">
          <p className="risk-section-label">If nothing changes for 30 days…</p>
          <dl className="risk-inaction-grid">
            {primaryRisk.inactionImpact.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {recommendationSteps.length > 0 && (
        <section className="risk-actions-section">
          <p className="risk-section-label">Recommended Actions</p>
          <div className="risk-action-steps">
            {recommendationSteps.map((step, idx) => (
              <article key={step.step} className="risk-action-card">
                <header>
                  <span className="risk-step-badge">Step {step.step}</span>
                  <strong>{step.action}</strong>
                </header>
                <dl className="risk-action-metrics">
                  <div>
                    <dt>Estimated Time</dt>
                    <dd>{step.estimatedTime}</dd>
                  </div>
                  <div>
                    <dt>Expected Benefit</dt>
                    <dd className="risk-impact-positive">{step.expectedBenefit}</dd>
                  </div>
                  <div>
                    <dt>Risk Reduction</dt>
                    <dd>{step.riskReductionPct}%</dd>
                  </div>
                </dl>
                <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.82rem" }}>
                  {step.reason}
                </p>
                {idx < recommendationSteps.length - 1 && (
                  <span className="risk-timeline-arrow">↓</span>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {primaryRisk.crossBusinessEffects.length > 0 && (
        <section className="risk-cross-effects">
          <p className="risk-section-label">Cross-business impact</p>
          <div className="risk-cross-chain">
            {primaryRisk.crossBusinessEffects.map((area, idx) => (
              <span key={area} className="risk-cross-item">
                {idx > 0 && <span className="risk-timeline-arrow">↓</span>}
                {area}
              </span>
            ))}
          </div>
        </section>
      )}

      {assessment.whyNotOtherRisks.length > 0 && (
        <section className="risk-why-not">
          <p className="risk-section-label">Why not the other risks?</p>
          <ul className="risk-why-not-list">
            {assessment.whyNotOtherRisks.map((alt) => (
              <li key={alt.label}>
                <strong>{alt.label}</strong> — {alt.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      {secondaryCategories.length > 0 && (
        <section className="risk-secondary-section">
          <p className="risk-section-label">Other priorities to monitor</p>
          <div className="risk-secondary-grid">
            {secondaryCategories.map((cat) => (
              <article key={cat.category} className="risk-secondary-card">
                <header>
                  <span className="risk-priority-badge">Priority #{cat.priorityRank}</span>
                  <strong>{cat.label}</strong>
                  <span className="risk-trend-badge">{cat.trendLabel}</span>
                </header>
                <dl className="risk-secondary-metrics">
                  <div>
                    <dt>{cat.businessImpactLabel}</dt>
                    <dd>{cat.businessImpactDisplay}</dd>
                  </div>
                  <div>
                    <dt>Urgency</dt>
                    <dd>{cat.urgency}</dd>
                  </div>
                  <div>
                    <dt>Probability</dt>
                    <dd>{cat.probabilityPct}%</dd>
                  </div>
                  <div>
                    <dt>Resolution</dt>
                    <dd>{cat.timeHorizon}</dd>
                  </div>
                </dl>
                {cat.inactionImpact.length > 0 && (
                  <div className="risk-secondary-inaction">
                    <span className="muted" style={{ fontSize: "0.75rem" }}>
                      If ignored (30 days)
                    </span>
                    {cat.inactionImpact.map((item) => (
                      <p key={item.label} style={{ margin: "2px 0 0", fontSize: "0.82rem" }}>
                        {item.label}: <strong>{item.value}</strong>
                      </p>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
