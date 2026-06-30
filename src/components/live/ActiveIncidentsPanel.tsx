import type { ActiveIncident } from "@/lib/live/mission-control-types";

export function ActiveIncidentsPanel({ incidents }: { incidents: ActiveIncident[] }) {
  if (incidents.length === 0) return null;

  return (
    <section className="card live-incidents">
      <h3>Current Incidents</h3>
      <ul className="live-incidents-list">
        {incidents.map((inc) => (
          <li key={inc.id} className={`live-incident live-incident-${inc.priority}`}>
            <div className="live-incident-header">
              <strong>
                {inc.emoji} {inc.title}
              </strong>
              <span className="live-incident-status">{inc.statusLabel}</span>
            </div>
            <div className="live-incident-metric">
              <span className="muted">{inc.metricLabel}</span>
              <strong>{inc.metricValue}</strong>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
