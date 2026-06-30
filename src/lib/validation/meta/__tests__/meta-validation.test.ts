import { describe, expect, it } from "vitest";
import { runMetaHealthChecks } from "@/lib/validation/meta/health-checks";
import { compareMetaMetrics } from "@/lib/validation/meta/metrics";

describe("meta validation", () => {
  it("compares spend and ROAS within tolerance", () => {
    const dashboard = {
      spend: 100,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      cpc: 0,
      cpm: 0,
      purchases: 0,
      purchaseValue: 250,
      roas: 2.5,
    };
    const api = { ...dashboard, spend: 100.01 };
    const rows = compareMetaMetrics(dashboard, api);
    expect(rows.find((r) => r.metric === "Spend")?.match).toBe(true);
    expect(rows.find((r) => r.metric === "ROAS")?.match).toBe(true);
  });

  it("flags delivery metrics when dashboard has no rollup data", () => {
    const dashboard = {
      spend: 50,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      cpc: 0,
      cpm: 0,
      purchases: 0,
      purchaseValue: 100,
      roas: 2,
    };
    const api = { ...dashboard, impressions: 1000, clicks: 40, ctr: 4 };
    const rows = compareMetaMetrics(dashboard, api);
    expect(rows.find((r) => r.metric === "Impressions")?.match).toBe(false);
    expect(rows.find((r) => r.metric === "Spend")?.match).toBe(true);
  });

  it("runs health checks for connected installation", () => {
    const checks = runMetaHealthChecks({
      installation: {
        id: "1",
        store_id: "s1",
        meta_user_id: "u1",
        meta_user_name: null,
        business_id: "b1",
        business_name: "Clinifly",
        ad_account_id: "act_123",
        ad_account_name: "Main",
        scopes: ["ads_read", "business_management"],
        status: "active",
        connection_health: "healthy",
        error_message: null,
        installed_at: new Date().toISOString(),
        disconnected_at: null,
        last_sync_at: null,
        token_expires_at: null,
        sync_stats: {
          totalCount: 5,
          activeCount: 3,
          pausedCount: 2,
          draftCount: 0,
          archivedCount: 0,
          deletedCount: 0,
        },
      },
      accountInfo: {
        name: "Main",
        currency: "USD",
        timezone: "America/New_York",
        accountStatus: 1,
      },
      insights: {
        spend: 100,
        impressions: 1000,
        clicks: 50,
        ctr: 5,
        cpc: 2,
        cpm: 10,
        purchases: 3,
        purchaseValue: 200,
        roas: 2,
      },
      campaignCount: 5,
      dashboardGenerated: true,
      tokenValid: true,
    });

    expect(checks.every((c) => c.passed)).toBe(true);
  });
});
