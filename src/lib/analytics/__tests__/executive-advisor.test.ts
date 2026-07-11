import {
  buildCashFlowBreakdown,
  buildConversationalCeoBrief,
  buildDailyChanges,
  buildExecutiveAdvisorView,
  buildMoneyLeaks,
  buildRecoveryBreakdown,
  buildRecommendationRows,
  buildAiLearningStatus,
  resolveMerchantDisplayName,
} from "@/lib/analytics/executive-advisor";
import { buildExecutiveExperience } from "@/lib/analytics/executive-experience";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { computeStoreHealthScore } from "@/lib/store-health/score";
import { describe, expect, it } from "vitest";

describe("executive-advisor", () => {
  const snapshot = getPeakOutfittersSnapshot();
  const profitDashboard = computeProfitDashboard(snapshot, [])!;

  function storeHealth() {
    return computeStoreHealthScore({
      snapshot,
      profitDashboard,
      productIntelligence: null,
      attributionDashboard: null,
      activeRecommendations: [],
    });
  }

  it("builds deduped money leaks", () => {
    const leaks = buildMoneyLeaks(profitDashboard, snapshot);
    expect(leaks.items.length).toBeGreaterThan(0);
    const sum = leaks.items.reduce((s, i) => s + i.amountMonthly, 0);
    expect(leaks.totalLostMonthly).toBe(sum);
  });

  it("builds cash flow with full cost lines", () => {
    const cashFlow = buildCashFlowBreakdown(profitDashboard, snapshot);
    expect(cashFlow.revenue).toBeGreaterThan(0);
    expect(cashFlow.status).not.toBe("unavailable");
  });

  it("recovery breakdown has gross and net", () => {
    const experience = buildExecutiveExperience({
      snapshot,
      profitDashboard,
      decisions: [],
      opportunityFeed: [],
      priorityQueue: [],
      storeHealth: storeHealth(),
    });
    const rows = buildRecommendationRows({ experience, decisions: [], snapshot, profitDashboard });
    const recovery = buildRecoveryBreakdown(rows, { profitDashboard, snapshot });
    expect(recovery.grossMonthly).toBeGreaterThan(0);
    expect(recovery.netMonthly).toBeLessThanOrEqual(recovery.grossMonthly);
  });

  it("builds full advisor view with validation and profit trace", () => {
    const view = buildExecutiveAdvisorView({
      snapshot,
      profitDashboard,
      trends: null,
      decisions: [],
      activityFeed: [],
      autopilot: null,
      experienceInput: {
        snapshot,
        profitDashboard,
        decisions: [],
        opportunityFeed: [],
        priorityQueue: [],
        storeHealth: storeHealth(),
      },
    });

    expect(view.profitCalculation.isBalanced).toBe(true);
    expect(view.recoveryBreakdown.netMonthly).toBeLessThanOrEqual(
      view.recoveryBreakdown.grossMonthly,
    );
    expect(view.validation.recovery.netMonthly).toBe(view.recoveryBreakdown.netMonthly);
    expect(view.executiveKpis.length).toBe(5);
    expect(view.financialContext.currentRevenue).toBeGreaterThan(0);
    expect(view.recoveryBreakdown.scenarios.expected.amountMonthly).toBe(
      view.recoveryBreakdown.netMonthly,
    );
    expect(view.recommendationRows[0]?.evidence.strength).toBeTruthy();
  });

  it("formats daily change metrics", () => {
    const changes = buildDailyChanges({
      metrics: [
        {
          id: "profit_7d",
          label: "Profit",
          window: "7d",
          current: 100,
          previous: 80,
          changePct: 25,
          direction: "up",
          unit: "currency",
        },
      ],
      interpretation: "",
      generatedAt: new Date().toISOString(),
    });
    expect(changes.find((c) => c.label === "Profit")?.formatted).toBe("+25%");
  });

  it("rejects internal merchant identifiers in display name", () => {
    const named = resolveMerchantDisplayName({
      ...snapshot,
      commerceStoreDomain: "00000011.myshopify.com",
      source: "live",
    });
    expect(named).toBeNull();
  });

  it("builds compact executive-mode CEO brief without duplicate priority", () => {
    const experience = buildExecutiveExperience({
      snapshot,
      profitDashboard,
      decisions: [],
      opportunityFeed: [],
      priorityQueue: [],
      storeHealth: storeHealth(),
    });
    const rows = buildRecommendationRows({ experience, decisions: [], snapshot, profitDashboard });
    const moneyLeaks = buildMoneyLeaks(profitDashboard, snapshot);
    const recovery = buildRecoveryBreakdown(rows, { profitDashboard, snapshot });
    const brief = buildConversationalCeoBrief({
      snapshot,
      profitDashboard,
      moneyLeaks,
      recoveryBreakdown: recovery,
      experience,
      recommendationRows: rows,
      executiveMode: true,
    });

    expect(brief.conversation[0]).toContain("reviewed");
    expect(brief.todayPriority).toBeUndefined();
    expect(brief.conversation.length).toBeLessThanOrEqual(5);
  });

  it("builds conversational CEO brief with greeting and priority", () => {
    const experience = buildExecutiveExperience({
      snapshot,
      profitDashboard,
      decisions: [],
      opportunityFeed: [],
      priorityQueue: [],
      storeHealth: storeHealth(),
    });
    const rows = buildRecommendationRows({ experience, decisions: [], snapshot, profitDashboard });
    const moneyLeaks = buildMoneyLeaks(profitDashboard, snapshot);
    const recovery = buildRecoveryBreakdown(rows, { profitDashboard, snapshot });
    const brief = buildConversationalCeoBrief({
      snapshot,
      profitDashboard,
      moneyLeaks,
      recoveryBreakdown: recovery,
      experience,
      recommendationRows: rows,
    });

    expect(brief.greeting.length).toBeGreaterThan(0);
    expect(brief.headline).toBeDefined();
    expect(brief.conversation.length).toBeGreaterThan(0);
  });

  it("recommendation rows include impact timeline and success probability", () => {
    const experience = buildExecutiveExperience({
      snapshot,
      profitDashboard,
      decisions: [],
      opportunityFeed: [],
      priorityQueue: [],
      storeHealth: storeHealth(),
    });
    const rows = buildRecommendationRows({ experience, decisions: [], snapshot, profitDashboard });
    expect(rows.length).toBeGreaterThan(0);
    const row = rows[0];
    expect(row.estimatedSuccessPct).toBeGreaterThan(0);
    expect(row.inactionCost.timeline.daily).toBeGreaterThan(0);
    expect(row.inactionCost.timeline.monthly).toBeGreaterThan(row.inactionCost.timeline.weekly);
  });

  it("recovery potential stays credible relative to ad spend", () => {
    const smallSpendSnapshot = {
      ...snapshot,
      campaigns: [],
      googleAdsSnapshot: {
        ...snapshot.googleAdsSnapshot!,
        campaigns: [
          {
            id: "google:test",
            name: "Google Search",
            spend7d: 197,
            revenue7d: 280,
            roas7d: 1.42,
            status: "ENABLED",
          },
        ],
        rollups: snapshot.googleAdsSnapshot?.rollups,
      },
    };
    const smallProfit = {
      ...profitDashboard,
      primary: {
        ...profitDashboard.primary,
        revenue: 12_000,
        netProfit: 2_400,
        adSpend: 850,
      },
    };
    const experience = buildExecutiveExperience({
      snapshot: smallSpendSnapshot,
      profitDashboard: smallProfit,
      decisions: [],
      opportunityFeed: [],
      priorityQueue: [],
      storeHealth: storeHealth(),
    });
    const rows = buildRecommendationRows({
      experience,
      decisions: [],
      snapshot: smallSpendSnapshot,
      profitDashboard: smallProfit,
    });
    const recovery = buildRecoveryBreakdown(rows, {
      profitDashboard: smallProfit,
      snapshot: smallSpendSnapshot,
    });
    expect(recovery.netMonthly).toBeLessThanOrEqual(430);
    expect(recovery.explanation?.basedOn.length).toBeGreaterThan(0);
  });
});
