import { describe, expect, it } from "vitest";
import { getScenarioNarrative } from "@/lib/simulation-stores/scenario-narratives";

describe("getScenarioNarrative", () => {
  it("returns rich narrative for advertising disaster", () => {
    const n = getScenarioNarrative("roas_collapse");
    expect(n.title).toBe("Advertising Disaster");
    expect(n.paragraphs.some((p) => p.includes("simulated"))).toBe(true);
    expect(n.paragraphs.some((p) => p.includes("ROAS"))).toBe(true);
    expect(n.purpose.length).toBeGreaterThan(10);
  });

  it("returns dead inventory narrative", () => {
    const n = getScenarioNarrative("dead_inventory");
    expect(n.paragraphs.some((p) => p.toLowerCase().includes("inventory"))).toBe(true);
    expect(n.aiShouldRecommend.toLowerCase()).toContain("clearance");
  });

  it("returns scaling opportunity narrative", () => {
    const n = getScenarioNarrative("scaling_opportunity");
    expect(n.aiShouldRecommend.toLowerCase()).toContain("increase budget");
  });

  it("falls back for unknown scenario ids", () => {
    const n = getScenarioNarrative("healthy_store");
    expect(n.paragraphs.length).toBeGreaterThan(0);
  });
});
