import { CustomerDataBadge } from "@/components/customers/CustomerDataBadge";
import type { CustomerLtvSummary } from "@/lib/customers/types";

function formatMoney(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function RequirementRow({ met, label }: { met: boolean; label: string }) {
  return (
    <li className={met ? "met" : "unmet"}>
      {met ? "✓" : "○"} {label}
    </li>
  );
}

export function CustomerLtvPanel({ ltv }: { ltv: CustomerLtvSummary }) {
  if (ltv.status === "unavailable") {
    return (
      <div className="card customers-ltv-panel unavailable">
        <h3 style={{ margin: "0 0 8px" }}>Customer Lifetime Value</h3>
        <p style={{ margin: "0 0 12px", lineHeight: 1.5 }}>
          {ltv.unavailableReason ?? "Customer Lifetime Value cannot be calculated yet."}
        </p>
        {ltv.requirements && (
          <div className="customers-ltv-requirements">
            <span className="muted" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
              Requirements
            </span>
            <ul>
              <RequirementRow met={ltv.requirements.shopifyCustomerSync} label="Shopify customer sync" />
              <RequirementRow
                met={ltv.requirements.minHistoryDays}
                label={`Minimum ${ltv.requirements.requiredHistoryDays} days of order history (${ltv.requirements.currentHistoryDays} days synced)`}
              />
              <RequirementRow met={ltv.requirements.repeatPurchase} label="At least one repeat purchase" />
            </ul>
          </div>
        )}
        <CustomerDataBadge status="unavailable" />
      </div>
    );
  }

  const maxCount = Math.max(...ltv.distribution.map((d) => d.count), 1);

  return (
    <div className="card customers-ltv-panel">
      <div className="customers-ltv-header">
        <h3 style={{ margin: 0 }}>Customer Lifetime Value</h3>
        <CustomerDataBadge status={ltv.status} />
      </div>
      <div className="customers-ltv-stats">
        <div>
          <span className="muted">Average LTV</span>
          <strong>{formatMoney(ltv.average)}</strong>
        </div>
        <div>
          <span className="muted">Median LTV</span>
          <strong>{formatMoney(ltv.median)}</strong>
        </div>
        <div>
          <span className="muted">Highest LTV</span>
          <strong>{formatMoney(ltv.highest)}</strong>
        </div>
      </div>
      {ltv.distribution.length > 0 && (
        <div className="customers-ltv-distribution">
          <span className="muted" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
            LTV Distribution
          </span>
          {ltv.distribution.map((bucket) => (
            <div key={bucket.label} className="customers-ltv-bucket">
              <span>{bucket.label}</span>
              <div className="customers-ltv-bar-wrap">
                <div
                  className="customers-ltv-bar"
                  style={{ width: `${(bucket.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="muted">{bucket.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
