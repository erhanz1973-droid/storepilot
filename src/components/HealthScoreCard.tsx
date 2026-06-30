import type { StoreHealthBreakdown } from "@/lib/types";

function scoreColor(score: number): string {
  if (score >= 80) return "var(--low)";
  if (score >= 60) return "var(--medium)";
  if (score >= 40) return "var(--high)";
  return "var(--critical)";
}

export function HealthScoreCard({
  score,
  breakdown,
  showCampaigns = true,
}: {
  score: number;
  breakdown: StoreHealthBreakdown;
  showCampaigns?: boolean;
}) {
  const color = scoreColor(score);

  const rows: [string, number][] = [
    ["Inventory", breakdown.inventory],
    ["Merchandising", breakdown.merchandising],
    ...(showCampaigns ? ([["Campaigns", breakdown.campaigns]] as [string, number][]) : []),
    ["Promotions", breakdown.promotions],
  ];

  return (
    <div className="card">
      <h3>Profit Health Score</h3>
      <div className="health-score">
        <div className="health-ring" style={{ borderColor: color }}>
          {score}
        </div>
        <div style={{ flex: 1 }}>
          {rows.map(([label, value]) => (
            <div key={label} className="breakdown-row">
              <span>{label}</span>
              <span style={{ fontWeight: 600, color: scoreColor(value) }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
