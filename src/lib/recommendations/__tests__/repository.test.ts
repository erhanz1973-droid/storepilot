import { beforeEach, describe, expect, it } from "vitest";
import {
  RecommendationRepository,
  clearRecommendationMemoryForTests,
  getRecommendationMemoryEvents,
} from "@/lib/recommendations/repository";
import type { CreateRecommendationInput } from "@/lib/recommendations/types";
import { DEMO_STORE_ID } from "@/lib/types";

function sampleInput(overrides?: Partial<CreateRecommendationInput>): CreateRecommendationInput {
  return {
    storeId: DEMO_STORE_ID,
    dedupeKey: "camp-test-1",
    recommendationType: "campaign_review",
    priority: "high",
    title: "Review campaign",
    description: "Campaign underperforming",
    reason: "ROAS below target",
    expectedImpact: "$500/mo",
    confidence: 0.82,
    validationScore: 99,
    estimatedRevenueGain: 500,
    estimatedCostSaving: null,
    evidence: {
      supportingMetrics: [{ label: "ROAS", value: "1.2x" }],
      providerSources: ["meta"],
    },
    ...overrides,
  };
}

describe("RecommendationRepository", () => {
  const repo = new RecommendationRepository();

  beforeEach(() => {
    clearRecommendationMemoryForTests();
  });

  it("upserts and finds by id and dedupe key", async () => {
    const { record, created } = await repo.upsert(sampleInput());
    expect(created).toBe(true);
    expect(record.dedupeKey).toBe("camp-test-1");
    expect(record.validationScore).toBe(99);
    expect(record.evidence.providerSources).toEqual(["meta"]);

    const byId = await repo.findById(record.id);
    expect(byId?.title).toBe("Review campaign");

    const byKey = await repo.findByDedupeKey(DEMO_STORE_ID, "camp-test-1");
    expect(byKey?.id).toBe(record.id);
  });

  it("preserves status on upsert update", async () => {
    const { record } = await repo.upsert(sampleInput());
    await repo.updateRawStatus(record.id, "approved");

    const { record: updated, created } = await repo.upsert(
      sampleInput({ title: "Updated title" }),
    );
    expect(created).toBe(false);
    expect(updated.status).toBe("approved");
    expect(updated.title).toBe("Updated title");
  });

  it("appends and lists events", async () => {
    const { record } = await repo.upsert(sampleInput());
    await repo.appendEvent({
      recommendationId: record.id,
      eventType: "RecommendationCreated",
      payloadJson: { source: "test" },
    });

    const events = await repo.listEvents(record.id);
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("RecommendationCreated");
  });

  it("lists store recommendations ordered by createdAt desc", async () => {
    await repo.upsert(sampleInput({ dedupeKey: "a" }));
    await repo.upsert(sampleInput({ dedupeKey: "b" }));
    const rows = await repo.findByStoreId(DEMO_STORE_ID);
    expect(rows.length).toBe(2);
  });
});

describe("RecommendationRepository memory events", () => {
  const repo = new RecommendationRepository();

  beforeEach(() => {
    clearRecommendationMemoryForTests();
  });

  it("stores events in memory when supabase is unavailable", async () => {
    const { record } = await repo.upsert(sampleInput());
    await repo.appendEvent({
      recommendationId: record.id,
      eventType: "RecommendationViewed",
    });
    expect(getRecommendationMemoryEvents()).toHaveLength(1);
  });
});
