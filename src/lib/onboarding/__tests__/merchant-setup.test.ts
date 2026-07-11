import { describe, expect, it } from "vitest";
import { buildMerchantOnboarding } from "../merchant-setup";
import type { IntegrationBoardPayload } from "@/lib/connections/integration-board.types";

describe("buildMerchantOnboarding", () => {
  function board(partial: Partial<IntegrationBoardPayload["items"][0]> & { id: string }): IntegrationBoardPayload {
    const defaults = {
      label: partial.id,
      category: "commerce" as const,
      status: "not_connected" as const,
      statusLabel: "Not connected",
      logoInitial: "X",
      logoAccent: "#000",
      summaryLines: [],
      primaryAction: "connect" as const,
      planned: false,
      health: {} as IntegrationBoardPayload["items"][0]["health"],
      detail: { type: "generic" as const, connected: false, description: "", configured: false },
    };
    return {
      view: {} as IntegrationBoardPayload["view"],
      items: [{ ...defaults, ...partial }],
    };
  }

  it("marks Shopify as current when nothing is connected", () => {
    const state = buildMerchantOnboarding(
      board({
        id: "shopify",
        detail: { type: "shopify", connected: false, isDemo: false } as never,
      }),
    );
    expect(state.steps[0]?.status).toBe("current");
    expect(state.progressPct).toBe(0);
  });

  it("progresses when live Shopify and Meta are connected with campaigns", () => {
    const state = buildMerchantOnboarding({
      view: {} as IntegrationBoardPayload["view"],
      items: [
        {
          id: "shopify",
          label: "Shopify",
          category: "commerce",
          status: "connected",
          statusLabel: "Connected",
          logoInitial: "S",
          logoAccent: "#000",
          summaryLines: [],
          primaryAction: "manage",
          planned: false,
          health: {} as never,
          detail: {
            type: "shopify",
            connected: true,
            isDemo: false,
            storeDomain: "demo.myshopify.com",
            products: 10,
            orders30d: 5,
            revenue30d: 1000,
            lastSyncAt: null,
            shopifyOAuthConfigured: true,
            grantedScopes: [],
            missingWriteScopes: [],
          },
        },
        {
          id: "meta_ads",
          label: "Meta",
          category: "advertising",
          status: "connected",
          statusLabel: "Connected",
          logoInitial: "M",
          logoAccent: "#000",
          summaryLines: [],
          primaryAction: "manage",
          planned: false,
          health: {} as never,
          detail: {
            type: "meta_ads",
            connected: true,
            activeCampaigns: 3,
            metaOAuthConfigured: true,
            businessName: null,
            accountCount: 1,
            lastSyncAt: null,
            pausedCampaigns: 0,
            spend7d: 500,
            accounts: [],
          },
        },
        {
          id: "google_ads",
          label: "Google",
          category: "advertising",
          status: "not_connected",
          statusLabel: "Not connected",
          logoInitial: "G",
          logoAccent: "#000",
          summaryLines: [],
          primaryAction: "connect",
          planned: false,
          health: {} as never,
          detail: {
            type: "google_ads",
            connected: false,
            enabledCampaigns: 0,
            googleOAuthConfigured: false,
            accountCount: 0,
            lastSyncAt: null,
            pausedCampaigns: 0,
            spendToday: 0,
            accounts: [],
          },
        },
      ],
    });
    expect(state.steps[0]?.status).toBe("complete");
    expect(state.steps[1]?.status).toBe("complete");
    expect(state.steps[2]?.status).toBe("current");
    expect(state.steps[3]?.status).toBe("complete");
  });
});
