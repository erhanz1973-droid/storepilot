import type { LiveAlert } from "@/lib/live/mission-control-types";

export function LiveAlertsStrip({ alerts }: { alerts: LiveAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="live-alerts-strip">
      {alerts.map((alert) => (
        <div key={alert.id} className={`live-alert live-alert-${alert.priority}`}>
          <span aria-hidden>{alert.emoji}</span>
          <span>{alert.message}</span>
        </div>
      ))}
    </div>
  );
}
