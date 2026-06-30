import type { CommerceDailyBrief } from "@/lib/insights/daily-brief";

export function DailyAiBriefCard({ brief }: { brief: CommerceDailyBrief }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 8px" }}>Daily AI Brief</h3>
      <p style={{ margin: "0 0 12px", fontWeight: 600, fontSize: "1rem" }}>{brief.headline}</p>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.9rem" }}>
        {brief.bullets.map((line) => (
          <li key={line} style={{ marginBottom: 6 }}>
            {line}
          </li>
        ))}
      </ul>
      {brief.opportunityCount > 0 && (
        <p className="muted" style={{ margin: "12px 0 0", fontSize: "0.85rem" }}>
          {brief.opportunityCount} opportunities · est. +$
          {brief.opportunityImpactMonthly.toLocaleString()}/mo combined impact
        </p>
      )}
    </div>
  );
}
