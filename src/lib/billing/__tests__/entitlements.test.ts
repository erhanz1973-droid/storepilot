import { describe, expect, it, vi } from "vitest";
import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildMarketingManagerView } from "@/lib/analytics/marketing-manager";
import { buildProductAttributionDashboard } from "@/lib/attribution/product-engine";
import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { buildAdvertisingWorkspace } from "@/lib/advertising/build-workspace";
import {
  applyAdvertisingPlanLimits,
  buildCampaignEntitlements,
  campaignAnalysisStatus,
  buildAnalysisScopeNotice,
  buildScaleUpgradeMessage,
  resolveStorePlan,
} from "@/lib/billing/entitlements";
import { campaignMatchesName, selectDefaultUnlockedCampaign } from "@/lib/billing/campaign-selection";
import { checkCopilotCampaignAccess } from "@/lib/billing/copilot-gate";

function buildFixtureWorkspace() {
  const snapshot = getPeakOutfittersSnapshot();
  const profitDashboard = computeProfitDashboard(snapshot, []);
  const productAttribution = buildProductAttributionDashboard(snapshot, [], profitDashboard);
  const marketing = buildMarketingManagerView({
    snapshot,
    profitDashboard,
    productAttribution,
    decisions: [],
  });
  const attribution = buildAttributionDashboard(snapshot, profitDashboard)!;
  return buildAdvertisingWorkspace({
    marketing,
    attribution,
    snapshot,
    decisions: [],
    syncedAt: snapshot.syncedAt,
  });
}

describe("billing entitlements", () => {
  it("always resolves production runtime access to Free Early Access", () => {
    vi.stubEnv("STOREPILOT_PLAN", "pro");
    expect(resolveStorePlan()).toBe("free");
    vi.unstubAllEnvs();
  });

  it("selects highest-opportunity campaign as default deep analysis target", () => {
    const ws = buildFixtureWorkspace();
    const selected = selectDefaultUnlockedCampaign(ws.campaigns);
    expect(selected).not.toBeNull();
    expect(ws.campaigns.some((c) => c.id === selected!.id)).toBe(true);
  });

  it("free plan enables deep analysis for every campaign", () => {
    const ws = buildFixtureWorkspace();
    if (ws.campaigns.length < 2) return;

    const deepId = ws.campaigns[0]!.id;
    const entitlements = buildCampaignEntitlements(ws.campaigns, deepId, "free");
    const limited = applyAdvertisingPlanLimits(ws, entitlements);

    expect(limited.campaigns.every((c) => c.analysisStatus === "deep")).toBe(true);
    expect(entitlements.isUnlimited).toBe(true);
    expect(entitlements.lockedCampaignCount).toBe(0);
    expect(limited.campaigns.every((c) => c.spend > 0 || c.spend === 0)).toBe(true);
    expect(limited.overview.analysisScopeNotice).toBeUndefined();
    expect(limited.accountSummary.totalCampaigns).toBe(ws.campaigns.length);
  });

  it("starter plan enables deep analysis for all campaigns", () => {
    const ws = buildFixtureWorkspace();
    const entitlements = buildCampaignEntitlements(ws.campaigns, ws.campaigns[0]?.id ?? null, "starter");
    const limited = applyAdvertisingPlanLimits(ws, entitlements);

    expect(limited.campaigns.every((c) => c.analysisStatus === "deep")).toBe(true);
    expect(limited.overview.analysisScopeNotice).toBeUndefined();
  });

  it("does not emit paid-plan messaging for free access", () => {
    const ws = buildFixtureWorkspace();
    const entitlements = buildCampaignEntitlements(ws.campaigns, ws.campaigns[0]?.id ?? null, "free");
    const msg = buildScaleUpgradeMessage(entitlements);
    expect(msg).toBe("");
    expect(buildAnalysisScopeNotice(entitlements)).toBe("");
  });

  it("allows copilot deep analysis for every campaign on free", () => {
    const ws = buildFixtureWorkspace();
    const deep = ws.campaigns[0]!;
    const overview = ws.campaigns.find((c) => c.id !== deep.id);
    if (!overview) return;

    const entitlements = buildCampaignEntitlements(ws.campaigns, deep.id, "free");
    const gate = checkCopilotCampaignAccess(
      `Analyze ${overview.campaign}`,
      ws.campaigns.map((c) => ({ id: c.id, campaign: c.campaign })),
      entitlements,
    );
    expect(gate.blocked).toBe(false);
  });

  it("matches campaign names in copilot queries", () => {
    const ws = buildFixtureWorkspace();
    const first = ws.campaigns[0]!;
    const match = campaignMatchesName(
      ws.campaigns.map((c) => ({ id: c.id, campaign: c.campaign })),
      first.campaign,
    );
    expect(match?.id).toBe(first.id);
  });

  it("marks campaign analysis depth correctly", () => {
    const entitlements = buildCampaignEntitlements(
      [{ id: "a", campaign: "A" } as never, { id: "b", campaign: "B" } as never],
      "a",
      "free",
    );
    expect(campaignAnalysisStatus("a", entitlements)).toBe("deep");
    expect(campaignAnalysisStatus("b", entitlements)).toBe("deep");
  });
});
