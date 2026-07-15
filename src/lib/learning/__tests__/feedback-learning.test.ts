import { describe, expect, it } from "vitest";
import {
  applyFeedbackToConfidence,
  applyFeedbackToPriority,
  computeFeedbackAdjustment,
  feedbackPatternKey,
  findFeedbackStatsForOutput,
  type FeedbackPatternStats,
} from "@/lib/learning/feedback-learning";
import type { AnalyzerOutput } from "@/lib/types";

describe("feedback learning", () => {
  it("scopes pattern keys by category+entity", () => {
    expect(
      feedbackPatternKey({ category: "campaign_review", entityId: "camp-1", title: "Pause ads" }),
    ).toBe("campaign_review:camp-1");
  });

  it("reduces confidence only for negative pattern consensus", () => {
    const adj = computeFeedbackAdjustment({
      patternKey: "pricing:sku-1",
      category: "pricing",
      helpfulCount: 0,
      notHelpfulCount: 2,
      lastFeedbackAt: new Date().toISOString(),
    });
    expect(adj.confidenceMultiplier).toBeLessThan(1);
    expect(adj.priorityDelta).toBeLessThan(0);
    expect(applyFeedbackToConfidence(0.8, adj)).toBeLessThan(0.8);
    expect(applyFeedbackToPriority("high", adj)).toBe("medium");
  });

  it("boosts confidence for strong positive pattern feedback", () => {
    const adj = computeFeedbackAdjustment({
      patternKey: "bundles:sku-2",
      category: "bundles",
      helpfulCount: 4,
      notHelpfulCount: 0,
      lastFeedbackAt: new Date().toISOString(),
    });
    expect(adj.confidenceMultiplier).toBeGreaterThan(1);
    expect(applyFeedbackToPriority("medium", adj)).toBe("high");
  });

  it("suppresses patterns with repeated unanimous negative feedback", () => {
    const adj = computeFeedbackAdjustment({
      patternKey: "homepage:hero",
      category: "homepage",
      helpfulCount: 0,
      notHelpfulCount: 3,
      lastFeedbackAt: new Date().toISOString(),
    });
    expect(adj.suppress).toBe(true);
  });

  it("does not apply category fallback under sample threshold", () => {
    const map = new Map<string, FeedbackPatternStats>([
      [
        "pricing:a",
        {
          patternKey: "pricing:a",
          category: "pricing",
          helpfulCount: 1,
          notHelpfulCount: 0,
          lastFeedbackAt: new Date().toISOString(),
        },
      ],
    ]);
    const output = {
      id: "1",
      title: "Other pricing idea",
      description: "x",
      priority: "medium",
      expectedImpact: "$100/mo",
      confidence: 0.7,
      evidence: [],
      actions: [],
      category: "pricing",
      entityId: "other",
    } as AnalyzerOutput;
    expect(findFeedbackStatsForOutput(output, map)).toBeUndefined();
  });
});
