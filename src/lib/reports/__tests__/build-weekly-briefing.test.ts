import { describe, expect, it } from "vitest";
import { resolveCampaignWinProblem } from "../build-weekly-briefing";

describe("resolveCampaignWinProblem", () => {
  it("labels a single campaign as most active instead of best and worst", () => {
    const { win, problem } = resolveCampaignWinProblem(
      [{ id: "c1", name: "Prospecting — Core", roas7d: 0.6, spend7d: 1200 }],
      1.2,
    );

    expect(win?.label).toBe("Most active campaign");
    expect(win?.value).toContain("Prospecting — Core");
    expect(problem).not.toBeNull();
    expect(problem!.label).toBe("Campaign efficiency");
    expect(win?.value).not.toContain("Best performing");
  });

  it("does not show the same campaign as both best and worst when multiple exist but all below break-even", () => {
    const campaigns = [
      { id: "c1", name: "Prospecting — Core", roas7d: 0.6, spend7d: 2000 },
      { id: "c2", name: "Retargeting", roas7d: 0.55, spend7d: 800 },
    ];

    const { win, problem } = resolveCampaignWinProblem(campaigns, 1.2);

    expect(win?.label).toBe("Campaign performance");
    expect(win?.value).toContain("No winning campaigns");
    expect(problem).not.toBeNull();
    expect(problem!.label).toBe("Worst campaign");
    expect(problem!.value).toContain("Retargeting");
    expect(win?.value).not.toContain(problem!.value.split(" · ")[0]!);
  });

  it("shows best and worst separately when one campaign clears break-even", () => {
    const campaigns = [
      { id: "c1", name: "Google Shopping", roas7d: 2.4, spend7d: 900 },
      { id: "c2", name: "Prospecting — Core", roas7d: 0.6, spend7d: 2000 },
    ];

    const { win, problem } = resolveCampaignWinProblem(campaigns, 1.2);

    expect(win?.label).toBe("Best performing campaign");
    expect(win?.value).toContain("Google Shopping");
    expect(problem).not.toBeNull();
    expect(problem!.label).toBe("Worst campaign");
    expect(problem!.value).toContain("Prospecting — Core");
    expect(problem!.urgency).toBe("critical");
  });
});

describe("buildWeeklyBriefingReport scorecard", () => {
  it("explains unavailable metrics instead of bare placeholders", async () => {
    const { buildWeeklyBriefingReport } = await import("../build-weekly-briefing");

    const report = buildWeeklyBriefingReport({
      dashboard: {
        storeManager: { trends: { metrics: [] } },
        storeHealth: { factors: [], label: "Fair", score: 55 },
        aiPerformance: { measuredCount: 0, predictionAccuracy: 0 },
        weeklyReport: {
          revenue30d: 10000,
          profit30d: 2000,
          roas30d: 1.1,
          worstCampaigns: [],
          biggestOpportunities: [],
          accuracyTrend: [],
        },
        topOpportunities: [],
        decisionCenter: [],
      } as never,
      snapshot: {
        campaigns: [],
        products: [],
        storeMetrics: { revenue30d: 10000 },
      } as never,
      profitDashboard: {
        primary: { revenue: 10000, netProfit: 2000 },
        primaryProfit: { status: "unavailable" },
        confidence: { setupRequired: true },
      } as never,
    });

    const revenue = report.scorecard.find((s) => s.id === "revenue");
    const profit = report.scorecard.find((s) => s.id === "profit");
    const ai = report.scorecard.find((s) => s.id === "ai");

    expect(revenue?.unavailableReason).toBe("Waiting for historical comparison");
    expect(profit?.unavailableReason).toBe("Cost configuration incomplete");
    expect(ai?.unavailableReason).toBe("Requires completed recommendations");
    expect(report.executive.narrativeParagraph.length).toBeGreaterThan(80);
    expect(report.financialImpact.lines.length).toBeGreaterThan(0);
    expect(report.financialImpact.lines[0]?.measuredMonthly).toBeNull();
    expect(report.aiOutcomes.accuracyAvailable).toBe(false);
    expect(report.aiOutcomes.measurementStatus).toContain("Waiting");
  });
});
