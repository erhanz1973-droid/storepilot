import { getActionCapability } from "@/lib/insights/actions";
import { RevenueImpactPanel } from "@/components/impact/RevenueImpactPanel";
import type { CommerceOpportunity } from "@/lib/insights/opportunity-schema";

const SEVERITY_BADGE: Record<CommerceOpportunity["severity"], string> = {
  critical: "badge-critical",
  high: "badge-high",
  medium: "badge-medium",
  low: "badge-low",
};

const SOURCE_LABEL: Record<CommerceOpportunity["source"], string> = {
  shopify: "Shopify",
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  ga4: "GA4",
  klaviyo: "Klaviyo",
  merchant_center: "Merchant Center",
};

export function OpportunityFeedCard({
  opportunity,
  compact,
}: {
  opportunity: CommerceOpportunity;
  compact?: boolean;
}) {
  const action = opportunity.futureAction
    ? getActionCapability(opportunity.futureAction)
    : undefined;

  return (
    <article
      className="insight-card"
      style={{
        padding: compact ? "12px 0" : "16px",
        borderBottom: compact ? "1px solid var(--border)" : undefined,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <span className={`badge ${SEVERITY_BADGE[opportunity.severity]}`}>
              {opportunity.severity}
            </span>
            <span className="badge badge-medium" style={{ opacity: 0.85 }}>
              {SOURCE_LABEL[opportunity.source]}
            </span>
          </div>
          <h4 style={{ margin: "0 0 6px", fontSize: compact ? "0.95rem" : "1rem" }}>
            {opportunity.title}
          </h4>
          <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.9rem" }}>
            {opportunity.description}
          </p>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>
            <strong>Recommendation:</strong> {opportunity.recommendation}
          </p>
          {(opportunity.expectedImpact.revenueMonthly > 0 ||
            opportunity.expectedImpact.profitMonthly > 0) && (
            <RevenueImpactPanel
              impact={{
                monthlyRevenue: opportunity.expectedImpact.revenueMonthly,
                monthlyProfit: opportunity.expectedImpact.profitMonthly,
                confidencePct: opportunity.confidence,
                label: opportunity.expectedImpact.label,
              }}
            />
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{opportunity.confidence}%</div>
          <div className="muted" style={{ fontSize: "0.75rem" }}>
            confidence
          </div>
          <div className="muted" style={{ fontSize: "0.7rem", marginTop: 4 }}>
            score {opportunity.priorityScore}
          </div>
        </div>
      </div>

      {!compact && opportunity.why.length > 0 && (
        <div className="insight-why-panel" style={{ marginTop: 12 }}>
          <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: "0.9rem" }}>Why?</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.875rem" }}>
            {opportunity.why.map((w) => (
              <li key={w.label} style={{ marginBottom: 4 }}>
                <strong>{w.label}:</strong> {w.value}
                {w.trend === "up" ? " ↑" : w.trend === "down" ? " ↓" : ""}
              </li>
            ))}
            <li>
              <strong>Confidence:</strong> {opportunity.confidence}%
            </li>
          </ul>
        </div>
      )}

      {action && (
        <p className="muted" style={{ margin: "10px 0 0", fontSize: "0.8rem" }}>
          Action-ready: {action.label}
          {!action.available && " (execution coming soon)"}
        </p>
      )}
    </article>
  );
}

export function OpportunityFeed({
  opportunities,
  limit = 8,
}: {
  opportunities: CommerceOpportunity[];
  limit?: number;
}) {
  if (opportunities.length === 0) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        No optimization opportunities detected yet. Connect more data sources for richer insights.
      </p>
    );
  }

  return (
    <div className="stack">
      {opportunities.slice(0, limit).map((opp) => (
        <OpportunityFeedCard key={opp.id} opportunity={opp} />
      ))}
    </div>
  );
}
