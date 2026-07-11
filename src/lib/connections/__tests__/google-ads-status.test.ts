import { describe, expect, it } from "vitest";
import { resolveGoogleAdsConnectionPresentation } from "@/lib/connections/google-ads-status";

describe("resolveGoogleAdsConnectionPresentation", () => {
  it("shows Connected when OAuth succeeded but sync never ran", () => {
    const state = resolveGoogleAdsConnectionPresentation({
      connected: true,
      oauthConfigured: true,
      installations: [
        {
          status: "active",
          connection_health: "healthy",
          error_message: null,
          last_sync_at: null,
        },
      ],
    });
    expect(state.status).toBe("connected_warning");
    expect(state.statusLabel).toContain("sync pending");
    expect(state.syncFailed).toBe(false);
    expect(state.primaryAction).toBe("manage");
  });

  it("does not alarm on stale error flag without message", () => {
    const state = resolveGoogleAdsConnectionPresentation({
      connected: true,
      oauthConfigured: true,
      installations: [
        {
          status: "active",
          connection_health: "error",
          error_message: null,
          last_sync_at: null,
        },
      ],
    });
    expect(state.syncFailed).toBe(false);
    expect(state.statusLabel).toContain("sync pending");
  });

  it("shows Needs attention only with explicit error message", () => {
    const state = resolveGoogleAdsConnectionPresentation({
      connected: true,
      oauthConfigured: true,
      installations: [
        {
          status: "active",
          connection_health: "error",
          error_message: "Google Ads API error: PERMISSION_DENIED",
          last_sync_at: null,
        },
      ],
    });
    expect(state.syncFailed).toBe(true);
    expect(state.statusLabel).toBe("Sync Failed");
    expect(state.errorMessage).toContain("Permission denied");
  });

  it("treats zero campaigns after successful sync as Connected", () => {
    const state = resolveGoogleAdsConnectionPresentation({
      connected: true,
      oauthConfigured: true,
      installations: [
        {
          status: "active",
          connection_health: "healthy",
          error_message: null,
          last_sync_at: "2026-06-01T12:00:00Z",
        },
      ],
    });
    expect(state.statusLabel).toBe("Connected");
    expect(state.syncFailed).toBe(false);
  });
});
