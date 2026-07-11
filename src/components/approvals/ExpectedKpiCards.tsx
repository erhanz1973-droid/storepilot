import type { ExpectedKpi } from "@/lib/approvals/decision-center-types";
import { MetricInfo } from "./MetricInfo";

export function ExpectedKpiCards({ kpis }: { kpis: ExpectedKpi[] }) {
  return (
    <section className="decision-kpi-section">
      <h5>After Approval</h5>
      <div className="decision-kpi-grid">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className={`decision-kpi-card ${kpi.positive ? "is-positive" : ""}`}
          >
            <span className="decision-kpi-label">
              {kpi.label}
              {kpi.metricKey && <MetricInfo metricKey={kpi.metricKey} />}
            </span>
            <strong className={kpi.positive ? "decision-exec-positive" : undefined}>
              {kpi.value}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}
