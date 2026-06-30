import type { CustomerJourney } from "@/lib/attribution/models";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
                {j.isNewCustomer ? "New customer" : "Returning"} · {j.journeyLengthDays}d journey
              </span>
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
