import Link from "next/link";
import type { AccountWideSummary } from "@/lib/advertising/types";
import type { CampaignEntitlements } from "@/lib/billing/types";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function AccountWideSummaryCard({
  summary,
  planUsage: _planUsage,
  scopeNotice,
}: {
  summary: AccountWideSummary;
  planUsage?: CampaignEntitlements;
  scopeNotice?: string;
}) {
  return (
    <div className="card adv-account-summary">
      <h2 style={{ marginTop: 0 }}>{summary.headline}</h2>
      {scopeNotice && (
        <p className="adv-scope-notice">{scopeNotice}</p>
      )}

      <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.9rem" }}>Current account status:</p>
      <dl className="adv-account-status-grid">
        <div><dt>Healthy</dt><dd>{summary.healthy}</dd></div>
        <div><dt>Need Attention</dt><dd>{summary.needAttention}</dd></div>
        <div><dt>Critical</dt><dd className={summary.critical > 0 ? "negative" : ""}>{summary.critical}</dd></div>
        <div><dt>Improving</dt><dd className="positive">{summary.improving}</dd></div>
      </dl>

      <div className="adv-account-highlights">
        {summary.largestOpportunity && (
          <p style={{ margin: "8px 0" }}>
            <strong>Largest opportunity:</strong>{" "}
            <Link href={`/advertising/campaigns/${summary.largestOpportunity.id}`}>
              {summary.largestOpportunity.name}
            </Link>
            {summary.largestOpportunity.impactMonthly > 0 && (
              <span className="muted"> — up to {fmt(summary.largestOpportunity.impactMonthly)}/mo</span>
            )}
          </p>
        )}
        {summary.largestRisk && (
          <p style={{ margin: "8px 0" }}>
            <strong>Largest risk:</strong>{" "}
            <Link href={`/advertising/campaigns/${summary.largestRisk.id}`}>
              {summary.largestRisk.name}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
