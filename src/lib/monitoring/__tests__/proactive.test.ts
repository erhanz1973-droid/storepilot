import { describe, expect, it } from "vitest";
import { DEMO_STORE_SNAPSHOT } from "@/lib/connectors/demo-data";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildProductIntelligence } from "@/lib/products/engine";
import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { buildCommerceOpportunities } from "@/lib/insights/engine";
import { buildPredictiveInsights } from "@/lib/predictions/engine";
import { buildInventoryForecasts } from "@/lib/autopilot/forecast";
import { runContinuousMonitors } from "@/lib/monitoring/engine";
import { buildMorningExecutiveBrief } from "@/lib/brief/morning-brief";
import { buildDecisionCenter } from "@/lib/decisions/center";
import { computeStoreHealthScore } from "@/lib/store-health/score";
import { buildCommerceDailyBrief } from "@/lib/insights/daily-brief";
import { buildTrendAnalysis } from "@/lib/insights/trends";
import { buildPriorityQueue } from "@/lib/insights/priority";

describe("Proactive AI stack (Phases 10-15)", () => {
  it("runs continuous monitors and produces AI events with evidence", () => {
    const snapshot = DEMO_STORE_SNAPSHOT;
    const profit = computeProfitDashboard(snapshot, []);
    const products = buildProductIntelligence(snapshot, [], profit);
    const attribution = buildAttributionDashboard(snapshot, profit);
    const opportunities = buildCommerceOpportunities(snapshot, profit, []);
    const forecasts = buildInventoryForecasts(snapshot.products, 38);
    const predictions = buildPredictiveInsights({
      snapshot,
      profitDashboard: profit,
      attributionDashboard: attribution,
      inventoryForecasts: forecasts,
    });

    const events = runContinuousMonitors({
      syncedAt: snapshot.syncedAt,
      snapshot,
      profitDashboard: profit,
      productIntelligence: products,
      attributionDashboard: attribution,
      opportunities,
      predictiveInsights: predictions,
    });

    expect(events.length).toBeGreaterThan(0);
    expect(events[0].evidence.length).toBeGreaterThan(0);
    expect(events[0].confidencePct).toBeGreaterThan(0);
    expect(events[0].recommendation.length).toBeGreaterThan(0);
  });

  it("builds morning brief under one minute read time", () => {
    const snapshot = DEMO_STORE_SNAPSHOT;
    const profit = computeProfitDashboard(snapshot, []);
    const trends = buildTrendAnalysis(snapshot, profit);
    const opportunities = buildCommerceOpportunities(snapshot, profit, []);
    const brief = buildCommerceDailyBrief({ trends, opportunities, snapshot });
    const health = computeStoreHealthScore({
      snapshot,
      profitDashboard: profit,
      productIntelligence: null,
      attributionDashboard: null,
      activeRecommendations: [],
    });
    const queue = buildPriorityQueue(opportunities, [], []);
    const events = runContinuousMonitors({
      syncedAt: snapshot.syncedAt,
      snapshot,
      profitDashboard: profit,
      productIntelligence: null,
      attributionDashboard: null,
      opportunities,
      predictiveInsights: [],
    });

    const morning = buildMorningExecutiveBrief({
      storeHealth: health,
      dailyBrief: brief,
      priorityQueue: queue,
      opportunities,
      aiEvents: events,
    });

    expect(morning.readingTimeSec).toBeLessThanOrEqual(60);
    expect(morning.sections.length).toBeGreaterThanOrEqual(4);
  });

  it("merges decisions with critical items first", () => {
    const snapshot = DEMO_STORE_SNAPSHOT;
    const profit = computeProfitDashboard(snapshot, []);
    const opportunities = buildCommerceOpportunities(snapshot, profit, []);
    const queue = buildPriorityQueue(opportunities, [], []);
    const events = runContinuousMonitors({
      syncedAt: snapshot.syncedAt,
      snapshot,
      profitDashboard: profit,
      productIntelligence: null,
      attributionDashboard: null,
      opportunities,
      predictiveInsights: [],
    });

    const decisions = buildDecisionCenter({
      priorityQueue: queue,
      opportunities,
      recommendations: [],
      aiEvents: events,
    });

    expect(decisions.length).toBeGreaterThan(0);
    const firstCritical = decisions.findIndex((d) => d.priority === "critical");
    if (firstCritical >= 0) {
      expect(decisions[0].priority).toBe("critical");
    }
  });
});
