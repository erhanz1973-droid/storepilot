"use client";

import type { ProfitDisplay } from "@/lib/analytics/marketing-manager";

export function ProfitValue({ meta }: { meta: ProfitDisplay }) {
  if (meta.status === "unavailable") {
    return (
      <div className="mkt-profit-cell">
        <span className="mkt-profit-unavailable">Not Available</span>
        {meta.missingReasons.length > 0 && (
          <span className="muted mkt-profit-hint">{meta.missingReasons.slice(0, 2).join(" · ")}</span>
        )}
        <span className="muted mkt-profit-conf">{meta.confidencePct}% confidence</span>
      </div>
    );
  }

  return (
    <div className="mkt-profit-cell">
      <strong className={meta.value != null && meta.value < 0 ? "negative" : ""}>
        {meta.value != null ? `$${Math.round(meta.value).toLocaleString()}` : "—"}
      </strong>
      <span className={`mkt-profit-badge mkt-profit-${meta.status}`}>
        {meta.status === "verified" ? "Verified" : "Estimated"}
      </span>
      {meta.status === "estimated" && (
        <span className="muted mkt-profit-conf">{meta.confidencePct}% confidence</span>
      )}
    </div>
  );
}
