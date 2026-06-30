import type { FunnelAiInsight } from "@/lib/funnel/types";

function toneClass(tone: FunnelAiInsight["tone"]): string {
  switch (tone) {
    case "positive":
      return "funnel-insight-positive";
    case "warning":
      return "funnel-insight-warning";
    default:
      return "";
  }
}

export function FunnelInsightsPanel({ insights }: { insights: FunnelAiInsight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="card funnel-insights-panel">
      <h3 style={{ margin: "0 0 12px" }}>AI Insights</h3>
      <ul className="funnel-insight-list">
        {insights.map((insight) => (
          <li key={insight.id} className={`funnel-insight-item ${toneClass(insight.tone)}`}>
            {insight.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
