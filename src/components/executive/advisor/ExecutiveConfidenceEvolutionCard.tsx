import type { ConfidenceEvolution } from "@/lib/analytics/executive-ai-behavior";
import { EXEC_METRIC_ICONS, MetricLabel } from "./executive-metric-icons";

export function ExecutiveConfidenceEvolutionCard({
  evolution,
}: {
  evolution: ConfidenceEvolution;
}) {
  const up = evolution.deltaPct >= 0;

  return (
    <section className="exec-advisor-confidence-evolution card">
      <h2 className="exec-advisor-section-title">Confidence Evolution</h2>
      <div className="exec-confidence-evolution-metrics">
        <div>
          <MetricLabel icon={EXEC_METRIC_ICONS.confidence} className="muted">
            Confidence
          </MetricLabel>
          <strong className="exec-confidence-current">{evolution.currentPct}%</strong>
        </div>
        <div>
          <span className="muted">Yesterday</span>
          <strong>{evolution.previousPct}%</strong>
        </div>
        <div>
          <span className="muted">Change</span>
          <strong className={up ? "positive" : "negative"}>
            {up ? "+" : ""}
            {evolution.deltaPct}%
          </strong>
        </div>
      </div>
      <p className="exec-confidence-reason">
        <strong>Reason:</strong> {evolution.reason}
      </p>
    </section>
  );
}
