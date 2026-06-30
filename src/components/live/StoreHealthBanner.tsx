import type { StoreHealthBanner } from "@/lib/live/mission-control-types";

function fmt(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function StoreHealthBannerCard({ health }: { health: StoreHealthBanner }) {
  return (
    <section className={`card live-health-banner live-health-${health.level}`}>
      <div className="live-health-header">
        <div>
          <p className="live-mission-eyebrow">Store Health</p>
          <h3>
            {health.emoji} {health.label}
          </h3>
          <p className="live-health-headline">{health.headline}</p>
        </div>
      </div>
      <dl className="live-health-metrics">
        <div>
          <dt>Primary Issue</dt>
          <dd>{health.primaryIssue}</dd>
        </div>
        {health.currentRoas != null && (
          <div>
            <dt>Current ROAS</dt>
            <dd>{health.currentRoas.toFixed(2)}</dd>
          </div>
        )}
        {health.breakEvenRoas != null && (
          <div>
            <dt>Break-even</dt>
            <dd>{health.breakEvenRoas.toFixed(2)}</dd>
          </div>
        )}
        {health.estimatedLossToday != null && (
          <div>
            <dt>Estimated loss today</dt>
            <dd className="live-metric-negative">{fmt(health.estimatedLossToday)}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
