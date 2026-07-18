import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSyncFeedback,
  runIntegrationSync,
} from "@/lib/connections/sync-feedback";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("guides top-level users back to Shopify Admin when the session token is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "Unauthorized",
            reason: "missing_session_token",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    const feedback = await runIntegrationSync("/api/shopify/sync", "shopify");

    expect(feedback).toEqual({
      kind: "error",
      message: "Synchronization failed.",
      detail: "Please open StorePilot from your Shopify Admin to perform manual sync.",
    });
    expect(feedback.detail).not.toContain("credentials are invalid");
  });
});
