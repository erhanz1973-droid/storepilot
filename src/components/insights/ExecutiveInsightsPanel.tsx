"use client";

import Link from "next/link";
import type { UnifiedExecutiveBrief } from "@/lib/insights/unified-executive-brief";
import { PlanScaleBanner } from "@/components/billing/PlanScaleBanner";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function healthEmoji(indicator: UnifiedExecutiveBrief["businessHealth"]["indicator"]): string {
  if (indicator === "green") return "🟢";
  if (indicator === "red") return "🔴";
  return "🟡";
}

function priorityClass(priority: string): string {
  if (priority === "critical") return "exec-rec-critical";
  if (priority === "high") return "exec-rec-high";
  return "exec-rec-medium";
}

export function ExecutiveInsightsPanel({ brief }: { brief: UnifiedExecutiveBrief }) {
  const hasOpportunities = brief.opportunityCount > 0;

  return (
    <div className="exec-insights-panel">
      {brief.planUsage && (
        <PlanScaleBanner
          entitlements={brief.planUsage}
          unlockedCampaignName={brief.planUsage.unlockedCampaignName}
        />
      )}

      <div className="card exec-recovery-hero exec-ai-brief">
        <p className="muted exec-recovery-eyebrow">AI Executive Brief</p>

        <div className="exec-ai-brief-top">
          <div>
            <span className="muted" style={{ fontSize: "0.78rem" }}>
              Business Health
            </span>
            <p style={{ margin: "4px 0 0", fontWeight: 600 }}>
              {healthEmoji(brief.businessHealth.indicator)} {brief.businessHealth.label}
            </p>
            <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.85rem" }}>
              {brief.businessHealth.message}
            </p>
          </div>
          <div>
            <span className="muted" style={{ fontSize: "0.78rem" }}>
              Overall Confidence
            </span>
            <p style={{ margin: "4px 0 0", fontWeight: 600 }}>
              {brief.overallConfidencePct}%
            </p>
          </div>
        </div>

        {hasOpportunities ? (
          <>
            {(brief.visibleOpportunityCount ?? brief.opportunityCount) > 0 && (
              <p className="muted" style={{ margin: "12px 0 0", fontSize: "0.85rem" }}>
                <strong>Today&apos;s Recommendations</strong> —{" "}
                {brief.visibleOpportunityCount ?? brief.opportunityCount} available
                {(brief.lockedOpportunityCount ?? 0) > 0 && brief.planUsage && (
                  <span>
                    {" "}
                    · {brief.lockedOpportunityCount} additional recommendation
                    {brief.lockedOpportunityCount === 1 ? "" : "s"} available in{" "}
                    {brief.planUsage.upgradePlanLabel}.
                  </span>
                )}
              </p>
            )}
            <div className="exec-ai-brief-priority" style={{ marginTop: 16 }}>
              <span className="muted" style={{ fontSize: "0.78rem" }}>
                Highest Priority
              </span>
              <p style={{ margin: "6px 0 0", fontWeight: 600, fontSize: "1.05rem" }}>
                {brief.highestPriority?.title}
              </p>
              <p className="positive" style={{ margin: "6px 0 0" }}>
                Estimated Monthly Improvement{" "}
                <strong>
                  +{formatMoney(brief.highestPriority?.estimatedMonthlyImpact ?? 0)}
                </strong>
              </p>
              {brief.highestPriority?.reason && (
                <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>
                  <strong>Reason:</strong> {brief.highestPriority.reason}
                </p>
              )}
              {brief.highestPriority && (
                <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.8rem" }}>
                  Source:{" "}
                  <Link href={brief.highestPriority.moduleHref}>
                    {brief.highestPriority.moduleLabel}
                  </Link>
                  {" · "}
                  Risk priority: {brief.highestPriority.priority}
                </p>
              )}
            </div>

            <div className="exec-recovery-grid" style={{ marginTop: 16 }}>
              <div>
                <p className="exec-recovery-stat-label">Active Opportunities</p>
                <p className="exec-recovery-stat-value">{brief.opportunityCount}</p>
              </div>
              <div>
                <p className="exec-recovery-stat-label">Estimated monthly recovery</p>
                <p className="exec-recovery-stat-value positive">
                  +{formatMoney(brief.estimatedMonthlyRecovery)}
                </p>
              </div>
              <div>
                <p className="exec-recovery-stat-label">By priority</p>
                <p className="exec-recovery-stat-value" style={{ fontSize: "0.95rem" }}>
                  {brief.byPriority.critical > 0 && (
                    <span>Critical {brief.byPriority.critical} </span>
                  )}
                  {brief.byPriority.high > 0 && <span>High {brief.byPriority.high} </span>}
                  {brief.byPriority.medium > 0 && (
                    <span>Medium {brief.byPriority.medium}</span>
                  )}
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="muted" style={{ margin: "16px 0 0" }}>
            {brief.businessHealth.status === "healthy"
              ? "No active recommendations across connected modules."
              : "Connect Shopify and ad platforms to generate cross-module recommendations."}
          </p>
        )}
      </div>

      {brief.otherOpportunities.length > 0 && (
        <section className="exec-insights-section">
          <div className="exec-section-header">
            <h3>Other Opportunities</h3>
            <p className="muted">Aggregated from Profit, Attribution, Marketing, Products, Customers, and Inventory</p>
          </div>
          <div className="exec-rec-list">
            {brief.otherOpportunities.map((action) => (
              <article
                key={action.id}
                className={`card exec-recommendation-card exec-rec-compact ${priorityClass(action.priority)}`}
              >
                <div className="exec-rec-header">
                  <div>
                    <strong>{action.title}</strong>
                    <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.82rem" }}>
                      {action.reason}
                    </p>
                  </div>
                  <span className={`exec-priority-pill ${priorityClass(action.priority)}`}>
                    {action.priority}
                  </span>
                </div>
                <div className="exec-rec-impact-row">
                  <span>
                    Expected Impact{" "}
                    <strong className="positive">
                      +{formatMoney(action.estimatedMonthlyImpact)}
                    </strong>
                  </span>
                  <span className="muted">
                    <Link href={action.moduleHref}>{action.moduleLabel}</Link>
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {brief.completed.length > 0 && (
        <section className="exec-insights-section">
          <div className="exec-section-header">
            <h3>Recently completed</h3>
            <Link href="/decisions">Open Decisions →</Link>
          </div>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            {brief.completed.length} recommendation(s) marked complete in the decision center.
          </p>
        </section>
      )}
    </div>
  );
}
