import type { WatchlistItem } from "@/lib/live/mission-control-types";

const STATUS_CLASS: Record<WatchlistItem["status"], string> = {
  watching: "watch-watching",
  alert: "watch-alert",
  healthy: "watch-healthy",
  waiting: "watch-waiting",
};

export function AiMonitoringWatchlist({ items }: { items: WatchlistItem[] }) {
  return (
    <section className="card live-watchlist">
      <h3>AI Monitoring</h3>
      <p className="muted" style={{ margin: "4px 0 12px", fontSize: "0.85rem" }}>
        What StorePilot is continuously watching right now
      </p>
      <ul className="live-watchlist-list">
        {items.map((item) => (
          <li key={item.id} className={`live-watchlist-item ${STATUS_CLASS[item.status]}`}>
            <span className="live-watchlist-label">{item.label}</span>
            <span className="live-watchlist-status">{item.statusLabel}</span>
            {item.detail && <span className="muted live-watchlist-detail">{item.detail}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
