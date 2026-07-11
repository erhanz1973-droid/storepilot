import { describe, expect, it } from "vitest";
import { buildSyncFeedback } from "@/lib/connections/sync-feedback";

describe("buildSyncFeedback", () => {
  it("builds Meta success message with campaign count", () => {
    const feedback = buildSyncFeedback("meta_ads", {
      ok: true,
      syncedAt: "2026-06-26T12:00:00.000Z",
      campaigns: 3,
      spend30d: 120,
    });

    expect(feedback.kind).toBe("success");
    expect(feedback.message).toContain("Meta Ads sync completed");
    expect(feedback.detail).toContain("3 campaigns");
  });
});
