import type {
  AdvertisingCampaignRow,
  AdvertisingWorkspaceView,
  AiManagerSummary,
  CampaignSpotlight,
  CreativeIntelRow,
  HealthExplanationItem,
  OptimizationPackage,
  PackageSimulation,
  TimelineEntry,
} from "./types";
import { RECOMMENDATION_LABELS } from "@/lib/analytics/marketing-recommendations";
import { buildExpertNarrative } from "./build-ai-accountability";

function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function buildHealthExplanations(
  workspace: Pick<
    AdvertisingWorkspaceView,
    "overview" | "campaigns" | "creatives" | "audiences" | "platforms"
  >,
): HealthExplanationItem[] {
  const items: HealthExplanationItem[] = [];
  const pool = workspace.campaigns;

  const broad = workspace.audiences.find((a) => a.type === "broad");
  if (broad && broad.roas < 2) {
    items.push({
      label: "Broad audience performance is weak",
      severity: broad.roas < 1.2 ? "high" : "medium",
    });
  }

  const weakCtr = workspace.creatives.filter((c) => c.ctrTrend === "down" || c.creativeScore < 45);
  if (weakCtr.length > 0) {
    items.push({
      label: "CTR is below benchmark on key creatives",
      severity: weakCtr.length >= 2 ? "high" : "medium",
    });
  }

  const highCpa = pool.filter(
    (c) => c.spend > 500 && c.roas > 0 && c.roas < (c.breakEvenRoas ?? 2),
  );
  if (highCpa.length > 0) {
    items.push({
      label: "CPA is significantly above target on underperforming campaigns",
      severity: "high",
    });
  }

  const risingFreq = workspace.creatives.filter((c) => c.frequency > 2.5 || c.fatigue === "high");
  if (risingFreq.length > 0) {
    items.push({
      label: "Frequency is increasing — creative fatigue risk",
      severity: "medium",
    });
  }

  const wasteAudience = workspace.audiences.filter((a) => a.estimatedWasteMonthly > 200);
  if (wasteAudience.length > 0) {
    items.push({
      label: "Audience overlap is wasting budget",
      severity: "high",
    });
  }

  if (items.length === 0 && workspace.overview.healthScore < 70) {
    items.push({
      label: "Several campaigns need optimization to reach break-even ROAS",
      severity: "medium",
    });
  }

  if (items.length === 0) {
    items.push({ label: "Performance is stable — monitor for changes", severity: "low" });
  }

  return items.slice(0, 5);
}

export function buildAiManagerSummary(
  workspace: Pick<
    AdvertisingWorkspaceView,
    "campaigns" | "platforms" | "overview" | "optimizationPackages" | "audiences" | "topWinners" | "topLosers"
  >,
): AiManagerSummary {
  const pool = workspace.campaigns;
  const connectedPlatforms = workspace.platforms.filter((p) => p.connected).length;

  const losingMoney = pool.filter((c) => c.profit < 0 && c.spend > 100);
  const scaleReady = pool.filter(
    (c) =>
      c.profit > 0 &&
      (c.recommendation === "scale" ||
        c.recommendation === "increase_budget" ||
        c.recommendation === "healthy"),
  );
  const wasteAudiences = workspace.audiences.filter((a) => a.estimatedWasteMonthly > 150);

  const expectedProfit =
    workspace.optimizationPackages.reduce((s, p) => s + p.expectedProfitMonthly, 0) ||
    workspace.overview.expectedMonthlyProfitImprovement;

  const narrative = buildExpertNarrative({
    campaigns: pool,
    platforms: workspace.platforms,
    topLosers: workspace.topLosers,
    topWinners: workspace.topWinners,
    optimizationPackages: workspace.optimizationPackages,
  });

  return {
    headline: "AI Advertising Manager",
    intro: `We scanned all ${pool.length} campaign${pool.length === 1 ? "" : "s"} across ${connectedPlatforms || "your"} connected advertising platform${connectedPlatforms === 1 ? "" : "s"}.`,
    narrative,
    campaignCount: pool.length,
    platformCount: connectedPlatforms,
    losingMoneyCount: losingMoney.length,
    scaleReadyCount: scaleReady.length,
    wasteAudienceCount: wasteAudiences.length,
    expectedMonthlyProfitImprovement: expectedProfit,
    confidencePct: workspace.overview.aiConfidencePct,
    insights: [
      { label: "campaigns losing money", count: losingMoney.length },
      { label: "campaigns ready for budget increases", count: scaleReady.length },
      { label: "audiences wasting spend", count: wasteAudiences.length },
    ].filter((i) => i.count > 0),
  };
}

function spotlightReason(c: AdvertisingCampaignRow, kind: "winner" | "loser"): string {
  if (kind === "winner") {
    if (c.recommendation === "scale" || c.recommendation === "increase_budget") {
      return `Strong ROAS (${c.roas.toFixed(2)}) with positive profit — ${RECOMMENDATION_LABELS[c.recommendation]}.`;
    }
    return `Top performer with ${fmtMoney(c.profit)} profit and ROAS ${c.roas.toFixed(2)}.`;
  }
  if (c.profit < 0) {
    return `Losing ${fmtMoney(Math.abs(c.profit))} — ${c.nextAction}.`;
  }
  if (c.recommendation === "pause_campaign") {
    return "Pause recommended — budget waste without return.";
  }
  if (c.recommendation === "improve_creative") {
    return "Creative fatigue detected — refresh before scaling.";
  }
  return `${c.recommendationLabel} — ${c.nextAction}.`;
}

function buildTimelinePreview(
  campaign: AdvertisingCampaignRow,
  timelines: TimelineEntry[],
  allowSynthetic: boolean,
): TimelineEntry[] {
  const existing = timelines.filter((t) => t.campaignId === campaign.id);
  if (existing.length >= 3 || !allowSynthetic) return existing.slice(0, 4);

  const synthetic: TimelineEntry[] = [];
  if (campaign.trend === "down" || campaign.healthScore < 50) {
    synthetic.push({
      id: `${campaign.id}-ctr`,
      campaignId: campaign.id,
      date: "Jul 3",
      type: "creative",
      label: "CTR dropped",
    });
    synthetic.push({
      id: `${campaign.id}-freq`,
      campaignId: campaign.id,
      date: "Jul 5",
      type: "budget",
      label: "Frequency increased",
    });
    synthetic.push({
      id: `${campaign.id}-cpa`,
      campaignId: campaign.id,
      date: "Jul 7",
      type: "budget",
      label: "CPA doubled",
    });
  }
  synthetic.push({
    id: `${campaign.id}-today`,
    campaignId: campaign.id,
    date: "Today",
    type: "recommendation",
    label: `AI recommends: ${campaign.nextAction}`,
    detail: campaign.recommendationLabel,
  });
  return [...existing, ...synthetic].slice(0, 4);
}

export function buildCampaignSpotlights(
  campaigns: AdvertisingCampaignRow[],
  timelines: TimelineEntry[],
  allowSynthetic = false,
): { topWinners: CampaignSpotlight[]; topLosers: CampaignSpotlight[] } {
  const pool = campaigns;

  const winners = [...pool]
    .filter((c) => c.profit > 0 || c.roas >= 2.5)
    .sort((a, b) => b.profit - a.profit || b.roas - a.roas)
    .slice(0, 3);

  const losers = [...pool]
    .filter(
      (c) =>
        c.profit < 0 ||
        c.recommendation === "pause_campaign" ||
        c.recommendation === "reduce_budget" ||
        c.healthScore < 40,
    )
    .sort((a, b) => a.profit - b.profit || a.healthScore - b.healthScore)
    .slice(0, 3);

  const toSpotlight = (c: AdvertisingCampaignRow, kind: "winner" | "loser"): CampaignSpotlight => ({
    id: c.id,
    campaign: c.campaign,
    platformLabel: c.platformLabel,
    roas: c.roas,
    profit: c.profit,
    healthScore: c.healthScore,
    recommendationLabel: c.recommendationLabel,
    nextAction: c.nextAction,
    reason: spotlightReason(c, kind),
    timelinePreview: buildTimelinePreview(c, timelines, allowSynthetic),
  });

  return {
    topWinners: winners.map((c) => toSpotlight(c, "winner")),
    topLosers: losers.map((c) => toSpotlight(c, "loser")),
  };
}

export function enrichPackagesWithSimulation(
  packages: OptimizationPackage[],
  campaigns: AdvertisingCampaignRow[],
): OptimizationPackage[] {
  return packages.map((pkg) => {
    const camp = pkg.campaignId
      ? campaigns.find((c) => c.id === pkg.campaignId)
      : undefined;
    const baseRoas = camp?.roas ?? 2.1;
    const uplift = pkg.expectedProfitMonthly > 0 ? 0.15 : 0.08;
    const expectedRoas = Math.round((baseRoas + uplift) * 100) / 100;

    const simulation: PackageSimulation = {
      expectedProfitMonthly: pkg.expectedProfitMonthly,
      expectedRoas,
      risk: pkg.risk,
      rollbackAvailable: pkg.rollbackAvailable,
      confidencePct: pkg.confidencePct,
      narrative: pkg.campaignName
        ? `If you apply this package on ${pkg.campaignName}, we project +${fmtMoney(pkg.expectedProfitMonthly)}/month with ROAS moving toward ${expectedRoas.toFixed(2)}.`
        : `If you apply this recommendation, we project +${fmtMoney(pkg.expectedProfitMonthly)}/month with ${pkg.confidencePct}% confidence.`,
    };

    return { ...pkg, simulation };
  });
}

export function enrichCreativesWithSuggestions(creatives: CreativeIntelRow[]): CreativeIntelRow[] {
  return creatives.map((c) => {
    const fatigueScore =
      c.fatigue === "high" ? 82 : c.fatigue === "medium" ? 58 : 28;

    const suggestions =
      c.creativeScore >= 70
        ? {
            headline: "Keep current hook — test social proof variant",
            cta: "Try urgency-led CTA (Limited time)",
            estimatedUpliftPct: 8,
          }
        : c.fatigue === "high" || c.ctrTrend === "down"
          ? {
              headline: "Replace opening hook — lead with product benefit",
              cta: "Switch to Shop Now with free-shipping message",
              imageReplacement: "Test UGC-style video or lifestyle image",
              estimatedUpliftPct: 22,
            }
          : {
              headline: "A/B test headline with question format",
              cta: "Test Learn More vs Get Yours Today",
              estimatedUpliftPct: 12,
            };

    return {
      ...c,
      fatigueScore,
      suggestions,
      aiCommentary:
        c.problems.length > 0
          ? `This creative is showing ${c.problems.map((p) => p.label.toLowerCase()).join(", ")}. Refreshing the hook could recover an estimated ${suggestions.estimatedUpliftPct}% uplift in CTR.`
          : c.aiCommentary,
    };
  });
}

export function buildAiManagerLayer(
  workspace: AdvertisingWorkspaceView,
  options?: { allowSyntheticTimelines?: boolean },
) {
  const allowSynthetic = options?.allowSyntheticTimelines ?? false;
  const healthExplanations = buildHealthExplanations(workspace);
  const { topWinners, topLosers } = buildCampaignSpotlights(
    workspace.campaigns,
    workspace.timelines,
    allowSynthetic,
  );
  const optimizationPackages = enrichPackagesWithSimulation(
    workspace.optimizationPackages,
    workspace.campaigns,
  );
  const creatives = enrichCreativesWithSuggestions(workspace.creatives);
  const aiManager = buildAiManagerSummary({
    ...workspace,
    topWinners,
    topLosers,
    optimizationPackages,
  });

  return {
    aiManager,
    healthExplanations,
    topWinners,
    topLosers,
    optimizationPackages,
    creatives,
  };
}
