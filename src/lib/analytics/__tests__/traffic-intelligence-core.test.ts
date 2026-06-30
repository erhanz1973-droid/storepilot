import { describe, expect, it } from "vitest";
import {
  computeTrafficQualityScore,
  deriveTrafficRecommendation,
  scoreToTrafficStatus,
} from "@/lib/analytics/traffic-intelligence-core";

describe("traffic intelligence consistency", () => {
  it("losing money caps quality score below Good", () => {
    const score = computeTrafficQualityScore({
      conversionRatePct: 3.5,
      avgConversionRatePct: 2.5,
      revPerSession: 4,
      avgRevPerSession: 3,
      profitMarginPct: -0.35,
      engagementRatePct: 64,
      sessionSharePct: 40,
    });
    expect(score).toBeLessThanOrEqual(74);
  });

  it("Excellent status recommends scaling not reducing", () => {
    const status = scoreToTrafficStatus(92);
    const rec = deriveTrafficRecommendation({
      status,
      label: "Paid",
      isPaid: true,
      conversionRatePct: 3.8,
      storeCvr: 2.5,
      netContribution: 4200,
      paidSubsources: [],
      engagementRatePct: 64,
    });
    expect(rec.headline.toLowerCase()).toMatch(/scale|protect/);
    expect(rec.headline.toLowerCase()).not.toMatch(/reduce|stop|wasting/);
  });

  it("Critical losing paid recommends restructuring not scaling", () => {
    const rec = deriveTrafficRecommendation({
      status: "Critical",
      label: "Paid",
      isPaid: true,
      conversionRatePct: 0.8,
      storeCvr: 2.5,
      netContribution: -25_000,
      paidSubsources: [
        { label: "Meta Prospecting", sessions: 1000, revenue: 2000, sessionSharePct: 60, revenueSharePct: 20 },
        { label: "Google Search", sessions: 400, revenue: 8000, sessionSharePct: 40, revenueSharePct: 80 },
      ],
      engagementRatePct: 58,
      topLandingPath: "/collections/sale",
    });
    expect(rec.headline.toLowerCase()).toMatch(/stop|restruct|reduce|meta prospecting/);
    expect(rec.estimatedRecoveryMonthly).toBeLessThan(25_000);
    expect(rec.actions.length).toBeGreaterThan(0);
  });

  it("recovery never exceeds 35% of documented loss", () => {
    const rec = deriveTrafficRecommendation({
      status: "Poor",
      label: "Paid",
      isPaid: true,
      conversionRatePct: 1.2,
      storeCvr: 2.5,
      netContribution: -18_900,
      paidSubsources: [],
      engagementRatePct: 60,
    });
    expect(rec.estimatedRecoveryMonthly).toBeLessThanOrEqual(Math.round(18_900 * 0.35));
  });
});
