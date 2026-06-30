import Link from "next/link";
import type { TodaysAiFocus } from "@/lib/live/mission-control-types";

function fmt(n: number): string {
  return `+${n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`;
}

export function TodaysAiFocusCard({ focus }: { focus: TodaysAiFocus }) {
  return (
    <section className="card live-ai-focus">
      <p className="live-mission-eyebrow">Today&apos;s AI Focus</p>
      <h3>{focus.headline}</h3>
      <dl className="live-ai-focus-metrics">
        <div>
          <dt>Expected Monthly Improvement</dt>
          <dd className="live-metric-positive">{fmt(focus.expectedMonthlyImprovement)}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{focus.confidencePct}%</dd>
        </div>
      </dl>
      <p className="live-ai-focus-rec">
        <span className="muted">Primary Recommendation</span>
        <br />
        <strong>{focus.primaryRecommendation}</strong>
      </p>
      <div className="actions-row" style={{ marginTop: 12 }}>
        <Link href={focus.simulationHref} className="btn btn-ghost">
          Run Simulation
        </Link>
        <Link href={focus.decisionHref} className="btn btn-primary">
          View Decision
        </Link>
      </div>
    </section>
  );
}
