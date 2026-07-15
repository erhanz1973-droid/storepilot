import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  saveRecommendationFeedback,
  listFeedbackForLearning,
} from "@/lib/db/feedback";
import { applyLearningToOutputs } from "@/lib/learning/outcomes";
import type { AnalyzerOutput } from "@/lib/types";

vi.mock("@/lib/db/outcome-records", () => ({
  listOutcomeRecords: vi.fn(async () => []),
}));

vi.mock("@/lib/db/learning", () => ({
  listOutcomeHistory: vi.fn(async () => []),
}));

const storedRecs: {
  id: string;
  category: string;
  title: string;
  entityId?: string;
  status?: string;
  createdAt: string;
  predictionAccuracy?: number;
}[] = [];

vi.mock("@/lib/db/recommendations", () => ({
  listStoredRecommendations: vi.fn(async () => storedRecs),
  getRecommendationById: vi.fn(async (id: string) => storedRecs.find((r) => r.id === id) ?? null),
}));

describe("applyLearningToOutputs consumes merchant feedback", () => {
  beforeEach(() => {
    storedRecs.length = 0;
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = "x".repeat(32);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lowers confidence for a pattern after not-helpful feedback", async () => {
    const recId = crypto.randomUUID();
    storedRecs.push({
      id: recId,
      category: "campaign_review",
      title: "Pause low ROAS campaign",
      entityId: "camp-99",
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    await saveRecommendationFeedback({
      recommendationId: recId,
      helpful: false,
      reason: "Too aggressive",
      storeId: "demo-store",
    });
    await saveRecommendationFeedback({
      recommendationId: recId,
      helpful: false,
      reason: "Still too aggressive",
      storeId: "demo-store",
    });

    const rows = await listFeedbackForLearning("demo-store");
    expect(rows.length).toBeGreaterThanOrEqual(2);

    const outputs: AnalyzerOutput[] = [
      {
        id: "out-1",
        title: "Pause low ROAS campaign",
        description: "Reduce spend",
        priority: "high",
        expectedImpact: "$500/mo",
        confidence: 0.85,
        evidence: [],
        actions: [],
        category: "campaign_review",
        entityId: "camp-99",
      },
      {
        id: "out-2",
        title: "Unrelated inventory action",
        description: "Restock",
        priority: "medium",
        expectedImpact: "$200/mo",
        confidence: 0.7,
        evidence: [],
        actions: [],
        category: "low_inventory",
        entityId: "prod-1",
      },
    ];

    const learned = await applyLearningToOutputs(outputs, "demo-store");
    const targeted = learned.find((o) => o.entityId === "camp-99");
    const untouched = learned.find((o) => o.entityId === "prod-1");

    expect(targeted).toBeTruthy();
    expect(targeted!.confidence).toBeLessThan(0.85);
    expect(untouched?.confidence).toBeCloseTo(0.7, 1);
  });
});
