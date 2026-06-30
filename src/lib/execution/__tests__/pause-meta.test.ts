import { describe, expect, it, vi, beforeEach } from "vitest";
import { DEMO_STORE_SNAPSHOT } from "@/lib/connectors/demo-data";
import { getExecutionMode } from "@/lib/execution/config";
import { buildMetaPauseCampaignRequest } from "@/lib/meta/campaign-mutations";

const mockInstallation = {
  id: "inst-1",
  store_id: "demo",
  ad_account_id: "act_123",
  ad_account_name: "Demo Account",
  accessToken: "test-token",
  connection_health: "healthy" as const,
  status: "active" as const,
  meta_user_id: "u1",
  meta_user_name: null,
  business_id: "b1",
  business_name: null,
  scopes: ["ads_management"],
  error_message: null,
  installed_at: new Date().toISOString(),
  disconnected_at: null,
  last_sync_at: null,
  token_expires_at: null,
  sync_stats: { totalCount: 1, activeCount: 1, pausedCount: 0 },
};

vi.mock("@/lib/db/meta-ads", () => ({
  getSelectedMetaAdsInstallationWithToken: vi.fn(async () => mockInstallation),
}));

vi.mock("@/lib/connectors/registry", () => ({
  aggregateStoreSnapshot: vi.fn(async () => DEMO_STORE_SNAPSHOT),
}));

vi.mock("@/lib/meta/campaign-mutations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/meta/campaign-mutations")>();
  return {
    ...actual,
    fetchMetaCampaign: vi.fn(async () => ({
      id: "camp-1",
      name: "Summer Sale",
      effectiveStatus: "ACTIVE",
      accountId: "act_123",
    })),
    pauseMetaCampaignLive: vi.fn(async () => ({ success: true, response: { success: true } })),
  };
});

vi.mock("@/lib/meta/store-sync", () => ({
  syncMetaAdsForStore: vi.fn(async () => ({ campaigns: [] })),
}));

vi.mock("@/lib/db/action-executions", () => ({
  insertActionExecution: vi.fn(async (input) => ({
    id: "log-1",
    storeId: input.storeId,
    decisionId: input.decisionId ?? null,
    recommendationId: input.recommendationId ?? null,
    opportunityKey: input.opportunityKey ?? null,
    actionType: input.actionType,
    platform: input.platform,
    entityType: input.entityType,
    entityId: input.entityId,
    entityName: input.entityName,
    executionMode: input.executionMode,
    status: input.status,
    approvedBy: input.approvedBy ?? "Merchant",
    requestPayload: input.requestPayload,
    responsePayload: input.responsePayload ?? null,
    errorMessage: input.errorMessage ?? null,
    executedAt: new Date().toISOString(),
  })),
}));

describe("Pause Meta Campaign execution", () => {
  beforeEach(() => {
    vi.stubEnv("STOREPILOT_EXECUTION_MODE", "dry_run");
  });

  it("defaults to dry run mode", () => {
    expect(getExecutionMode()).toBe("dry_run");
  });

  it("builds the exact Meta pause request payload", () => {
    const request = buildMetaPauseCampaignRequest({
      campaignId: "120330",
      campaignName: "Summer Sale",
      adAccountId: "act_123",
    });
    expect(request.method).toBe("POST");
    expect(request.body.status).toBe("PAUSED");
    expect(request.url).toContain("/120330");
    expect(request.adAccountId).toBe("act_123");
  });

  it("validates and logs without calling Meta in dry run", async () => {
    const { executePauseMetaCampaign } = await import("@/lib/execution/engine");
    const campaign = DEMO_STORE_SNAPSHOT.campaigns[0];

    const outcome = await executePauseMetaCampaign({
      storeId: "demo-store",
      actionType: "pause_campaign",
      platform: "meta_ads",
      entityType: "campaign",
      entityId: campaign.id,
      entityName: campaign.name,
      decisionId: "dec-1",
      opportunityKey: "meta-low-purchase-1",
      approvedBy: "Erhan",
    });

    expect(outcome.success).toBe(true);
    expect(outcome.executed).toBe(false);
    expect(outcome.mode).toBe("dry_run");
    expect(outcome.status).toBe("ready");
    expect(outcome.message).toContain("ready to be executed");
    expect(outcome.request?.campaignId).toBe(campaign.id);
  });
});
