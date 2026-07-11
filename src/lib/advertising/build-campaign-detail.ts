import type {
  AdvertisingCampaignRow,
  AdvertisingWorkspaceView,
  CampaignDetailPageData,
  CampaignOutcome,
  CampaignSimulation,
  CreativeIntelRow,
  OptimizationPackage,
} from "./types";
import type { AttributionDashboard } from "@/lib/attribution/models";
import type { EnrichedMarketingCampaign, MarketingManagerView } from "@/lib/analytics/marketing-manager";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { DecisionItem } from "@/lib/decisions/center";
import type { CampaignEntitlements } from "@/lib/billing/types";
import { buildBenchmark } from "./build-workspace";
import { buildAdvertisingHealthFactors } from "./health-breakdown";
import { buildOptimizationPackages } from "./optimization-packages";
import { campaignAnalysisStatus } from "@/lib/billing/entitlements";

function inferPreviewType(name: string): "video" | "ugc" | "carousel" | "image" {
  const lower = name.toLowerCase();
  if (lower.includes("ugc")) return "ugc";
  if (lower.includes("video") || lower.includes("reel")) return "video";
  if (lower.includes("carousel") || lower.includes("catalog")) return "carousel";
  return "image";
}

export function buildCampaignDetailPage(
  campaignId: string,
  input: {
    workspace: AdvertisingWorkspaceView;
    marketing: MarketingManagerView;
    attribution: AttributionDashboard;
    snapshot: StoreSnapshot;
    decisions: DecisionItem[];
    entitlements?: CampaignEntitlements;
  },
): CampaignDetailPageData | null {
  const campaign = input.workspace.campaigns.find((c) => c.id === campaignId);
  if (!campaign) return null;

  const locked =
    input.entitlements != null &&
    !input.entitlements.isUnlimited &&
    campaignAnalysisStatus(campaignId, input.entitlements) === "overview";

  const enriched = input.marketing.campaigns.find((c) => c.id === campaignId);
  const attr = input.attribution.campaigns.find((c) => c.campaignId === campaignId);
  const meta = input.snapshot.campaigns.find((m) => m.id === campaignId);

  const adSets = input.workspace.adSets.filter((a) => a.campaignId === campaignId);
  const ads = input.workspace.ads
    .filter((a) => a.campaignId === campaignId)
    .map((a) => ({
      ...a,
      previewType: inferPreviewType(a.name),
      previewLabel: a.name,
    }));
  const creatives = input.workspace.creatives.filter((c) => c.campaignName === campaign.campaign);
  const audiences = input.workspace.audiences;
  const pkg =
    input.workspace.optimizationPackages.find((p) => p.campaignId === campaignId) ?? null;

  const grossMarginPct = input.attribution.strategyPlan.breakEvenModel.grossMarginPct ?? 58;
  const profitExplanation =
    campaign.roas >= 2 && campaign.profit < 0
      ? {
          explanation:
            "Advertising is efficient on ROAS, but product costs erase margin after attribution.",
          chain: [
            "High product costs",
            "Low gross margin",
            "Advertising profitable on ROAS",
            "Overall campaign not profitable after costs",
          ],
        }
      : {
          explanation:
            campaign.profit >= 0
              ? "Campaign generates positive profit after attributed costs."
              : "Spend exceeds attributed profit — optimization recommended.",
          chain:
            campaign.profit < 0
              ? ["Spend exceeds break-even ROAS", "Negative net profit", "Reduce waste or improve conversion"]
              : ["ROAS above break-even", "Positive contribution margin", "Room to scale"],
        };

  const campaignDecisions = input.decisions.filter(
    (d) => d.entityType === "campaign" && d.entityId === campaignId,
  );

  const simulations: CampaignSimulation[] =
    input.attribution.strategyPlan.simulation.scenarios.slice(0, 3).map((s, i) => ({
      id: `sim-${i}`,
      label: s.label,
      profitDeltaMonthly: Math.round((s.profitDeltaLow + s.profitDeltaHigh) / 2),
      probability: s.probability,
    }));

  const outcomeHistory: CampaignOutcome[] = campaignDecisions
    .filter((d) => d.outcome?.outcomeSummary)
    .slice(0, 5)
    .map((d) => ({
      date: d.outcome?.measuredAt ?? "Pending",
      action: d.summary,
      result: d.outcome?.outcomeSummary ?? "Measuring",
      profitImpact: d.outcome?.predictionAccuracy ?? null,
    }));

  const healthFactors = buildAdvertisingHealthFactors({
    campaigns: [campaign],
    creatives,
    audiences,
    budgetAllocation: input.workspace.budgetAllocation,
    platforms: input.workspace.platforms,
  });

  return {
    syncedAt: input.workspace.syncedAt,
    campaign,
    locked,
    planUsage: input.entitlements,
    executiveSummary: buildExecutiveSummary(campaign, enriched, pkg),
    performanceOverview: {
      spend: campaign.spend,
      revenue: campaign.revenue,
      profit: campaign.profit,
      roas: campaign.roas,
      breakEvenRoas: campaign.breakEvenRoas,
      ctr: meta?.ctr7d ?? enriched?.ctr ?? 2,
      trend: campaign.trend,
    },
    profitability: {
      grossMarginPct,
      netProfit: campaign.profit,
      explanation: profitExplanation.explanation,
      chain: profitExplanation.chain,
    },
    healthFactors,
    adSets,
    ads,
    creatives,
    audiences,
    budgetHistory: buildBudgetHistory(campaignId, input.marketing),
    approvalHistory: campaignDecisions.map((d) => ({
      date: "Recent",
      title: d.summary,
      status: d.status,
    })),
    aiTimeline: input.workspace.timelines.filter((t) => t.campaignId === campaignId),
    optimizationPackage: pkg,
    simulations,
    outcomeHistory,
    benchmarks: buildBenchmark(campaign),
  };
}

function buildExecutiveSummary(
  campaign: AdvertisingCampaignRow,
  enriched: EnrichedMarketingCampaign | undefined,
  pkg: OptimizationPackage | null,
): string {
  const parts = [
    `${campaign.campaign} on ${campaign.platformLabel} — health ${campaign.healthScore}/100 (${campaign.healthTier.replace("_", " ")}).`,
    `Spend $${campaign.spend.toLocaleString()}, revenue $${campaign.revenue.toLocaleString()}, ROAS ${campaign.roas.toFixed(2)}.`,
    campaign.profit < 0
      ? `Losing $${Math.abs(campaign.profit).toLocaleString()} after costs.`
      : `Generating $${campaign.profit.toLocaleString()} profit.`,
  ];
  if (pkg) {
    parts.push(`Top action: ${pkg.title} — expected +$${pkg.expectedProfitMonthly.toLocaleString()}/month.`);
  } else if (enriched) {
    parts.push(`AI recommends: ${campaign.nextAction}.`);
  }
  return parts.join(" ");
}

function buildBudgetHistory(
  campaignId: string,
  marketing: MarketingManagerView,
): { date: string; amount: number; label: string }[] {
  const tl = marketing.v2.campaignTimelines.find((t) => t.campaignId === campaignId);
  if (!tl) {
    return [
      { date: "30d ago", amount: 0, label: "Campaign created" },
      { date: "Today", amount: 0, label: "Current budget" },
    ];
  }
  return [
    { date: tl.periodLabel, amount: 0, label: "Budget baseline" },
    ...tl.metrics.map((m) => ({
      date: tl.periodLabel,
      amount: 0,
      label: m.label,
    })),
  ];
}
