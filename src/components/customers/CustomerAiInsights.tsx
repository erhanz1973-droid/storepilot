import type { CustomerAiInsight } from "@/lib/customers/types";

function toneClass(tone: CustomerAiInsight["tone"]): string {
  switch (tone) {
    case "positive":
      return "customers-insight-positive";
    case "warning":
      return "customers-insight-warning";
    default:
      return "";
  }
}

export function CustomerAiInsights({ insights }: { insights: CustomerAiInsight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="card customers-ai-insights">
      <h3 style={{ margin: "0 0 12px" }}>AI Customer Insights</h3>
      <ul className="customers-insight-list">
        {insights.map((insight) => (
          <li key={insight.id} className={`customers-insight-item ${toneClass(insight.tone)}`}>
            {insight.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
