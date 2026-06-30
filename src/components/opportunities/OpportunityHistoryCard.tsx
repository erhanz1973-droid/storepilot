import type { OpportunityHistorySummary } from "@/lib/opportunities/history";

export function OpportunityHistoryCard({
  summary,
}: {
  summary: OpportunityHistorySummary;
}) {
  return (
    <div className="card">
      <h3>Opportunity History</h3>
      <p className="muted" style={{ marginTop: 4, marginBottom: 12, fontSize: "0.875rem" }}>
        Recommendation lifecycle tracking — {summary.actionRate}% action rate
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
          gap: 8,
        }}
      >
        {(
          [
            ["Detected", summary.detected],
            ["Viewed", summary.viewed],
            ["Ignored", summary.ignored],
            ["Resolved", summary.resolved],
            ["Expired", summary.expired],
          ] as const
        ).map(([label, count]) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{count}</div>
            <div className="muted" style={{ fontSize: "0.75rem" }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
