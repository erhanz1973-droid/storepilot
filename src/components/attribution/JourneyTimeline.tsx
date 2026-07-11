import type { CustomerJourney } from "@/lib/attribution/models";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const days = Math.round((hours / 24) * 10) / 10;
  return `${days}d`;
}

export function JourneyTimeline({ journeys }: { journeys: CustomerJourney[] }) {
  if (journeys.length === 0) {
    return (
      <div className="card">
        <h3>Customer Journeys</h3>
        <p className="muted" style={{ margin: 0 }}>No journey data yet.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Multi-touch Journey Samples</h3>
      <p className="muted" style={{ marginTop: 4, marginBottom: 16, fontSize: "0.875rem" }}>
        Reconstructed paths from touchpoint data before purchase
      </p>
      <div className="journey-list">
        {journeys.slice(0, 5).map((j) => (
          <div key={j.orderId} className="journey-card">
            <div className="journey-header">
              <strong>${j.orderValue.toLocaleString()}</strong>
              <span className="muted">
                {j.customerType} customer · {j.journeyLengthDays}d journey
              </span>
            </div>
            <dl className="journey-metrics-grid">
              <div>
                <dt>Revenue</dt>
                <dd>${j.orderValue.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Journey Length</dt>
                <dd>{j.journeyLengthDays} days</dd>
              </div>
              <div>
                <dt>Touchpoints</dt>
                <dd>{j.touchpointCount}</dd>
              </div>
              <div>
                <dt>Time to Conversion</dt>
                <dd>{formatDuration(j.timeToConversionHours)}</dd>
              </div>
              <div>
                <dt>Contribution</dt>
                <dd>{j.revenueContributionPct}%</dd>
              </div>
              <div>
                <dt>Customer Type</dt>
                <dd>{j.customerType}</dd>
              </div>
            </dl>
            <div className="journey-path-chain">
              {j.touchpoints.map((tp, idx) => (
                <span key={tp.id} className="journey-path-step">
                  {idx > 0 && <span className="attribution-cross-module-arrow">↓</span>}
                  <span className="journey-source">{tp.source || tp.channelLabel}</span>
                </span>
              ))}
            </div>
            <ol className="journey-touchpoints">
              {j.touchpoints.map((tp) => (
                <li key={tp.id}>
                  <div className="journey-tp-main">
                    <span className="journey-source">{tp.source || tp.channelLabel}</span>
                    {tp.campaign && <span className="journey-campaign">{tp.campaign}</span>}
                  </div>
                  <div className="journey-tp-meta muted">
                    {formatTime(tp.timestamp)} · {tp.device} · {tp.landingPage}
                    {tp.sessionDurationSec > 0 && ` · ${Math.round(tp.sessionDurationSec / 60)}m session`}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
