import { beforeEach, describe, expect, it } from "vitest";
import { clearRejectionFeedbackMemory, recordDecisionRejectionFeedback } from "@/lib/db/decision-feedback";
import { DEMO_STORE_ID } from "@/lib/types";

describe("decision rejection feedback", () => {
  beforeEach(() => {
    clearRejectionFeedbackMemory();
  });

  it("persists rejection reason in memory", async () => {
    const { id } = await recordDecisionRejectionFeedback({
      storeId: DEMO_STORE_ID,
      reason: "need_more_evidence",
      decisionId: "dec-1",
      recommendationId: "00000000-0000-4000-8000-000000000099",
    });
    expect(id).toBeTruthy();
  });
});
