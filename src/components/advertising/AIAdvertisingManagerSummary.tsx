import Link from "next/link";
import type { AiManagerSummary } from "@/lib/advertising/types";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function AIAdvertisingManagerSummary({ summary }: { summary: AiManagerSummary }) {
  return (
    <div className="card adv-ai-manager-hero">
      <div className="adv-ai-manager-hero-header">
        <div>
          <span className="muted adv-ai-manager-label">Your advertising expert</span>
          <h2 style={{ margin: "4px 0 0" }}>{summary.headline}</h2>
        </div>
        <span className="adv-ai-confidence-pill">{summary.confidencePct}% confidence</span>
      </div>

      <p className="adv-ai-manager-intro">{summary.intro}</p>

      {summary.insights.length > 0 && (
        <div className="adv-ai-manager-findings">
          <span className="muted" style={{ fontSize: "0.85rem" }}>We found:</span>
          <ul className="adv-ai-manager-findings-list">
            {summary.insights.map((i) => (
              <li key={i.label}>
                <strong>{i.count}</strong> {i.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="adv-ai-manager-narrative" style={{ whiteSpace: "pre-line" }}>{summary.narrative}</p>

      <div className="adv-ai-manager-impact">
        <span className="muted">Estimated monthly profit improvement</span>
        <strong className="positive adv-ai-manager-impact-value">
          +{fmt(summary.expectedMonthlyProfitImprovement)}
        </strong>
      </div>

      <div className="adv-ai-manager-actions">
        <Link href="#optimization" className="btn btn-primary">
          Review AI Actions
        </Link>
        <Link href="#optimization" className="btn btn-ghost">
          Run Simulation
        </Link>
      </div>
    </div>
  );
}
