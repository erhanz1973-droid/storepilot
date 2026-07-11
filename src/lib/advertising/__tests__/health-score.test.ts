import { describe, expect, it } from "vitest";
import {
  computeCampaignHealthScore,
  computeCreativeScore,
  healthTierFromScore,
  businessStatusFromScore,
} from "@/lib/advertising/health-score";

describe("advertising health score", () => {
  it("assigns excellent tier at 90+", () => {
    expect(healthTierFromScore(94)).toBe("excellent");
    expect(healthTierFromScore(90)).toBe("excellent");
  });

  it("assigns critical tier below 40", () => {
    expect(healthTierFromScore(24)).toBe("critical");
    expect(healthTierFromScore(39)).toBe("critical");
  });

  it("scores profitable high-ROAS campaigns highly", () => {
    const score = computeCampaignHealthScore({
      roas: 6.17,
      profit: 1520,
      spend: 540,
      cpa: 18,
      ctr: 3.2,
      conversionRate: 4.5,
      frequency: 1.8,
      isLearningPhase: false,
      trend: "up",
      breakEvenRoas: 1.8,
      creativeScore: 96,
    });
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it("scores losing campaigns critically", () => {
    const score = computeCampaignHealthScore({
      roas: 0.58,
      profit: -420,
      spend: 2010,
      cpa: 85,
      ctr: 0.8,
      conversionRate: 0.4,
      frequency: 4.2,
      isLearningPhase: false,
      trend: "down",
      breakEvenRoas: 1.8,
      creativeScore: 28,
    });
    expect(score).toBeLessThan(45);
    expect(healthTierFromScore(score)).toBe("critical");
  });

  it("computes creative score from performance signals", () => {
    const winner = computeCreativeScore({
      ctr: 3.5,
      roas: 5,
      frequency: 1.5,
      status: "winning",
    });
    const loser = computeCreativeScore({
      ctr: 0.6,
      roas: 0.5,
      frequency: 4,
      status: "underperforming",
    });
    expect(winner).toBeGreaterThan(loser);
    expect(winner).toBeGreaterThanOrEqual(80);
  });

  it("maps business status from health score", () => {
    expect(businessStatusFromScore(84).label).toBe("Healthy");
    expect(businessStatusFromScore(55).emoji).toBe("🟠");
  });
});
