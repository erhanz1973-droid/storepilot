import type { AiDailyBrief } from "@/lib/types";

export function AiBriefCard({ brief }: { brief: AiDailyBrief }) {
  return (
    <div className="card ai-brief-card">
      <h3>Today&apos;s AI Brief</h3>
      <p className="ai-brief-health">
        Profit Health: <strong>{brief.storeHealth}/100</strong>
      </p>

      {brief.criticalAlertCount > 0 && (
        <p className="muted" style={{ marginTop: 8 }}>
          {brief.criticalAlertCount} critical alert{brief.criticalAlertCount > 1 ? "s" : ""} need
          attention
        </p>
      )}

      <p className="muted" style={{ marginTop: 8 }}>
        {brief.revenueOpportunitySummary}
        {brief.estimatedRevenueOpportunity > 0 && (
          <>
            {" "}
            · Est. net profit opportunity:{" "}
            <strong>${brief.estimatedRevenueOpportunity.toLocaleString()}</strong>
          </>
        )}
      </p>

      <div style={{ marginTop: 16 }}>
        <p className="muted" style={{ marginBottom: 8, fontWeight: 500 }}>
          Top Priorities:
        </p>
        <ol className="ai-brief-list">
          {brief.topPriorities.map((p) => (
            <li key={p.rank}>
              <strong>{p.title}</strong>
              <span className="muted" style={{ display: "block", marginTop: 4 }}>
                {p.detail}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
