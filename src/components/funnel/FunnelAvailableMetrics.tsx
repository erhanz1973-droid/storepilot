import { FunnelConfidenceBadge } from "@/components/funnel/FunnelConfidenceBadge";
import type { FunnelAvailableMetric, FunnelTrafficSource } from "@/lib/funnel/types";

export function FunnelAvailableMetrics({
  metrics,
  trafficSources,
}: {
  metrics: FunnelAvailableMetric[];
  trafficSources: FunnelTrafficSource[];
}) {
  return (
    <div className="card funnel-available-metrics">
      <h3 style={{ margin: "0 0 12px" }}>Available Metrics</h3>
      <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.875rem" }}>
        What StorePilot can calculate right now — without fabricating funnel data.
      </p>
      <div className="funnel-metrics-grid">
        {metrics.map((m) => (
          <div key={m.id} className="funnel-metric-item">
            <span className="muted">{m.label}</span>
            <strong>{m.value}</strong>
            <FunnelConfidenceBadge status={m.status} notice={m.notice} />
          </div>
        ))}
      </div>

      {trafficSources.length > 0 && (
        <div className="funnel-traffic-sources">
          <span className="muted" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
            Traffic Source Distribution
          </span>
          <div className="funnel-traffic-list">
            {trafficSources.map((src) => (
              <div key={src.label} className="funnel-traffic-row">
                <span>{src.label}</span>
                <div className="funnel-traffic-bar-wrap">
                  <div
                    className="funnel-traffic-bar"
                    style={{ width: `${Math.max(src.sharePct, 4)}%` }}
                  />
                </div>
                <span className="funnel-traffic-pct">{src.sharePct}%</span>
                <FunnelConfidenceBadge status={src.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
