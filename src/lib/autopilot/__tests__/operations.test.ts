import { describe, expect, it } from "vitest";
import { AUTOPILOT_RULE_CATALOG } from "../rule-catalog";
import { buildAutopilotOperationsView } from "../operations";
import type { AutopilotDashboard } from "../types";

function minimalDashboard(overrides: Partial<AutopilotDashboard> = {}): AutopilotDashboard {
  return {
    syncedAt: new Date().toISOString(),
    executiveBrief: {
      title: "Daily Brief",
      generatedAt: new Date().toISOString(),
      headline: "Revenue stable",
      metrics: {
        revenue30d: 100_000,
        netProfit30d: 30_000,
        profitMarginPct: 30,
        blendedRoas: 0.72,
        cac: 40,
        bestProduct: "Widget",
        worstProduct: "Gadget",
        inventoryRiskCount: 2,
        advertisingChange: null,
        newOpportunityCount: 3,
      },
      sections: [],
      topAction: null,
      confidencePct: 88,
    },
    executiveHealth: {
      score: 72,
      label: "Good",
      breakdown: {
        profitability: 70,
        growth: 75,
        marketing: 65,
        inventory: 80,
        acquisition: 70,
        retention: 72,
        operations: 74,
      },
      changeReasons: [],
    },
    actions: [
      {
        id: "a1",
        source: "budget",
        priority: "High",
        title: "Pause underperforming campaign",
        description: "ROAS below break-even",
        expectedNetProfitGain: 3100,
        confidenceScore: 0.91,
        estimatedMinutes: 5,
        businessImpact: "Reduce wasted spend",
        actionLabel: "Review",
      },
    ],
    profitForecasts: [],
    inventoryForecasts: [
      {
        productId: "p1",
        title: "Best Seller",
        inventory: 12,
        daysRemaining: 6,
        risk: "stockout",
        recommendedPurchaseDate: "2026-07-01",
        lostRevenueRisk: 5000,
        lostProfitRisk: 1800,
      },
    ],
    budgetRecommendations: [
      {
        id: "br1",
        action: "pause_campaign",
        target: "Summer Sale",
        expectedNetProfitGain: 3100,
        confidenceScore: 0.91,
        reasoning: "ROAS 0.72 vs break-even 1.29 for 7+ days",
      },
    ],
    pricingRecommendations: [],
    alerts: [
      {
        id: "alert-roas",
        type: "roas_drop",
        severity: "High",
        title: "Blended ROAS decreased",
        reason: "ROAS dropped from 1.10 to 0.72.",
        businessImpact: "Efficiency declined",
        suggestedAction: "Review campaigns",
        confidenceScore: 0.8,
      },
    ],
    timeline: [
      {
        id: "tl1",
        date: new Date().toISOString().slice(0, 10),
        dayLabel: "Tuesday",
        event: "Inventory Alert Sent",
        status: "accepted",
      },
    ],
    ...overrides,
  };
}

describe("buildAutopilotOperationsView", () => {
  it("groups all catalog rules by business area", () => {
    const view = buildAutopilotOperationsView(minimalDashboard());
    const ruleCount = view.groups.reduce((n, g) => n + g.rules.length, 0);
    expect(ruleCount).toBe(AUTOPILOT_RULE_CATALOG.length);
    expect(view.groups.map((g) => g.label)).toEqual([
      "Advertising",
      "Inventory",
      "Store Performance",
      "Customer Intelligence",
      "Executive Reporting",
    ]);
  });

  it("builds status summary from live dashboard signals", () => {
    const view = buildAutopilotOperationsView(minimalDashboard());
    expect(view.status.activeRules).toBeGreaterThan(0);
    expect(view.status.pendingApprovals).toBe(1);
    expect(view.status.estimatedMonthlyImpact).toBeGreaterThan(0);
    expect(view.status.lastAction).toContain("Inventory");
    expect(view.status.lastReviewLabel).toMatch(/ago|Just now/);
  });

  it("marks pause losing campaigns as needs approval when budget rec exists", () => {
    const view = buildAutopilotOperationsView(minimalDashboard());
    const pauseRule = view.groups
      .find((g) => g.category === "advertising")
      ?.rules.find((r) => r.id === "pause_losing_campaigns");
    expect(pauseRule?.health).toBe("needs_approval");
    expect(pauseRule?.pendingCount).toBe(1);
    expect(pauseRule?.metrics.some((m) => m.label === "Current ROAS")).toBe(true);
  });

  it("marks low inventory alerts as triggered with stockout context", () => {
    const view = buildAutopilotOperationsView(minimalDashboard());
    const invRule = view.groups
      .find((g) => g.category === "inventory")
      ?.rules.find((r) => r.id === "low_inventory_alerts");
    expect(invRule?.enabled).toBe(true);
    expect(["triggered", "needs_approval"]).toContain(invRule?.health);
    expect(invRule?.reason).toMatch(/Best Seller/);
  });

  it("returns ready/disabled states when dashboard is null", () => {
    const view = buildAutopilotOperationsView(null);
    expect(view.connected).toBe(false);
    expect(view.status.activeRules).toBe(2);
    const enabled = view.groups.flatMap((g) => g.rules).filter((r) => r.enabled);
    expect(enabled).toHaveLength(2);
    expect(view.safetyGuarantees.length).toBeGreaterThanOrEqual(5);
  });

  it("includes automation history entries", () => {
    const view = buildAutopilotOperationsView(minimalDashboard());
    expect(view.history.length).toBeGreaterThanOrEqual(1);
    expect(view.history[0]?.title).toBeTruthy();
  });
});
