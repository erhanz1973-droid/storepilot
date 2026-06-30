import { describe, expect, it } from "vitest";
import { normalizeBusinessHealthDashboard } from "../normalize";

describe("normalizeBusinessHealthDashboard", () => {
  it("maps legacy root-level trend and overallScore", () => {
    const normalized = normalizeBusinessHealthDashboard({
      generatedAt: "2026-01-01T00:00:00Z",
      storeId: "s1",
      overallScore: 41,
      overallLabel: "At Risk",
      trend: {
        direction: "improving",
        label: "Improving",
        detail: "Up 4 points",
        deltaPoints: 4,
      },
      domains: [
        {
          id: "profit",
          label: "Profit",
          score: 15,
          status: "critical",
          detail: "Margins thin.",
        },
      ],
    });

    expect(normalized.overall.score).toBe(41);
    expect(normalized.overall.trend.direction).toBe("improving");
    expect(normalized.domains[0]?.why).toBe("Margins thin.");
    expect(normalized.domains[0]?.trend.direction).toBe("stable");
  });
});
