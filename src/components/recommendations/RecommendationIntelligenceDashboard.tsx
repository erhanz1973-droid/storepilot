import type { IntelligenceDashboard } from "@/lib/recommendations/intelligence/types";
import { EmptyState } from "@/components/ui/EmptyState";

type Props = {
  dashboard: IntelligenceDashboard;
};

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
        {label}
      </p>
      <p style={{ margin: "8px 0 0", fontSize: "1.4rem", fontWeight: 700 }}>
        {value}
      </p>
    </div>
  );
}

export function RecommendationIntelligenceDashboard({ dashboard }: Props) {
  return (
    <div className="stack" style={{ gap: 24 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        <MetricCard label="Generated" value={dashboard.generated} />
        <MetricCard label="Approved %" value={`${dashboard.approvedPct}%`} />
        <MetricCard label="Rejected %" value={`${dashboard.rejectedPct}%`} />
        <MetricCard label="Execution Rate" value={`${dashboard.executionRatePct}%`} />
        <MetricCard label="Success Rate" value={`${dashboard.successRatePct}%`} />
        <MetricCard label="Avg Confidence" value={`${dashboard.avgConfidence}%`} />
        <MetricCard label="Avg Validation" value={`${dashboard.avgValidationScore}%`} />
        <MetricCard
          label="Revenue Generated"
          value={`$${dashboard.revenueGenerated.toLocaleString()}`}
        />
        <MetricCard
          label="Revenue Recovered"
          value={`$${dashboard.revenueRecovered.toLocaleString()}`}
        />
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Top Performing Types</h3>
          {dashboard.topPerforming.length === 0 ? (
            <p className="muted">No measured outcomes yet.</p>
          ) : (
            <div className="stack">
              {dashboard.topPerforming.map((t) => (
                <div key={String(t.category)} className="breakdown-row">
                  <span>{t.category}</span>
                  <strong>
                    {t.successRatePct}% · +{t.avgRevenueImprovementPct}% rev
                  </strong>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Needs Improvement</h3>
          {dashboard.worstPerforming.length === 0 ? (
            <EmptyState
              title="We're still learning which recommendations need improvement"
              reason="Needs-improvement patterns appear after recommendations are measured against real outcomes."
              nextStep="Approve a recommendation and let StorePilot measure results — learning compounds over time."
            />
          ) : (
            <div className="stack">
              {dashboard.worstPerforming.map((t) => (
                <div key={`w-${String(t.category)}`} className="breakdown-row">
                  <span>{t.category}</span>
                  <strong>{t.successRatePct}% success ({t.evaluatedCount} eval)</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
