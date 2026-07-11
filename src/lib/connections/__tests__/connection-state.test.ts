import { describe, expect, it } from "vitest";
import {
  humanizeSyncError,
  resolveGa4ConnectionPresentation,
  resolveGoogleAdsConnectionPresentationV2,
} from "@/lib/connections/connection-state";

describe("resolveGa4ConnectionPresentation", () => {
  it("never shows Connected when OAuth exists but no property is selected", () => {
    const pres = resolveGa4ConnectionPresentation({
      oauthConfigured: true,
      isDemo: false,
      install: {
        id: "g1",
        store_id: "s1",
        google_user_id: "u1",
        google_user_email: "a@b.com",
        account_id: "acc",
        account_name: null,
        property_id: "",
        property_name: null,
        data_stream_id: null,
        data_stream_name: null,
        measurement_id: null,
        scopes: [],
        status: "active",
        connection_health: "healthy",
        error_message: null,
        installed_at: new Date().toISOString(),
        disconnected_at: null,
        last_sync_at: null,
        token_expires_at: null,
      },
      cachedSnapshot: { sessions30d: 5200 } as never,
    });

    expect(pres.state).toBe("connected_warning");
    expect(pres.health.accountOrProperty.status).toBe("fail");
    expect(pres.guidanceMessage).toContain("no GA4 property has been selected");
    expect(pres.showCachedMetrics).toBe(false);
  });

  it("shows sync failed with cached data note when sync errors but history exists", () => {
    const lastSync = "2026-06-29T12:00:00Z";
    const pres = resolveGa4ConnectionPresentation({
      oauthConfigured: true,
      isDemo: false,
      install: {
        id: "g1",
        store_id: "s1",
        google_user_id: "u1",
        google_user_email: null,
        account_id: "acc",
        account_name: null,
        property_id: "123",
        property_name: "Peak Store",
        data_stream_id: null,
        data_stream_name: null,
        measurement_id: "G-XXXX",
        scopes: [],
        status: "active",
        connection_health: "error",
        error_message: "No GA4 property connected",
        installed_at: new Date().toISOString(),
        disconnected_at: null,
        last_sync_at: lastSync,
        token_expires_at: null,
      },
      cachedSnapshot: { sessions30d: 5200, syncedAt: lastSync } as never,
    });

    expect(pres.state).toBe("sync_failed");
    expect(pres.statusLabel).toBe("Sync Failed");
    expect(pres.showCachedMetrics).toBe(true);
    expect(pres.cachedDataNote).toContain("6/29/2026");
  });

  it("shows healthy connected when property selected and last sync succeeded", () => {
    const pres = resolveGa4ConnectionPresentation({
      oauthConfigured: true,
      isDemo: false,
      install: {
        id: "g1",
        store_id: "s1",
        google_user_id: "u1",
        google_user_email: null,
        account_id: "acc",
        account_name: null,
        property_id: "123",
        property_name: "Peak Store",
        data_stream_id: null,
        data_stream_name: null,
        measurement_id: "G-XXXX",
        scopes: [],
        status: "active",
        connection_health: "healthy",
        error_message: null,
        installed_at: new Date().toISOString(),
        disconnected_at: null,
        last_sync_at: "2026-07-10T10:00:00Z",
        token_expires_at: null,
      },
      cachedSnapshot: { sessions30d: 5200 } as never,
    });

    expect(pres.state).toBe("connected");
    expect(pres.health.overallLabel).toBe("Healthy");
  });
});

describe("humanizeSyncError", () => {
  it("rewrites technical GA4 property errors", () => {
    expect(humanizeSyncError("No GA4 property connected", "Google Analytics")).toContain(
      "no GA4 property has been selected",
    );
  });
});

describe("resolveGoogleAdsConnectionPresentationV2", () => {
  it("maps explicit errors to sync_failed", () => {
    const pres = resolveGoogleAdsConnectionPresentationV2({
      connected: true,
      oauthConfigured: true,
      installations: [
        {
          status: "active",
          connection_health: "error",
          error_message: "PERMISSION_DENIED",
          last_sync_at: "2026-07-07T12:00:00Z",
        },
      ],
    });
    expect(pres.state).toBe("sync_failed");
    expect(pres.errorReason).toContain("Permission denied");
  });
});
