import { beforeEach, describe, expect, it } from "vitest";
import {
  memoryRecommendations,
  mirrorDecisionToRecommendations,
  reconcileStaleRecommendations,
  seedMemoryRecommendation,
} from "@/lib/db/recommendations";
import { clearRecommendationMemoryForTests } from "@/lib/recommendations/repository";
import { DEMO_STORE_ID } from "@/lib/types";

function seedRecommendation(overrides: {
  id: string;
  dedupe_key: string;
  status?: "pending" | "approved" | "completed" | "implemented" | "ignored";
  entity_id?: string;
  entity_type?: string;
}) {
  seedMemoryRecommendation(overrides);
}

describe("reconcileStaleRecommendations", () => {
  beforeEach(() => {
    clearRecommendationMemoryForTests();
  });

  it("expires pending rows no longer emitted by analyzers", async () => {
    seedRecommendation({ id: "rec-1", dedupe_key: "camp-old", entity_id: "old" });
    seedRecommendation({ id: "rec-2", dedupe_key: "camp-active", entity_id: "active" });

    const reconciled = await reconcileStaleRecommendations(
      DEMO_STORE_ID,
      new Set(["camp-active"]),
    );

    expect(reconciled).toBe(1);
    expect(memoryRecommendations.get("rec-1")?.status).toBe("expired");
    expect(memoryRecommendations.get("rec-2")?.status).toBe("pending");
  });

  it("does not auto-complete approved campaign reviews", async () => {
    seedRecommendation({
      id: "rec-1",
      dedupe_key: "camp-old",
      status: "approved",
      entity_id: "old",
    });

    const reconciled = await reconcileStaleRecommendations(DEMO_STORE_ID, new Set());

    expect(reconciled).toBe(0);
    expect(memoryRecommendations.get("rec-1")?.status).toBe("approved");
  });

  it("does not auto-complete implemented rows", async () => {
    seedRecommendation({
      id: "rec-1",
      dedupe_key: "camp-old",
      status: "implemented",
      entity_id: "old",
    });

    const reconciled = await reconcileStaleRecommendations(DEMO_STORE_ID, new Set());

    expect(reconciled).toBe(0);
    expect(memoryRecommendations.get("rec-1")?.status).toBe("implemented");
  });

  it("does not change completed or ignored rows", async () => {
    seedRecommendation({
      id: "rec-1",
      dedupe_key: "camp-old",
      status: "completed",
      entity_id: "old",
    });
    seedRecommendation({
      id: "rec-2",
      dedupe_key: "camp-ignored",
      status: "ignored",
      entity_id: "ignored",
    });

    const reconciled = await reconcileStaleRecommendations(DEMO_STORE_ID, new Set());

    expect(reconciled).toBe(0);
    expect(memoryRecommendations.get("rec-1")?.status).toBe("completed");
    expect(memoryRecommendations.get("rec-2")?.status).toBe("ignored");
  });
});

describe("mirrorDecisionToRecommendations", () => {
  beforeEach(() => {
    clearRecommendationMemoryForTests();
  });

  it("approves matching campaign recommendation by entity id", async () => {
    seedRecommendation({ id: "rec-1", dedupe_key: "camp-123", entity_id: "123" });

    await mirrorDecisionToRecommendations(DEMO_STORE_ID, "approve", {
      entityType: "campaign",
      entityId: "123",
      opportunityKey: "meta-low-purchase-123",
    });

    expect(memoryRecommendations.get("rec-1")?.status).toBe("approved");
  });

  it("approves matching campaign recommendation even when completed", async () => {
    seedRecommendation({
      id: "rec-1",
      dedupe_key: "camp-act_123:999",
      status: "completed",
      entity_id: "act_123:999",
    });

    await mirrorDecisionToRecommendations(DEMO_STORE_ID, "approve", {
      entityType: "campaign",
      entityId: "999",
      opportunityKey: "meta-low-purchase-999",
    });

    expect(memoryRecommendations.get("rec-1")?.status).toBe("approved");
  });

  it("ignores unrelated recommendations", async () => {
    seedRecommendation({ id: "rec-1", dedupe_key: "camp-999", entity_id: "999" });

    await mirrorDecisionToRecommendations(DEMO_STORE_ID, "reject", {
      entityType: "campaign",
      entityId: "123",
      opportunityKey: "meta-low-purchase-123",
    });

    expect(memoryRecommendations.get("rec-1")?.status).toBe("pending");
  });
});
