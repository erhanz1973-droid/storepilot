import { FunnelConfidenceBadge } from "@/components/funnel/FunnelConfidenceBadge";
import type { FunnelAvailableMetric, FunnelTrafficSource } from "@/lib/funnel/types";

export function FunnelConversionSnapshot({
  metrics,
  trafficSources,
  dataTierLabel,
}: {
  metrics: FunnelAvailableMetric[];
  trafficSources: FunnelTrafficSource[];
  dataTierLabel: string;
}) {
  return (
    <div className="card funnel-conversion-snapshot">
      <div className="funnel-snapshot-header">
        <div>
          <h3 style={{ margin: 0 }}>Conversion Snapshot</h3>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.875rem" }}>
            {dataTierLabel} — metrics driving today&apos;s optimization priorities.
          </p>
        </div>
      </div>
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
            Channel mix &amp; conversion
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
                {src.conversionPct != null && (
                  <span className="funnel-traffic-cvr">{src.conversionPct.toFixed(2)}% CVR</span>
                )}
                <FunnelConfidenceBadge status={src.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
