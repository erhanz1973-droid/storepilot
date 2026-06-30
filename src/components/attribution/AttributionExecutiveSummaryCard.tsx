import type { AttributionExecutiveSummary } from "@/lib/attribution/decision-engine";

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function statusEmoji(indicator: AttributionExecutiveSummary["businessStatusIndicator"]): string {
  if (indicator === "green") return "🟢";
  if (indicator === "red") return "🔴";
  return "🟡";
}

export function AttributionExecutiveSummaryCard({
  summary,
}: {
  summary: AttributionExecutiveSummary;
}) {
  return (
    <div className="card attribution-executive-summary">
      <h3 style={{ margin: "0 0 14px" }}>Executive Summary</h3>
      <div className="attribution-exec-grid">
        <div>
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            Business Status
          </span>
          <p style={{ margin: "4px 0 0", fontWeight: 600 }}>
            {statusEmoji(summary.businessStatusIndicator)} {summary.businessStatus}
          </p>
        </div>
        <div>
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            Primary Issue
          </span>
          <p style={{ margin: "4px 0 0", lineHeight: 1.45 }}>{summary.primaryIssue}</p>
        </div>
        <div>
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            Best Opportunity
          </span>
          <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{summary.bestOpportunity}</p>
        </div>
        <div>
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            Estimated Monthly Impact
          </span>
          <p style={{ margin: "4px 0 0" }} className="positive">
            <strong>+{formatMoney(summary.estimatedMonthlyImpact)}</strong>
          </p>
        </div>
        <div>
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            Risk
          </span>
          <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{summary.riskLevel}</p>
        </div>
        <div className="attribution-exec-recommendation">
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            Overall Recommendation
          </span>
          <p style={{ margin: "4px 0 0", lineHeight: 1.45 }}>{summary.overallRecommendation}</p>
        </div>
      </div>
    </div>
  );
}
