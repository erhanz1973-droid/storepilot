import { describe, expect, it } from "vitest";
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
  it("selects highest-opportunity campaign as default deep analysis target", () => {
    const ws = buildFixtureWorkspace();
    const selected = selectDefaultUnlockedCampaign(ws.campaigns);
    expect(selected).not.toBeNull();
    expect(ws.campaigns.some((c) => c.id === selected!.id)).toBe(true);
  });

  it("free plan scans all campaigns but limits deep analysis to one", () => {
    const ws = buildFixtureWorkspace();
    if (ws.campaigns.length < 2) return;

    const deepId = ws.campaigns[0]!.id;
    const entitlements = buildCampaignEntitlements(ws.campaigns, deepId, "free");
    const limited = applyAdvertisingPlanLimits(ws, entitlements);

    const deep = limited.campaigns.filter((c) => c.analysisStatus === "deep");
    const overview = limited.campaigns.filter((c) => c.analysisStatus === "overview");

    expect(deep).toHaveLength(1);
    expect(overview.length).toBe(ws.campaigns.length - 1);
    expect(limited.campaigns.every((c) => c.spend > 0 || c.spend === 0)).toBe(true);
    expect(limited.overview.analysisScopeNotice).toMatch(/scanned all/i);
    expect(limited.accountSummary.totalCampaigns).toBe(ws.campaigns.length);
    expect(limited.overview.spend30d).toBeGreaterThan(deep[0]!.spend);
  });

  it("starter plan enables deep analysis for all campaigns", () => {
    const ws = buildFixtureWorkspace();
    const entitlements = buildCampaignEntitlements(ws.campaigns, ws.campaigns[0]?.id ?? null, "starter");
    const limited = applyAdvertisingPlanLimits(ws, entitlements);

    expect(limited.campaigns.every((c) => c.analysisStatus === "deep")).toBe(true);
    expect(limited.overview.analysisScopeNotice).toBeUndefined();
  });

  it("builds coverage-first upgrade message", () => {
    const ws = buildFixtureWorkspace();
    const entitlements = buildCampaignEntitlements(ws.campaigns, ws.campaigns[0]?.id ?? null, "free");
    const msg = buildScaleUpgradeMessage(entitlements);
    expect(msg).toContain("scanned all");
    expect(msg).toContain("Deep AI");
    expect(buildAnalysisScopeNotice(entitlements)).toMatch(/account-wide health assessment/i);
  });

  it("blocks copilot deep analysis for overview-only campaigns", () => {
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
    expect(gate.blocked).toBe(true);
    if (gate.blocked) {
      expect(gate.message).toContain("Deep AI");
    }
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
    expect(campaignAnalysisStatus("b", entitlements)).toBe("overview");
  });
});
