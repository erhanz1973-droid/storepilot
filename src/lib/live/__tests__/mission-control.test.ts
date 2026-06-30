import { describe, expect, it } from "vitest";
import { DEMO_STORE_SNAPSHOT } from "@/lib/connectors/demo-data";
import { computeProfitDashboard } from "@/lib/profit/engine";
import type { AIEvent } from "@/lib/monitoring/types";
import { mergeLiveEvents } from "../event-merge";
import { buildLiveMissionControlView } from "../mission-control";

function event(partial: Partial<AIEvent> & Pick<AIEvent, "id" | "title">): AIEvent {
  return {
    type: "roas_change",
    severity: "warning",
    description: "Test",
    evidence: [],
    recommendation: "Review search terms. Pause losing ad groups.",
    confidencePct: 90,
    createdAt: new Date().toISOString(),
    monitor: "ROAS Monitor",
    actionAvailable: false,
    ...partial,
  };
}

describe("mergeLiveEvents", () => {
  it("merges duplicate titles into one event", () => {
    const merged = mergeLiveEvents([
      event({ id: "1", title: "Revenue increased 9%" }),
      event({ id: "2", title: "Revenue increased 9%", type: "revenue_change" }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.sourceEventIds).toHaveLength(2);
  });

  it("merges google search ROAS events by campaign", () => {
    const merged = mergeLiveEvents([
      event({
        id: "g1",
        title: "Google Search ROAS below target",
        evidence: [{ label: "ROAS", value: "0.67" }],
      }),
      event({
        id: "g2",
        title: "Google Search ROAS below target (0.67)",
        severity: "critical",
      }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.priority).toBe("critical");
  });
});

describe("buildLiveMissionControlView", () => {
  it("builds store health banner and smart KPIs", () => {
    const snapshot = DEMO_STORE_SNAPSHOT;
    const profit = computeProfitDashboard(snapshot, []);
    const today = profit?.periods.find((p) => p.window === "today");

    const view = buildLiveMissionControlView(
      {
        syncedAt: snapshot.syncedAt,
        visitorsOnline: 12,
        ordersToday: today?.orders ?? 5,
        revenueToday: today?.revenue ?? 1000,
        profitToday: today?.netProfit ?? -605,
        spendToday: 800,
        roasToday: 0.48,
        checkouts: 3,
        requiresGa4: true,
        aiEvents: [
          event({
            id: "roas",
            title: "Blended ROAS fell to 0.48",
            severity: "critical",
            type: "roas_change",
          }),
        ],
      },
      snapshot,
      profit,
    );

    expect(view.health.label).toMatch(/Attention|Required|Critical/i);
    expect(view.kpis.find((k) => k.id === "profit")?.reason).toBeTruthy();
    expect(view.watchlist.length).toBeGreaterThanOrEqual(5);
    expect(view.events.length).toBeGreaterThan(0);
  });
});
