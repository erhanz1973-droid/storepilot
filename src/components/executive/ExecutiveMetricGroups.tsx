import type { MetricCard } from "@/lib/analytics/types";
import { ProfitConfidenceBadge } from "@/components/profit/ProfitConfidenceBadge";

function changeClass(pct: number | null | undefined): string {
  if (pct == null) return "";
  if (pct > 0) return "metric-change-up";
  if (pct < 0) return "metric-change-down";
  return "";
}

function formatChange(pct: number | null | undefined): string {
  if (pct == null) return "";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}% vs prior`;
}

function MetricCardView({ metric }: { metric: MetricCard }) {
  return (
    <div
      className={`analytics-metric-card ${metric.emphasize ? "analytics-metric-hero" : ""} ${metric.tone ? `tone-${metric.tone}` : ""}`}
    >
      <p className="analytics-metric-label">{metric.label}</p>
      <p className="analytics-metric-value">{metric.value}</p>
      {metric.profitConfidence && (
        <ProfitConfidenceBadge
          confidence={{
            ...metric.profitConfidence,
            setupRequired: metric.profitConfidence.setupRequired ?? false,
          }}
          compact
          showSetupLink={metric.profitConfidence.setupRequired ?? false}
        />
      )}
      {metric.sublabel && <p className="analytics-metric-sublabel">{metric.sublabel}</p>}
      {metric.changePct != null && (
        <p className={`analytics-metric-change ${changeClass(metric.changePct)}`}>
          {formatChange(metric.changePct)}
        </p>
      )}
    </div>
  );
}

type Props = {
  businessKpis: MetricCard[];
  storeKpis: MetricCard[];
};

export function ExecutiveMetricGroups({ businessKpis, storeKpis }: Props) {
  return (
    <div className="exec-metric-groups">
      <div className="exec-metric-group">
        <h3 className="exec-metric-group-title">Business KPIs</h3>
        <div className="analytics-metric-grid exec-metric-grid">
          {businessKpis.map((m) => (
            <MetricCardView key={m.id} metric={m} />
          ))}
        </div>
      </div>
      <div className="exec-metric-group">
        <h3 className="exec-metric-group-title">Store KPIs</h3>
        <div className="analytics-metric-grid exec-metric-grid">
          {storeKpis.map((m) => (
            <MetricCardView key={m.id} metric={m} />
          ))}
        </div>
      </div>
    </div>
  );
}
