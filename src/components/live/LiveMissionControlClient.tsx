"use client";

import { ActiveIncidentsPanel } from "@/components/live/ActiveIncidentsPanel";
import { AiMonitoringWatchlist } from "@/components/live/AiMonitoringWatchlist";
import { LiveAlertsStrip } from "@/components/live/LiveAlertsStrip";
import { LiveEventFeed } from "@/components/live/LiveEventFeed";
import { LiveSmartKpiGrid } from "@/components/live/LiveSmartKpiGrid";
import { StoreHealthBannerCard } from "@/components/live/StoreHealthBanner";
import { TodaysAiFocusCard } from "@/components/live/TodaysAiFocusCard";
import { VisitorActivityPanel } from "@/components/live/VisitorActivityPanel";
import { jsonEqual } from "@/lib/performance/shallow-equal";
import { REFRESH_MS } from "@/lib/performance/refresh-schedules";
import type { LiveMissionControlView } from "@/lib/live/mission-control-types";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useRef, useState } from "react";

const VisionCard = memo(function VisionCard({ text }: { text: string }) {
  return (
    <section className="card live-vision-card" style={{ marginTop: 16 }}>
      <p className="live-mission-eyebrow">Operations vision</p>
      <p className="muted" style={{ margin: 0, lineHeight: 1.55, fontSize: "0.9rem" }}>
        {text}
      </p>
    </section>
  );
});

const LiveMidGrid = memo(function LiveMidGrid({
  aiFocus,
  incidents,
  watchlist,
}: Pick<LiveMissionControlView, "aiFocus" | "incidents" | "watchlist">) {
  return (
    <div className="live-mission-mid-grid">
      {aiFocus && <TodaysAiFocusCard focus={aiFocus} />}
      <ActiveIncidentsPanel incidents={incidents} />
      <AiMonitoringWatchlist items={watchlist} />
    </div>
  );
});

const LiveBottomGrid = memo(function LiveBottomGrid({
  events,
  requiresGa4,
}: Pick<LiveMissionControlView, "events" | "requiresGa4">) {
  return (
    <div className="analytics-live-grid">
      <LiveEventFeed events={events} />
      <VisitorActivityPanel requiresGa4={requiresGa4} />
    </div>
  );
});

export function LiveMissionControlClient({
  initialView,
}: {
  initialView: LiveMissionControlView;
}) {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const abortRef = useRef<AbortController | null>(null);

  const mergeKpiUpdate = useCallback(
    (patch: Pick<LiveMissionControlView, "syncedAt" | "health" | "kpis" | "alerts">) => {
      setView((prev) => {
        if (
          prev.syncedAt === patch.syncedAt &&
          jsonEqual(prev.health, patch.health) &&
          jsonEqual(prev.kpis, patch.kpis) &&
          jsonEqual(prev.alerts, patch.alerts)
        ) {
          return prev;
        }
        return { ...prev, ...patch };
      });
    },
    [],
  );

  const mergeFullUpdate = useCallback((next: LiveMissionControlView) => {
    setView((prev) => (jsonEqual(prev, next) ? prev : next));
  }, []);

  const fetchKpis = useCallback(async (signal: AbortSignal) => {
    const res = await fetch("/api/live/metrics?scope=kpis", { cache: "no-store", signal });
    if (!res.ok) return;
    const data = (await res.json()) as Pick<
      LiveMissionControlView,
      "syncedAt" | "health" | "kpis" | "alerts"
    >;
    mergeKpiUpdate(data);
  }, [mergeKpiUpdate]);

  const fetchFull = useCallback(async (signal: AbortSignal) => {
    const res = await fetch("/api/live/metrics?scope=full", { cache: "no-store", signal });
    if (!res.ok) return;
    const data = (await res.json()) as LiveMissionControlView;
    mergeFullUpdate(data);
  }, [mergeFullUpdate]);

  useEffect(() => {
    const ac = new AbortController();
    abortRef.current = ac;

    void fetchKpis(ac.signal);
    void fetchFull(ac.signal);

    const kpiId = window.setInterval(() => {
      void fetchKpis(ac.signal);
    }, REFRESH_MS.liveKpis);

    const fullId = window.setInterval(() => {
      void fetchFull(ac.signal);
    }, REFRESH_MS.liveFull);

    return () => {
      ac.abort();
      window.clearInterval(kpiId);
      window.clearInterval(fullId);
    };
  }, [fetchFull, fetchKpis]);

  const refreshNow = useCallback(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    void fetchKpis(ac.signal);
    void fetchFull(ac.signal);
    router.refresh();
  }, [fetchFull, fetchKpis, router]);

  return (
    <>
      <p className="analytics-live-badge">
        Mission Control · KPIs every 30s · AI panels every 5m
        <button type="button" className="analytics-live-refresh-btn" onClick={refreshNow}>
          Refresh now
        </button>
      </p>

      <StoreHealthBannerCard health={view.health} />
      <LiveAlertsStrip alerts={view.alerts} />
      <LiveSmartKpiGrid kpis={view.kpis} />

      <LiveMidGrid aiFocus={view.aiFocus} incidents={view.incidents} watchlist={view.watchlist} />

      <LiveBottomGrid events={view.events} requiresGa4={view.requiresGa4} />

      <VisionCard text={view.visionStatement} />
    </>
  );
}
