import { describe, expect, it } from "vitest";
import {
  buildBusinessFirstInsight,
  isDiagnosticMetric,
  metricTierForLabel,
  sortSupportingMetricsByTier,
} from "../hierarchy";

describe("metricTierForLabel", () => {
  it("classifies business outcomes as tier 1", () => {
    expect(metricTierForLabel("Net Profit")).toBe(1);
    expect(metricTierForLabel("Revenue")).toBe(1);
    expect(metricTierForLabel("Orders")).toBe(1);
  });

  it("classifies decision metrics as tier 2", () => {
    expect(metricTierForLabel("Blended ROAS")).toBe(2);
    expect(metricTierForLabel("Break-even ROAS")).toBe(2);
    expect(metricTierForLabel("CPA (7d)")).toBe(2);
  });

  it("classifies ad delivery metrics as tier 3", () => {
    expect(metricTierForLabel("CPM (7d)")).toBe(3);
    expect(metricTierForLabel("CTR")).toBe(3);
    expect(metricTierForLabel("Frequency (7d)")).toBe(3);
    expect(isDiagnosticMetric("CPM")).toBe(true);
  });
});

describe("sortSupportingMetricsByTier", () => {
  it("orders business metrics before diagnostics", () => {
    const sorted = sortSupportingMetricsByTier([
      { label: "CPM (7d)", value: "$12.40", trend: "up" },
      { label: "ROAS (7d)", value: "0.62", trend: "down" },
      { label: "7-day spend", value: "$4,200" },
    ]);
    expect(sorted[0]?.label).toBe("ROAS (7d)");
    expect(sorted.at(-1)?.label).toBe("CPM (7d)");
  });
});

describe("buildBusinessFirstInsight", () => {
  it("puts diagnostics in evidence, not the headline", () => {
    const insight = buildBusinessFirstInsight({
      headline: "Advertising efficiency declined on Prospecting — Core",
      why: "Customer acquisition became more expensive while conversion also weakened.",
      businessImpact: "This pattern typically erodes monthly profit before revenue recovers.",
      action: "Reduce spend on underperforming ad sets and refresh creative.",
      diagnostics: [
        { label: "CPM (7d)", value: "+18%", trend: "up" },
        { label: "CTR (7d)", value: "-6%", trend: "down" },
        { label: "ROAS (7d)", value: "0.60", trend: "down" },
      ],
    });

    expect(insight.headline).not.toMatch(/CPM/i);
    expect(insight.summary).toContain("Customer acquisition");
    expect(insight.evidence[0]?.label).not.toBe("CPM (7d)");
    expect(insight.evidence.some((e) => e.label.includes("CPM"))).toBe(true);
  });
});
