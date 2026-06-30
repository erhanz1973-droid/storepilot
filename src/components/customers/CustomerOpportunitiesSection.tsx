import type { CustomerOpportunity } from "@/lib/customers/types";

function formatImpact(opp: CustomerOpportunity): string {
  const prefix = opp.impactLabel.includes("retention") ? "+" : "+";
  const suffix = opp.impactLabel.includes("retention") ? "%" : "";
  const value =
    opp.impactLabel.includes("retention")
      ? opp.estimatedImpact
      : opp.estimatedImpact.toLocaleString(undefined, {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        });
  return `${prefix}${value}${suffix}`;
}

export function CustomerOpportunitiesSection({
  opportunities,
  allHealthy,
}: {
  opportunities: CustomerOpportunity[];
  allHealthy: boolean;
}) {
  if (allHealthy) {
    return (
      <div className="card customers-opportunities healthy">
        <h3 style={{ margin: "0 0 8px" }}>Customer Health</h3>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          Your customer base is healthy. StorePilot will alert you when retention or acquisition
          opportunities appear.
        </p>
      </div>
    );
  }

  if (opportunities.length === 0) return null;

  return (
    <div className="card customers-opportunities">
      <h3 style={{ margin: "0 0 4px" }}>Customer Opportunities</h3>
      <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.875rem" }}>
        AI-identified actions to improve retention and lifetime value.
      </p>
      <div className="customers-opportunity-list">
        {opportunities.map((opp) => (
          <div key={opp.id} className="customers-opportunity-item">
            <div>
              <strong>{opp.title}</strong>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
                {opp.description}
              </p>
            </div>
            <div className="customers-opportunity-impact">
              <span className="muted" style={{ fontSize: "0.75rem" }}>{opp.impactLabel}</span>
              <strong className="positive">{formatImpact(opp)}</strong>
              <span className="muted" style={{ fontSize: "0.75rem" }}>
                {opp.confidencePct}% confidence
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
