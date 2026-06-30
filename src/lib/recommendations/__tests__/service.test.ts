import { beforeEach, describe, expect, it } from "vitest";
import {
  RecommendationRepository,
  clearRecommendationMemoryForTests,
} from "@/lib/recommendations/repository";
import { RecommendationService } from "@/lib/recommendations/service";
import type { AnalyzerOutput } from "@/lib/types";
import { DEMO_STORE_ID } from "@/lib/types";
import {
  assertValidStatusTransition,
  createRecommendationSchema,
} from "@/lib/recommendations/validators";

function analyzerOutput(id: string): AnalyzerOutput {
  return {
    id,
    title: "Low inventory",
    description: "SKU running low",
    priority: "high",
    expectedImpact: "$200/mo",
    confidence: 0.75,
    evidence: [{ label: "Days cover", value: "4" }],
    actions: [{ label: "Review", type: "review" }],
    category: "low_inventory",
    validation: {
      aiConfidence: 0.75,
      validationConfidence: 0.99,
      finalConfidence: 0.74,
      validationScore: 99,
      providersUsed: ["shopify"],
      providersBlocked: [],
      providersWarned: [],
      evidence: [],
      calculationBasis: [],
      dateRangeVerified: true,
      blocked: false,
    },
  };
}

describe("RecommendationService", () => {
  let repo: RecommendationRepository;
  let service: RecommendationService;

  beforeEach(() => {
    clearRecommendationMemoryForTests();
    repo = new RecommendationRepository();
    service = new RecommendationService(repo);
  });

  it("creates recommendation and RecommendationCreated event", async () => {
    const record = await service.create({
      storeId: DEMO_STORE_ID,
      dedupeKey: "inv-1",
      recommendationType: "low_inventory",
      priority: "high",
      title: "Restock",
      description: "Low stock",
      reason: "Low stock",
      expectedImpact: "$100",
      confidence: 0.8,
      validationScore: 98,
      evidence: { supportingMetrics: [], providerSources: ["shopify"] },
    });

    const events = await service.listEvents(record.id);
    expect(events.some((e) => e.eventType === "RecommendationCreated")).toBe(true);
    expect(record.confidence).toBe(0.8);
    expect(record.validationScore).toBe(98);
  });

  it("syncs analyzer outputs and emits events for new records", async () => {
    const records = await service.syncFromAnalyzerOutputs(
      [analyzerOutput("inv-sync-1")],
      DEMO_STORE_ID,
    );
    expect(records).toHaveLength(1);
    expect(records[0]?.confidence).toBe(0.74);
    expect(records[0]?.validationScore).toBe(99);
    expect(records[0]?.evidence.providerSources).toEqual(["shopify"]);

    const events = await service.listEvents(records[0]!.id);
    expect(events.some((e) => e.eventType === "RecommendationCreated")).toBe(true);
  });

  it("approves pending recommendation and logs event", async () => {
    const created = await service.create({
      storeId: DEMO_STORE_ID,
      dedupeKey: "inv-2",
      recommendationType: "low_inventory",
      priority: "medium",
      title: "Restock",
      description: "Low stock",
      reason: "Low stock",
      expectedImpact: "$100",
      confidence: 0.8,
      evidence: { supportingMetrics: [], providerSources: [] },
    });

    const approved = await service.approve(created.id, { note: "Looks good" });
    expect(approved.status).toBe("approved");

    const events = await service.listEvents(created.id);
    expect(events.some((e) => e.eventType === "RecommendationApproved")).toBe(true);
  });

  it("rejects and dismisses with events", async () => {
    const a = await service.create({
      storeId: DEMO_STORE_ID,
      dedupeKey: "inv-3",
      recommendationType: "low_inventory",
      priority: "low",
      title: "A",
      description: "A",
      reason: "A",
      expectedImpact: "$1",
      confidence: 0.5,
      evidence: { supportingMetrics: [], providerSources: [] },
    });
    const b = await service.create({
      storeId: DEMO_STORE_ID,
      dedupeKey: "inv-4",
      recommendationType: "low_inventory",
      priority: "low",
      title: "B",
      description: "B",
      reason: "B",
      expectedImpact: "$1",
      confidence: 0.5,
      evidence: { supportingMetrics: [], providerSources: [] },
    });

    await service.reject(a.id);
    await service.dismiss(b.id);

    expect((await service.getById(a.id))?.status).toBe("rejected");
    expect((await service.getById(b.id))?.status).toBe("dismissed");
  });

  it("reconciles stale pending recommendations to expired", async () => {
    await service.syncFromAnalyzerOutputs([analyzerOutput("active-1")], DEMO_STORE_ID);
    await service.syncFromAnalyzerOutputs([analyzerOutput("stale-1")], DEMO_STORE_ID);

    const reconciled = await service.reconcileStale(DEMO_STORE_ID, new Set(["active-1"]));
    expect(reconciled).toBe(1);

    const stale = (await service.list(DEMO_STORE_ID)).find((r) => r.dedupeKey === "stale-1");
    expect(stale?.status).toBe("expired");
  });

  it("blocks invalid status transitions", async () => {
    const record = await service.create({
      storeId: DEMO_STORE_ID,
      dedupeKey: "inv-5",
      recommendationType: "low_inventory",
      priority: "low",
      title: "X",
      description: "X",
      reason: "X",
      expectedImpact: "$1",
      confidence: 0.5,
      evidence: { supportingMetrics: [], providerSources: [] },
    });
    await service.reject(record.id);
    await expect(service.approve(record.id)).rejects.toThrow(/Invalid status transition/);
  });
});

describe("recommendation validators", () => {
  it("validates create input schema", () => {
    const parsed = createRecommendationSchema.safeParse({
      storeId: DEMO_STORE_ID,
      dedupeKey: "k1",
      recommendationType: "campaign_review",
      priority: "high",
      title: "T",
      description: "D",
      reason: "R",
      expectedImpact: "$10",
      confidence: 0.9,
      evidence: { supportingMetrics: [], providerSources: ["meta"] },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid confidence", () => {
    const parsed = createRecommendationSchema.safeParse({
      storeId: DEMO_STORE_ID,
      dedupeKey: "k1",
      recommendationType: "campaign_review",
      priority: "high",
      title: "T",
      description: "D",
      reason: "R",
      expectedImpact: "$10",
      confidence: 1.5,
      evidence: { supportingMetrics: [], providerSources: [] },
    });
    expect(parsed.success).toBe(false);
  });

  it("enforces valid status transitions", () => {
    expect(() => assertValidStatusTransition("pending", "approved")).not.toThrow();
    expect(() => assertValidStatusTransition("rejected", "approved")).toThrow();
  });
});
