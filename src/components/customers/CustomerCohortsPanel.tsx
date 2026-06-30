import type { CustomerSnapshot, CustomerCohortPreview } from "@/lib/customers/types";

type CohortRow = NonNullable<CustomerSnapshot["cohortRetention"]>[number];

export function CustomerCohortsPanel({
  available,
  cohortPreview,
  cohorts,
}: {
  available: boolean;
  cohortPreview: CustomerCohortPreview;
  cohorts: CustomerSnapshot["cohortRetention"];
}) {
  if (!available || !cohorts?.length) {
    return (
      <div className="card customers-cohorts-panel unavailable">
        <h3 style={{ margin: "0 0 12px" }}>Cohort Analysis</h3>
        <div className="customers-cohort-preview">
          <div>
            <span className="muted">Status</span>
            <strong>Waiting for additional history</strong>
          </div>
          <div>
            <span className="muted">Current history</span>
            <strong>{cohortPreview.currentHistoryDays} days</strong>
          </div>
          <div>
            <span className="muted">Required</span>
            <strong>{cohortPreview.requiredHistoryDays} days</strong>
          </div>
        </div>
        <p className="muted" style={{ margin: "12px 0 0", lineHeight: 1.5 }}>
          {cohortPreview.message}
        </p>
      </div>
    );
  }

  return (
    <div className="card customers-cohorts-panel">
      <h3 style={{ margin: "0 0 12px" }}>Customer Cohorts</h3>
      <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.875rem" }}>
        Monthly cohort retention — verified from purchase history.
      </p>
      <div className="customers-cohorts-table-wrap">
        <table className="customers-cohorts-table">
          <thead>
            <tr>
              <th>Cohort</th>
              <th>Size</th>
              <th>30 Days</th>
              <th>60 Days</th>
              <th>90 Days</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((row: CohortRow) => (
              <tr key={row.month}>
                <td><strong>{row.month}</strong></td>
                <td>{row.cohortSize}</td>
                <td>{row.retention30d > 0 ? `${row.retention30d}%` : "—"}</td>
                <td>{row.retention60d > 0 ? `${row.retention60d}%` : "—"}</td>
                <td>{row.retention90d > 0 ? `${row.retention90d}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
