"use client";

import { MetricPills } from "@/components/MetricPills";
import { RevenueImpactPanel } from "@/components/impact/RevenueImpactPanel";
import { OpportunityInsightActions } from "@/components/opportunities/OpportunityInsightActions";
import { CATEGORY_LABELS, formatNetProfitImpact } from "@/lib/opportunities/engine";
import { estimateFromOpportunity } from "@/lib/impact/estimate";
import type { Opportunity } from "@/lib/types";

type Props = {
  opportunity: Opportunity;
  compact?: boolean;
};

const EFFORT_CLASS: Record<Opportunity["implementationEffort"], string> = {
  Low: "effort-low",
  Medium: "effort-medium",
  High: "effort-high",
};

export function OpportunityCard({ opportunity, compact = false }: Props) {
  const impact = estimateFromOpportunity(opportunity);

  return (
    <article className="card opportunity-card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <span className="category-tag">{CATEGORY_LABELS[opportunity.category]}</span>
          <h4 style={{ margin: "6px 0 0", fontSize: compact ? "0.95rem" : "1.05rem" }}>
            {opportunity.title}
          </h4>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="impact-amount">
            {formatNetProfitImpact(opportunity.estimatedMonthlyNetProfitImpact)}
            <span className="muted" style={{ fontSize: "0.75rem", display: "block" }}>
              expected net profit /mo
            </span>
          </div>
        </div>
      </div>

      {!compact && (
        <>
          {opportunity.expectedRoas != null && (
            <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.8rem" }}>
              Expected ROAS: <strong>{opportunity.expectedRoas.toFixed(2)}</strong>
            </p>
          )}
          <p className="muted" style={{ marginTop: 12, lineHeight: 1.5 }}>
            {opportunity.description}
          </p>
          <RevenueImpactPanel impact={impact} />
          <MetricPills metrics={opportunity.evidence} />
          <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
            <p className="confidence" style={{ margin: 0 }}>
              Confidence: {Math.round(opportunity.confidenceScore * 100)}%
            </p>
            <span className={`effort-badge ${EFFORT_CLASS[opportunity.implementationEffort]}`}>
              {opportunity.implementationEffort} effort
            </span>
          </div>
          <div style={{ marginTop: 12 }}>
            <strong style={{ fontSize: "0.85rem" }}>Required actions</strong>
            <ul className="action-list">
              {opportunity.requiredActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
        </>
      )}

      {compact && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 8,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <span className={`effort-badge ${EFFORT_CLASS[opportunity.implementationEffort]}`}>
            {opportunity.implementationEffort} effort
          </span>
          <span className="confidence" style={{ margin: 0 }}>
            {Math.round(opportunity.confidenceScore * 100)}% confidence
          </span>
        </div>
      )}

      <OpportunityInsightActions
        opportunityId={opportunity.id}
        recommendationId={opportunity.recommendationId}
      />
    </article>
  );
}
