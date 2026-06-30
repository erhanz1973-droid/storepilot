import { describe, expect, it } from "vitest";
import { buildRiskDistribution } from "../action-plan";
import { enrichDomains, statusFromScore } from "../enrich-domains";
import type { BusinessHealthDomain } from "../types";

describe("enrichDomains", () => {
  it("adds why, action, and impact to domains", () => {
    const domains = enrichDomains({
      baseDomains: [
        { id: "profit", label: "Profit", score: 30, detail: "Margins thin." },
        { id: "marketing", label: "Marketing", score: 25, detail: "ROAS low." },
      ],
      risk: {
        categories: [
          {
            category: "profitability",
            label: "Profitability",
            score: 80,
            summary: "Advertising spend currently exceeds gross margin.",
            contributors: [],
            urgency: "Critical",
            timeHorizon: "30 days",
            confidencePct: 90,
            financialExposure: [{ label: "Monthly gap", amountMonthly: 5420 }],
          },
        ],
        primaryRisk: {
          category: "profitability",
          title: "Unprofitable Operations",
          reason: "Negative margin",
          businessImpact: "Critical",
          confidencePct: 90,
          supportingFactors: [],
        },
        recommendationSteps: [
          { step: 1, action: "Reduce Prospecting campaign spend by 25%.", reason: "ROAS below break-even" },
        ],
        estimatedExposure: { items: [], totalMonthly: 5420 },
      },
      activeRecs: [],
      opportunities: [],
    });

    expect(domains[0]?.why).toContain("Advertising spend");
    expect(domains[0]?.recommendedAction).toContain("Prospecting");
    expect(domains[0]?.estimatedImpactMonthly).toBe(5420);
  });
});

describe("statusFromScore", () => {
  it("maps scores to status bands", () => {
    expect(statusFromScore(80)).toBe("healthy");
    expect(statusFromScore(55)).toBe("warning");
    expect(statusFromScore(30)).toBe("critical");
    expect(statusFromScore(60, true)).toBe("limited");
  });
});

describe("buildRiskDistribution", () => {
  it("counts domain statuses", () => {
    const domains: BusinessHealthDomain[] = [
      { id: "a", label: "A", score: 20, status: "critical", why: "", recommendedAction: "", estimatedImpact: null, estimatedImpactMonthly: null, trend: { windowLabel: "30-Day Trend", direction: "stable", label: "Stable", deltaPoints: null } },
      { id: "b", label: "B", score: 50, status: "warning", why: "", recommendedAction: "", estimatedImpact: null, estimatedImpactMonthly: null, trend: { windowLabel: "30-Day Trend", direction: "stable", label: "Stable", deltaPoints: null } },
      { id: "c", label: "C", score: 80, status: "healthy", why: "", recommendedAction: "", estimatedImpact: null, estimatedImpactMonthly: null, trend: { windowLabel: "30-Day Trend", direction: "stable", label: "Stable", deltaPoints: null } },
    ];
    expect(buildRiskDistribution(domains)).toEqual({ critical: 1, warning: 1, healthy: 1, limited: 0 });
  });
});
