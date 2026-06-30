"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type LiveMetric = {
  label: string;
  value: string;
};

type LiveFeedItem = {
  title: string;
  detail?: string;
  at: string;
};

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function metricsFromPayload(data: {
  visitorsOnline: number | null;
  ordersToday: number;
  revenueToday: number;
  profitToday: number | null;
  spendToday: number;
  roasToday: number;
  checkouts: number | null;
}): LiveMetric[] {
  return [
    {
      label: "Visitors Online",
      value: data.visitorsOnline != null ? String(data.visitorsOnline) : "—",
    },
    { label: "Today's Orders", value: String(data.ordersToday) },
    { label: "Today's Revenue", value: fmt(data.revenueToday) },
    {
      label: "Today's Profit",
      value: data.profitToday != null ? fmt(data.profitToday) : "—",
    },
    { label: "Today's Ad Spend", value: data.spendToday > 0 ? fmt(data.spendToday) : "—" },
    { label: "Today's ROAS", value: data.roasToday > 0 ? data.roasToday.toFixed(2) : "—" },
    {
      label: "Current Checkouts",
      value: data.checkouts != null ? String(data.checkouts) : "—",
    },
  ];
}

function feedFromPayload(data: {
  aiEvents: { title: string; description: string; createdAt: string }[];
  activityFeed: { event: string; detail?: string; timestamp: string }[];
}): LiveFeedItem[] {
  return [
    ...data.aiEvents.slice(0, 8).map((e) => ({
      title: e.title,
      detail: e.description,
      at: e.createdAt,
    })),
    ...data.activityFeed.slice(0, 6).map((e) => ({
      title: e.event,
      detail: e.detail,
      at: e.timestamp,
    })),
  ];
}

export function LiveDashboardClient({
  metrics: initialMetrics,
  feed: initialFeed,
}: {
  metrics: LiveMetric[];
  feed: LiveFeedItem[];
}) {
  const router = useRouter();
  const [metrics, setMetrics] = useState(initialMetrics);
  const [feed, setFeed] = useState(initialFeed);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/live/metrics", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setMetrics(metricsFromPayload(data));
      setFeed(feedFromPayload(data));
    } catch {
      /* keep last good state */
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <>
      <p className="analytics-live-badge">
        Live · refreshes every 30s
        <button
          type="button"
          className="analytics-live-refresh-btn"
          onClick={() => {
            void refresh();
            router.refresh();
          }}
        >
          Refresh now
        </button>
      </p>
      <div className="analytics-metric-grid">
        {metrics.map((m) => (
          <div key={m.label} className="analytics-metric-card tone-default">
            <p className="analytics-metric-label">{m.label}</p>
            <p className="analytics-metric-value">{m.value}</p>
          </div>
        ))}
      </div>
      <div className="analytics-live-grid">
        <div className="card">
          <h3>Live Events</h3>
          <ul className="analytics-live-feed">
            {feed.length === 0 ? (
              <li className="muted">Waiting for activity…</li>
            ) : (
              feed.map((e, i) => (
                <li key={`${e.title}-${i}`}>
                  <strong>{e.title}</strong>
                  {e.detail && <span className="muted"> — {e.detail}</span>}
                  <time className="muted">{new Date(e.at).toLocaleTimeString()}</time>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="card analytics-live-map">
          <h3>Visitor Activity</h3>
          <p className="muted" style={{ margin: 0 }}>
            Live visitor map requires GA4 real-time connection. Connect GA4 in Settings.
          </p>
        </div>
      </div>
    </>
  );
}
