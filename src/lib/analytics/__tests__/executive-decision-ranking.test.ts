import { describe, expect, it } from "vitest";
import {
  computeDecisionImpactForCandidate,
  isEligibleExecutiveDecision,
  selectTodaysExecutiveDecision,
  type ExecutiveCandidate,
} from "@/lib/analytics/executive-decision-ranking";
import { buildDecisionImpactPresentation } from "@/lib/calculations/impact/engine";

function candidate(partial: Partial<ExecutiveCandidate> & Pick<ExecutiveCandidate, "id" | "title">): ExecutiveCandidate {
  return {
    description: partial.description ?? partial.title,
    impactLabel: partial.impactLabel ?? "",
    confidencePct: partial.confidencePct ?? 90,
    priority: partial.priority ?? "high",
    risk: partial.risk ?? "medium",
    ...partial,
  };
}

describe("executive decision ranking", () => {
  it("rejects $0 recoverable opportunity", () => {
    const c = candidate({
      id: "1",
      title: "High spend, low purchases — Prospecting Broad",
      impactLabel: "Review campaign performance",
      confidencePct: 90,
    });
    const impact = computeDecisionImpactForCandidate(c);
    expect(impact.businessRecovery).toBe(0);
    expect(isEligibleExecutiveDecision(impact, c)).toBe(false);
  });

  it("uses known amounts when label has no dollars — never $0 hero if net is positive", () => {
    const c = candidate({
      id: "2",
      title: "High spend, low purchases — Prospecting Broad",
      impactLabel: "Review underperforming ads",
      confidencePct: 88,
      knownBusinessRecovery: 171,
      knownNetProfit: 171,
      entityType: "campaign",
    });
    const impact = computeDecisionImpactForCandidate(c);
    expect(impact.businessRecovery).toBeGreaterThan(0);
    expect(impact.netProfitImpact).toBe(171);
    const presentation = buildDecisionImpactPresentation(impact);
    expect(presentation.heroAmount).toBeGreaterThan(0);
    expect(presentation.heroValueFormatted).not.toBe("$0");
    expect(isEligibleExecutiveDecision(impact, c, { minNetProfit: 100 })).toBe(true);
  });

  it("ranks by executive score, not creation order", () => {
    const low = candidate({
      id: "low",
      title: "Small tweak",
      impactLabel: "+$120/mo net profit",
      confidencePct: 75,
      priority: "low",
      risk: "low",
    });
    const high = candidate({
      id: "high",
      title: "Pause Prospecting Broad",
      impactLabel:
        "If accepted, estimated cost savings ~$6,168–$11,102/mo (~$636/mo profit preserved).",
      confidencePct: 90,
      priority: "critical",
      risk: "medium",
      entityType: "campaign",
    });

    const selection = selectTodaysExecutiveDecision([low, high], { minNetProfit: 100 });
    expect(selection.kind).toBe("decision");
    if (selection.kind === "decision") {
      expect(selection.ranked.candidate.id).toBe("high");
      expect(selection.ranked.impact.businessRecovery).toBe(6168);
      expect(selection.ranked.impact.netProfitImpact).toBe(636);
    }
  });

  it("returns no decision when all are below threshold", () => {
    const tiny = candidate({
      id: "tiny",
      title: "Tiny change",
      impactLabel: "+$40/mo net profit",
      confidencePct: 80,
    });
    const selection = selectTodaysExecutiveDecision([tiny], { minNetProfit: 100 });
    expect(selection.kind).toBe("none");
    if (selection.kind === "none") {
      expect(selection.message).toMatch(/No executive decision required/i);
    }
  });

  it("rejects low confidence even with high dollars", () => {
    const c = candidate({
      id: "low-conf",
      title: "Speculative play",
      impactLabel: "+$5,000/mo net profit",
      confidencePct: 40,
    });
    const impact = computeDecisionImpactForCandidate(c);
    expect(isEligibleExecutiveDecision(impact, c)).toBe(false);
  });
});
