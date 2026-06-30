import type { AttributionStrategyPlan, ImpactVerificationStatus } from "@/lib/attribution/decision-engine";
import {
  expirationLabel,
  validUntilLabel,
} from "@/lib/attribution/recommendation-trust";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function riskClass(level: string): string {
  if (level === "Low") return "positive";
  if (level === "High") return "negative";
  return "";
}

function verificationBadgeClass(status: ImpactVerificationStatus): string {
  if (status === "Verified") return "status-verified";
  if (status === "Estimated") return "status-estimated";
  return "status-simulated";
}

function VerificationBadge({ status }: { status: ImpactVerificationStatus }) {
  return (
    <span className={`attribution-verification-badge ${verificationBadgeClass(status)}`}>
      {status}
    </span>
  );
}

function MetricBlock({
  label,
  spend,
  roas,
  profit,
}: {
  label: string;
  spend?: number;
  roas?: number;
  profit?: number;
}) {
  return (
    <div className="attribution-metric-block">
      <span className="muted" style={{ fontSize: "0.75rem" }}>
        {label}
      </span>
      {spend != null && (
        <div>
          Spend <strong>{formatMoney(spend)}</strong>
        </div>
      )}
      {roas != null && (
        <div>
          ROAS <strong>{roas.toFixed(2)}</strong>
        </div>
      )}
      {profit != null && (
        <div>
          Profit{" "}
          <strong className={profit >= 0 ? "positive" : "negative"}>
            {formatMoney(profit)}
          </strong>
        </div>
      )}
    </div>
  );
}

export function AttributionStrategyPanel({ plan }: { plan: AttributionStrategyPlan }) {
  if (plan.actions.length === 0) return null;

  const allDependenciesMet = plan.actions.every((action) =>
    action.dependencies.filter((d) => d.required).every((d) => d.met),
  );

  return (
    <div className={`card attribution-strategy-panel ${plan.expiration.isExpired ? "expired" : ""}`}>
      <div className="attribution-strategy-header">
        <div>
          <span className="muted" style={{ fontSize: "0.8rem" }}>
            Overall Strategy
          </span>
          <h3 style={{ margin: "4px 0 0" }}>
            {plan.strategyLabel} — {plan.targetScope}
          </h3>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.85rem" }}>
            Business objective: <strong>{plan.businessObjectiveLabel}</strong>
          </p>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.82rem" }}>
            Generated {expirationLabel(plan.expiration)} · Valid for{" "}
            {validUntilLabel(plan.expiration)} · {plan.expiration.message}
          </p>
          {!plan.objectiveReconciliation.aligned && (
            <div className="attribution-objective-notice">
              <strong>Objective note:</strong> {plan.objectiveReconciliation.explanation}
              {plan.objectiveReconciliation.suggestedObjective && (
                <span>
                  {" "}
                  Consider updating your objective to &quot;
                  {plan.objectiveReconciliation.suggestedObjective}&quot;.
                </span>
              )}
            </div>
          )}
        </div>
        <div className="attribution-strategy-confidence">
          <span className="muted" style={{ fontSize: "0.75rem" }}>
            Overall Confidence
          </span>
          <strong>{plan.confidencePct}%</strong>
        </div>
      </div>

      <section className="attribution-strategy-section" style={{ marginBottom: 16 }}>
        <h4>Confidence Breakdown</h4>
        <div className="attribution-confidence-breakdown">
          {[
            { label: "Data Completeness", value: plan.confidenceBreakdown.dataCompletenessPct },
            { label: "Attribution Quality", value: plan.confidenceBreakdown.attributionQualityPct },
            { label: "Historical Stability", value: plan.confidenceBreakdown.historicalStabilityPct },
            { label: "Sample Size", value: plan.confidenceBreakdown.sampleSizePct },
          ].map((row) => (
            <div key={row.label} className="attribution-confidence-row">
              <span>{row.label}</span>
              <strong>{row.value}%</strong>
            </div>
          ))}
          <div className="attribution-confidence-row overall">
            <span>Overall Confidence</span>
            <strong>{plan.confidenceBreakdown.overallPct}%</strong>
          </div>
        </div>
      </section>

      <div className="attribution-strategy-grid">
        <section className="attribution-strategy-section">
          <h4>Reason</h4>
          <ul className="attribution-preconditions">
            {plan.preconditions.map((item) => (
              <li key={item.id} className={`precondition-${item.sentiment}`}>
                {item.text}
              </li>
            ))}
          </ul>
        </section>

        <section className="attribution-strategy-section">
          <h4>Assumptions</h4>
          <ul className="attribution-assumptions">
            {plan.assumptions.map((item) => (
              <li key={item.id} className={item.valid ? "assumption-valid" : "assumption-invalid"}>
                {item.valid ? "•" : "⚠"} {item.text}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="attribution-strategy-section" style={{ marginTop: 16 }}>
        <div className="attribution-section-heading">
          <h4>Dynamic Break-even ROAS</h4>
          <VerificationBadge status="Verified" />
        </div>
        <p className="attribution-break-even-value">
          <strong>{plan.breakEvenModel.breakEvenRoas.toFixed(2)}</strong>
        </p>
        <p className="muted" style={{ fontSize: "0.82rem", lineHeight: 1.45, margin: "8px 0 0" }}>
          {plan.breakEvenModel.summary}
        </p>
      </section>

      <section className="attribution-strategy-section" style={{ marginTop: 16 }}>
        <h4>Strategy Evaluation</h4>
        <div className="attribution-strategy-alternatives">
          {plan.strategyAlternatives.map((alt) => (
            <div
              key={alt.strategy}
              className={`attribution-strategy-alt ${alt.selected ? "selected" : ""}`}
            >
              <div className="attribution-strategy-alt-header">
                <span>
                  {alt.selected ? "✓ " : ""}
                  {alt.label}
                  {alt.selected ? " (Selected)" : ""}
                </span>
                <strong>Score: {alt.score}</strong>
              </div>
              {!alt.selected && (
                <>
                  <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.82rem" }}>
                    {alt.reason}
                  </p>
                  {alt.whyNot.length > 0 && (
                    <div className="attribution-why-not">
                      <span className="muted" style={{ fontSize: "0.78rem" }}>
                        Not selected because:
                      </span>
                      <ul>
                        {alt.whyNot.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="attribution-strategy-section" style={{ marginTop: 16 }}>
        <div className="attribution-section-heading">
          <h4>What if? Simulation</h4>
          <VerificationBadge status={plan.simulation.verificationStatus} />
        </div>
        <div className="attribution-simulation-current">
          <span>
            {plan.simulation.scope} spend:{" "}
            <strong>{formatMoney(plan.simulation.currentSpend)}</strong>
          </span>
          <span>
            ROAS: <strong>{plan.simulation.currentRoas.toFixed(2)}</strong>
          </span>
          <span>
            Break-even: <strong>{plan.simulation.breakEvenRoas.toFixed(2)}</strong>
          </span>
        </div>
        <div className="attribution-simulation-scenarios">
          {plan.simulation.scenarios.map((scenario) => (
            <div key={scenario.id} className="attribution-simulation-row-extended">
              <div>
                <strong>{scenario.label}</strong>
                <div className="muted" style={{ fontSize: "0.78rem", marginTop: 4 }}>
                  Likely outcome · Probability: {scenario.probability} · Expected time:{" "}
                  {scenario.expectedTime}
                </div>
              </div>
              <div>
                <span className="positive">
                  Profit +{formatMoney(scenario.profitDeltaLow)} to +
                  {formatMoney(scenario.profitDeltaHigh)}
                </span>
                <div className="muted" style={{ fontSize: "0.78rem", marginTop: 4 }}>
                  Revenue {scenario.revenueDeltaPctLow >= 0 ? "+" : ""}
                  {scenario.revenueDeltaPctLow}% to{" "}
                  {scenario.revenueDeltaPctHigh >= 0 ? "+" : ""}
                  {scenario.revenueDeltaPctHigh}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="attribution-strategy-section" style={{ marginTop: 16 }}>
        <h4>Optimization Workflow</h4>
        <div className="attribution-workflow-chain">
          {plan.optimizationWorkflow.map((step, idx) => (
            <div key={step.step} className="attribution-workflow-step">
              {idx > 0 && <span className="attribution-cross-module-arrow">↓</span>}
              <div>
                <strong>
                  Step {step.step}: {step.label}
                </strong>
                {step.waitDays != null && (
                  <div className="muted" style={{ fontSize: "0.78rem" }}>
                    Wait {step.waitDays} days
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="attribution-strategy-meta-row">
        <section className="attribution-strategy-section">
          <h4>Recommendation Stability</h4>
          <p style={{ margin: 0 }}>
            <strong>{plan.stability.status}</strong>
          </p>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.82rem" }}>
            {plan.stability.message}
          </p>
        </section>

        <section className="attribution-strategy-section">
          <h4>Prerequisites</h4>
          <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.82rem" }}>
            {allDependenciesMet
              ? "Required checks are satisfied for budget changes."
              : "Complete prerequisites before executing budget recommendations."}
          </p>
          <ul className="attribution-dependencies">
            {plan.actions[0]?.dependencies
              .filter((d) => d.required)
              .map((dep) => (
                <li key={dep.id} className={dep.met ? "dep-met" : "dep-unmet"}>
                  {dep.met ? "✓" : "○"} {dep.label}
                </li>
              ))}
          </ul>
        </section>
      </div>

      <section className="attribution-strategy-section" style={{ marginTop: 16 }}>
        <h4>Learning Feedback</h4>
        {plan.learningFeedback.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            No verified outcomes yet. Apply a recommendation to start measured learning — simulated
            projections are never shown as verified results.
          </p>
        ) : (
          plan.learningFeedback.map((entry) => (
            <div key={entry.outcomeId ?? entry.recommendationTitle} className="attribution-learning-entry">
              <div className="attribution-section-heading">
                <strong>{entry.recommendationTitle}</strong>
                <VerificationBadge status={entry.verificationStatus} />
              </div>
              <p className="muted" style={{ margin: "4px 0", fontSize: "0.82rem" }}>
                Applied · {entry.appliedAt}
              </p>
              {(entry.before || entry.after) && (
                <div className="attribution-learning-metrics">
                  {entry.before && (
                    <MetricBlock label="Before" {...entry.before} />
                  )}
                  {entry.after && (
                    <MetricBlock label="After" {...entry.after} />
                  )}
                </div>
              )}
              <div className="attribution-learning-result">
                {entry.estimatedImprovement != null && (
                  <span>
                    Estimated improvement{" "}
                    <strong>+{formatMoney(entry.estimatedImprovement)}</strong>{" "}
                    <VerificationBadge status="Estimated" />
                  </span>
                )}
                {entry.observedImprovement != null && (
                  <span>
                    Observed improvement{" "}
                    <strong className="positive">
                      +{formatMoney(entry.observedImprovement)}
                    </strong>{" "}
                    <VerificationBadge status={entry.verificationStatus} />
                  </span>
                )}
              </div>
              {entry.resultSummary && (
                <p style={{ margin: "8px 0 4px", fontSize: "0.85rem" }}>{entry.resultSummary}</p>
              )}
              <span className={`attribution-learning-status status-${entry.status.toLowerCase().replace(/\s+/g, "-")}`}>
                {entry.status}
              </span>
            </div>
          ))
        )}
      </section>

      {plan.recommendationHistory.length > 0 && (
        <section className="attribution-strategy-section" style={{ marginTop: 16 }}>
          <h4>Recommendation Timeline</h4>
          <div className="attribution-history-timeline">
            {plan.recommendationHistory.map((entry) => (
              <div key={`${entry.isoDate}-${entry.title}`} className="attribution-history-row">
                <span className="attribution-history-date">{entry.date}</span>
                <span className="attribution-history-title">{entry.title}</span>
                <span className="attribution-history-status">{entry.status}</span>
                {entry.verificationStatus && (
                  <VerificationBadge status={entry.verificationStatus} />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="attribution-strategy-actions">
        <h4 style={{ margin: "0 0 12px", fontSize: "0.95rem" }}>
          Recommended Actions (prioritized by ROI score)
        </h4>
        {plan.actions.map((action) => (
          <div
            key={action.id}
            className={`attribution-strategy-action ${action.isLastResort ? "last-resort" : ""}`}
          >
            <div className="attribution-strategy-action-main">
              <div className="attribution-strategy-action-title">
                <span className="attribution-strategy-rank">{action.rank}.</span>
                <strong>{action.title}</strong>
                {action.priorityScore != null && (
                  <span className="muted" style={{ fontSize: "0.75rem" }}>
                    Priority {action.priorityScore}
                  </span>
                )}
              </div>
              {action.rankExplanation && (
                <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.8rem" }}>
                  {action.rankExplanation}
                </p>
              )}
              <p className="attribution-strategy-description">{action.description}</p>
              <p className="attribution-strategy-reason muted">
                <strong>Reason:</strong> {action.reason}
              </p>

              {action.opportunityCost.items.length > 0 && (
                <div className="attribution-opportunity-cost">
                  <strong style={{ fontSize: "0.82rem" }}>Opportunity Cost</strong>
                  <p className="muted" style={{ margin: "4px 0", fontSize: "0.8rem" }}>
                    {action.opportunityCost.summary}
                  </p>
                  <ul>
                    {action.opportunityCost.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {action.workflowSteps.length > 1 && (
                <div className="attribution-action-workflow">
                  <span className="muted" style={{ fontSize: "0.75rem" }}>
                    Execution sequence
                  </span>
                  <div className="attribution-workflow-chain compact">
                    {action.workflowSteps.map((step, idx) => (
                      <div key={step.step} className="attribution-workflow-step">
                        {idx > 0 && <span className="attribution-cross-module-arrow">↓</span>}
                        <span>
                          Step {step.step}: {step.label}
                          {step.waitDays != null ? ` (${step.waitDays}d)` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="attribution-cross-module">
                <span className="muted" style={{ fontSize: "0.75rem" }}>
                  Cross-module impact
                </span>
                <div className="attribution-cross-module-chain">
                  {action.crossModuleImpacts.map((link, idx) => (
                    <div key={link.module} className="attribution-cross-module-item">
                      {idx > 0 && <span className="attribution-cross-module-arrow">↓</span>}
                      <div>
                        <strong>{link.module}</strong>
                        {link.severity === "critical" && (
                          <span className="attribution-inventory-critical"> Critical Risk</span>
                        )}
                        <div>{link.headline}</div>
                        <div className="muted" style={{ fontSize: "0.78rem" }}>
                          {link.detail}
                        </div>
                        <VerificationBadge status={link.verificationStatus} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="attribution-strategy-metrics">
              <div>
                <span className="muted" style={{ fontSize: "0.75rem" }}>
                  Expected improvement
                </span>
                <strong className="positive">
                  +{formatMoney(action.impact.estimatedMonthlyImprovement)}
                </strong>
                <VerificationBadge status={action.impact.simulationStatus} />
              </div>
              {action.impact.observedMonthlyImprovement != null && (
                <div>
                  <span className="muted" style={{ fontSize: "0.75rem" }}>
                    Observed improvement
                  </span>
                  <strong className="positive">
                    +{formatMoney(action.impact.observedMonthlyImprovement)}
                  </strong>
                  {action.impact.observedStatus && (
                    <VerificationBadge status={action.impact.observedStatus} />
                  )}
                </div>
              )}
              <div>
                <span className="muted" style={{ fontSize: "0.75rem" }}>
                  Confidence
                </span>
                <strong>{action.confidencePct}%</strong>
              </div>
              <div>
                <span className="muted" style={{ fontSize: "0.75rem" }}>
                  Risk
                </span>
                <strong className={riskClass(action.riskLevel)}>{action.riskLevel}</strong>
              </div>
              <div>
                <span className="muted" style={{ fontSize: "0.75rem" }}>
                  Revenue impact
                </span>
                <strong>
                  {action.expectedRevenueImpactPct >= 0 ? "+" : ""}
                  {action.expectedRevenueImpactPct}%
                </strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
