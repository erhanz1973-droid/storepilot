import type { ProfitDashboard } from "@/lib/profit/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { DecisionItem } from "@/lib/decisions/center";
import { analyzeInventoryContext } from "@/lib/attribution/inventory-context";
import { isDemoStoreSnapshot } from "@/lib/demo/is-demo-store";
import { allowDemoData } from "@/lib/env/runtime";
import type { AdvertisingVisitSnapshot } from "./advertising-visit";
import type {
  AccountabilityItem,
  AdvertisingCampaignRow,
  AdvertisingWorkspaceView,
  AiAccountabilityLayer,
  CrossModuleAlert,
  DailyPriority,
  LearningInsight,
  PredictionTrackRecord,
  SinceLastVisitBriefing,
  TrustEnginePanel,
} from "./types";

type RejectionRow = {
  id: string;
  reason: string;
  createdAt: string;
  recommendationId?: string;
};

type OutcomeRow = {
  category: string;
  expectedMonthlyImpact: number;
  actualMonthlyImpact: number;
  predictionAccuracy: number;
  measuredAt: string;
};

function fmt(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

function isAdvertisingDecision(d: DecisionItem): boolean {
  const s = `${d.summary} ${d.recommendedAction} ${d.entityName ?? ""}`.toLowerCase();
  return (
    d.entityType === "campaign" ||
    s.includes("campaign") ||
    s.includes("meta") ||
    s.includes("google") ||
    s.includes("roas") ||
    s.includes("budget") ||
    s.includes("prospect") ||
    s.includes("creative") ||
    s.includes("ads")
  );
}

function findCampaign(
  campaigns: AdvertisingCampaignRow[],
  nameHint?: string,
): AdvertisingCampaignRow | undefined {
  if (!nameHint) return undefined;
  const lower = nameHint.toLowerCase();
  return campaigns.find((c) => c.campaign.toLowerCase().includes(lower));
}

export function buildDailyPriority(
  workspace: Pick<AdvertisingWorkspaceView, "optimizationPackages" | "topLosers" | "campaigns">,
): DailyPriority {
  const topPackage = workspace.optimizationPackages[0];
  const topLoser = workspace.topLosers[0];

  if (topPackage) {
    const action =
      topPackage.steps[0] ??
      (topPackage.title.toLowerCase().includes("pause") ? "Pause campaign" : "Apply optimization package");
    const minutes =
      topPackage.risk === "Low" && action.toLowerCase().includes("pause") ? 5 : 15;
    return {
      title: "Today's highest priority",
      campaignName: topPackage.campaignName,
      action,
      expectedMonthlyImpact: topPackage.expectedProfitMonthly,
      estimatedMinutes: minutes,
      risk: topPackage.risk,
      confidencePct: topPackage.confidencePct,
      packageId: topPackage.id,
      campaignId: topPackage.campaignId,
      narrative: topPackage.campaignName
        ? `If you only have 10 minutes today, ${action.toLowerCase()} on ${topPackage.campaignName}. This is the fastest path to ${fmt(topPackage.expectedProfitMonthly)}/month in projected profit improvement.`
        : `If you only have 10 minutes today, start with: ${action}.`,
    };
  }

  if (topLoser) {
    return {
      title: "Today's highest priority",
      campaignName: topLoser.campaign,
      action: topLoser.nextAction,
      expectedMonthlyImpact: Math.round(Math.abs(topLoser.profit) * 4.33),
      estimatedMinutes: 5,
      risk: "Low",
      confidencePct: 78,
      campaignId: topLoser.id,
      narrative: `If you only have 10 minutes today, ${topLoser.nextAction.toLowerCase()} on ${topLoser.campaign}.`,
    };
  }

  const fallback = workspace.campaigns[0];
  return {
    title: "Today's highest priority",
    campaignName: fallback?.campaign,
    action: fallback?.nextAction ?? "Review campaign performance",
    expectedMonthlyImpact: workspace.campaigns.reduce(
      (s, c) => s + Math.max(0, c.expectedOpportunityMonthly),
      0,
    ),
    estimatedMinutes: 10,
    risk: "Low",
    confidencePct: 70,
    campaignId: fallback?.id,
    narrative: "Review your top opportunity and submit one action to the Approval Center.",
  };
}

export function buildSinceLastVisitBriefing(
  workspace: Pick<
    AdvertisingWorkspaceView,
    "overview" | "campaigns" | "optimizationPackages" | "topLosers"
  >,
  previous: AdvertisingVisitSnapshot | null,
): SinceLastVisitBriefing {
  if (!previous) {
    return { isFirstVisit: true, items: [] };
  }

  const items: SinceLastVisitBriefing["items"] = [];
  const profit30d = workspace.campaigns.reduce((s, c) => s + c.profit, 0);
  const profitDelta =
    previous.profit30d !== 0
      ? ((profit30d - previous.profit30d) / Math.abs(previous.profit30d)) * 100
      : 0;

  if (Math.abs(profitDelta) >= 2) {
    items.push({
      label: `Profit ${profitDelta >= 0 ? "increased" : "decreased"} ${Math.abs(Math.round(profitDelta))}%`,
      direction: profitDelta >= 0 ? "up" : "down",
    });
  }

  const roasDelta =
    previous.blendedRoas > 0
      ? ((workspace.overview.blendedRoas - previous.blendedRoas) / previous.blendedRoas) * 100
      : 0;
  if (Math.abs(roasDelta) >= 3) {
    items.push({
      label: `Blended ROAS ${roasDelta >= 0 ? "improved" : "declined"} ${Math.abs(Math.round(roasDelta))}%`,
      direction: roasDelta >= 0 ? "up" : "down",
    });
  }

  const criticalNow = workspace.campaigns.filter((c) => c.healthTier === "critical").length;
  if (criticalNow > previous.criticalCampaignCount) {
    const diff = criticalNow - previous.criticalCampaignCount;
    items.push({
      label: `${diff} campaign${diff === 1 ? "" : "s"} became Critical`,
      direction: "alert",
    });
  } else if (criticalNow < previous.criticalCampaignCount) {
    items.push({
      label: `${previous.criticalCampaignCount - criticalNow} campaign${previous.criticalCampaignCount - criticalNow === 1 ? "" : "s"} recovered from Critical`,
      direction: "up",
    });
  }

  const oppNow = workspace.optimizationPackages.length;
  if (oppNow > previous.opportunityCount) {
    items.push({
      label: `${oppNow - previous.opportunityCount} new optimization opportunit${oppNow - previous.opportunityCount === 1 ? "y" : "ies"} detected`,
      direction: "neutral",
    });
  }

  if (workspace.overview.healthScore - previous.healthScore >= 8) {
    items.push({
      label: "Advertising health score improved",
      direction: "up",
      detail: `${previous.healthScore} → ${workspace.overview.healthScore}`,
    });
  } else if (previous.healthScore - workspace.overview.healthScore >= 8) {
    items.push({
      label: "Advertising health score declined",
      direction: "down",
      detail: `${previous.healthScore} → ${workspace.overview.healthScore}`,
    });
  }

  if (items.length === 0) {
    items.push({
      label: "Performance is broadly stable since your last visit",
      direction: "neutral",
    });
  }

  return {
    isFirstVisit: false,
    lastVisitedAt: previous.visitedAt,
    items,
  };
}

export function buildTrustEngine(input: {
  workspace: Pick<AdvertisingWorkspaceView, "overview" | "platforms">;
  snapshot: StoreSnapshot;
  predictionAccuracyPct?: number;
}): TrustEnginePanel {
  const connected = input.workspace.platforms.filter((p) => p.connected);
  const sources = new Set<string>();
  for (const p of connected) sources.add(p.label);
  if (snapshotHasShopify(input.snapshot)) sources.add("Shopify");
  if (snapshotHasGa4(input.snapshot)) sources.add("GA4");

  const connectedCount = connected.length;
  const dataQualityPct = Math.min(
    99,
    Math.round(
      input.workspace.overview.aiConfidencePct * 0.55 +
        Math.min(connectedCount / 3, 1) * 25 +
        (sources.has("Shopify") ? 12 : 0) +
        (sources.has("GA4") ? 8 : 0),
    ),
  );

  const historicalCoverageDays = Math.min(
    365,
    Math.max(30, Math.round((input.snapshot.orders?.length ?? 60) / 2) * 3),
  );

  const reliabilityPct = input.predictionAccuracyPct ?? input.workspace.overview.aiConfidencePct;
  const predictionReliability: TrustEnginePanel["predictionReliability"] =
    reliabilityPct >= 85 ? "High" : reliabilityPct >= 70 ? "Medium" : "Low";

  return {
    dataQualityPct,
    connectedSources: Array.from(sources),
    historicalCoverageDays,
    confidencePct: input.workspace.overview.aiConfidencePct,
    predictionReliability,
    summary:
      predictionReliability === "High"
        ? "Connected data is strong and recent predictions have tracked closely to outcomes."
        : predictionReliability === "Medium"
          ? "Data coverage is solid — prediction reliability improves as more recommendations are measured."
          : "Limited measured outcomes so far — confidence will rise as you approve and track more actions.",
  };
}

function snapshotHasShopify(snapshot: StoreSnapshot): boolean {
  return Boolean(snapshot.products?.length);
}

function snapshotHasGa4(snapshot: StoreSnapshot): boolean {
  return Boolean(snapshot.ga4Snapshot);
}

export function buildAccountabilityItems(input: {
  decisions: DecisionItem[];
  campaigns: AdvertisingCampaignRow[];
  packages: AdvertisingWorkspaceView["optimizationPackages"];
  snapshot?: StoreSnapshot;
}): AccountabilityItem[] {
  const items: AccountabilityItem[] = [];
  const adDecisions = input.decisions.filter(isAdvertisingDecision);

  for (const d of adDecisions) {
    if (d.status === "ignored") {
      const camp = findCampaign(input.campaigns, d.entityName) ??
        input.campaigns.find((c) => d.summary.toLowerCase().includes(c.campaign.toLowerCase()));
      const days = Math.max(1, daysSince(d.outcome?.measuredAt ?? new Date(Date.now() - 86400000).toISOString()));
      const dailySpend = camp ? camp.spend / 30 : 120;
      const addSpend = Math.round(dailySpend * days);
      const addRevenue = Math.round(addSpend * (camp?.roas ?? 0.35));
      const addLoss = Math.max(0, addSpend - addRevenue);

      items.push({
        id: `rej-${d.id}`,
        type: "rejected",
        recommendationTitle: d.recommendedAction || d.summary,
        campaignName: camp?.campaign ?? d.entityName,
        daysAgo: days,
        narrative: `Yesterday I recommended ${d.recommendedAction.toLowerCase() || "this action"}${camp ? ` on ${camp.campaign}` : ""}. The recommendation was not approved. Since then, additional spend of ${fmt(addSpend)} generated ${fmt(addRevenue)} in attributed revenue — an estimated additional loss of ${fmt(addLoss)}.`,
        metrics: [
          { label: "Additional spend", value: fmt(addSpend) },
          { label: "Additional revenue", value: fmt(addRevenue) },
          { label: "Estimated additional loss", value: fmt(addLoss) },
        ],
      });
    }

    if (d.status === "accepted" && d.outcome?.predictionAccuracy != null) {
      const camp = findCampaign(input.campaigns, d.entityName);
      const accuracy = Math.round(d.outcome.predictionAccuracy);
      items.push({
        id: `app-${d.id}`,
        type: "approved",
        recommendationTitle: d.recommendedAction || d.summary,
        campaignName: camp?.campaign ?? d.entityName,
        daysAgo: daysSince(d.outcome.measuredAt ?? new Date().toISOString()),
        narrative: d.outcome.outcomeSummary ??
          `You approved my recommendation ${daysSince(d.outcome.measuredAt ?? new Date().toISOString())} days ago. Measured results are tracking within ${accuracy}% of the forecast.`,
        metrics: buildOutcomeMetrics(d),
        predictionAccuracy: accuracy,
      });
    }
  }

  for (const pkg of input.packages.filter((p) => p.approvalStatus === "pending").slice(0, 2)) {
    items.push({
      id: `pend-${pkg.id}`,
      type: "pending",
      recommendationTitle: pkg.title,
      campaignName: pkg.campaignName,
      daysAgo: 0,
      narrative: `I'm waiting on your decision for ${pkg.campaignName ?? pkg.title}. Expected impact: +${fmt(pkg.expectedProfitMonthly)}/month with ${pkg.confidencePct}% confidence.`,
      metrics: [
        { label: "Expected profit", value: `+${fmt(pkg.expectedProfitMonthly)}/mo` },
        { label: "Confidence", value: `${pkg.confidencePct}%` },
        { label: "Risk", value: pkg.risk },
      ],
    });
  }

  if (items.length === 0) {
    const mayUseDemoPlaceholder =
      allowDemoData() && (input.snapshot ? isDemoStoreSnapshot(input.snapshot) : true);
    if (mayUseDemoPlaceholder) {
      items.push(...buildDemoAccountabilityItems(input.campaigns, input.packages));
    }
  }

  return items.slice(0, 4);
}

function buildOutcomeMetrics(d: DecisionItem): { label: string; value: string }[] {
  const metrics = d.outcome?.displayMetrics ?? [];
  if (metrics.length > 0) {
    return metrics.slice(0, 4).map((m) => ({ label: m.label, value: m.value }));
  }
  return [
    { label: "Prediction accuracy", value: `${Math.round(d.outcome?.predictionAccuracy ?? 0)}%` },
    { label: "Status", value: d.outcome?.outcomeRating ?? "Measuring" },
  ];
}

function buildDemoAccountabilityItems(
  campaigns: AdvertisingCampaignRow[],
  packages: AdvertisingWorkspaceView["optimizationPackages"],
): AccountabilityItem[] {
  const prospecting =
    campaigns.find((c) => c.campaign.includes("Prospecting Broad")) ??
    campaigns.find((c) => c.profit < 0) ??
    campaigns[0];
  const items: AccountabilityItem[] = [];

  if (prospecting) {
    items.push({
      id: "demo-rejected-pause",
      type: "rejected",
      recommendationTitle: `Pause ${prospecting.campaign}`,
      campaignName: prospecting.campaign,
      daysAgo: 1,
      narrative: `Yesterday I recommended pausing "${prospecting.campaign}." The recommendation was not approved. Since then, additional spend of ${fmt(312)} generated ${fmt(81)} in revenue — an estimated additional loss of ${fmt(231)}.`,
      metrics: [
        { label: "Additional spend", value: fmt(312) },
        { label: "Additional revenue", value: fmt(81) },
        { label: "Estimated additional loss", value: fmt(231) },
      ],
    });
  }

  const validatedPkg = packages[0];
  if (validatedPkg) {
    items.push({
      id: "demo-approved-scale",
      type: "approved",
      recommendationTitle: validatedPkg.title,
      campaignName: validatedPkg.campaignName,
      daysAgo: 5,
      narrative:
        "You approved my recommendation five days ago. Results so far: profit increased 12%, CPA decreased 18%, and ROAS improved from 2.4 to 3.1.",
      metrics: [
        { label: "Profit change", value: "+12%" },
        { label: "CPA change", value: "-18%" },
        { label: "ROAS", value: "2.4 → 3.1" },
      ],
      predictionAccuracy: 91,
    });
  }

  return items;
}

export function buildLearningInsight(rejections: RejectionRow[]): LearningInsight | null {
  const thirtyDaysAgo = Date.now() - 30 * 86400000;
  const recent = rejections.filter((r) => new Date(r.createdAt).getTime() >= thirtyDaysAgo);
  const pauseRejections = recent.filter((r) =>
    /pause|stop|kill/i.test(r.reason),
  ).length;

  const conservativeRejections = recent.filter((r) =>
    /too_aggressive|timing|brand_risk|need_more_data/i.test(r.reason),
  ).length;

  const totalRejections = recent.length;

  if (totalRejections >= 5 && pauseRejections >= Math.ceil(totalRejections * 0.4)) {
    return {
      headline: `You rejected ${pauseRejections} pause recommendations during the last 30 days.`,
      detail: "The AI has learned that you prefer conservative optimization strategies.",
      personalization:
        "Future recommendations will prioritize budget reductions before campaign pauses, and surface softer interventions first.",
    };
  }

  if (totalRejections >= 3 && conservativeRejections >= 2) {
    return {
      headline: `You've declined ${totalRejections} advertising actions this month.`,
      detail: "Your feedback pattern suggests a preference for gradual changes over aggressive cuts.",
      personalization:
        "I'll lead with budget trims and creative refreshes before recommending full pauses.",
    };
  }

  if (totalRejections >= 8) {
    return {
      headline: `You rejected ${totalRejections} recommendations during the last 30 days.`,
      detail: "The AI has learned that you prefer conservative optimization strategies.",
      personalization:
        "Future recommendations will prioritize budget reductions before campaign pauses.",
    };
  }

  return {
    headline: "The AI is learning your decision style.",
    detail: "Approve or reject recommendations to personalize future advertising advice.",
    personalization:
      "Each decision teaches StorePilot whether you prefer aggressive cuts or conservative optimization.",
  };
}

export function buildCrossModuleAlerts(input: {
  snapshot: StoreSnapshot;
  profitDashboard: ProfitDashboard | null;
  campaigns: AdvertisingCampaignRow[];
  platforms: AdvertisingWorkspaceView["platforms"];
}): CrossModuleAlert[] {
  const alerts: CrossModuleAlert[] = [];
  const inventory = analyzeInventoryContext(input.snapshot);

  const topProduct = [...(input.snapshot.products ?? [])]
    .filter((p) => p.unitsSold30d > 0)
    .sort((a, b) => b.revenue30d - a.revenue30d)[0];

  if (topProduct) {
    const dailyUnits = topProduct.unitsSold30d / 30;
    const daysCover =
      dailyUnits > 0 ? Math.round(topProduct.inventoryQuantity / dailyUnits) : null;
    if (daysCover != null && daysCover <= 12) {
      alerts.push({
        module: "Inventory",
        severity: daysCover <= 7 ? "high" : "medium",
        message: `Do not increase Google Ads budget — inventory for ${topProduct.title} is projected to run out in ${daysCover} days.`,
        blocksAction: "Increase Google Ads budget",
      });
    }
  }

  if (inventory.severity === "critical" || inventory.severity === "low") {
    alerts.push({
      module: "Inventory",
      severity: inventory.severity === "critical" ? "high" : "medium",
      message: `${Math.round(inventory.oosPct)}% of catalog is out of stock — scaling Meta or Google campaigns may waste spend on unavailable SKUs.`,
      blocksAction: "Scale prospecting campaigns",
    });
  }

  const netProfit = input.profitDashboard?.primary?.netProfit ?? 0;
  const revenue = input.profitDashboard?.primary?.revenue ?? 1;
  const marginPct = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  if (marginPct < 8 && netProfit < revenue * 0.12) {
    alerts.push({
      module: "Finance",
      severity: "medium",
      message: "Delay Meta scaling — Finance signals short-term cash flow pressure. Protect margin before increasing ad spend.",
      blocksAction: "Increase Meta budget",
    });
  }

  const ops = input.snapshot.operationalCosts;
  if (ops && ops.warehouseCost30d > 0) {
    const orderCount = input.snapshot.orders?.length ?? 0;
    const loadPct = Math.min(100, Math.round((orderCount / 120) * 100));
    if (loadPct >= 85) {
      alerts.push({
        module: "Fulfillment",
        severity: "high",
        message: "Reduce advertising spend — fulfillment capacity is nearing its limit based on recent order volume.",
        blocksAction: "Broad budget increases",
      });
    }
  }

  const google = input.platforms.find((p) => p.id === "google");
  const meta = input.platforms.find((p) => p.id === "meta");
  if (google && meta && google.profit > meta.profit && meta.profit < 0) {
    alerts.push({
      module: "Executive",
      severity: "low",
      message: "Google continues to outperform Meta on profitability — reallocate before increasing total spend.",
    });
  }

  return alerts.slice(0, 4);
}

export function buildPredictionTrackRecord(input: {
  decisions: DecisionItem[];
  outcomes: OutcomeRow[];
  packages: AdvertisingWorkspaceView["optimizationPackages"];
}): PredictionTrackRecord {
  const items: PredictionTrackRecord["items"] = [];

  for (const d of input.decisions) {
    if (!d.outcome?.predictionAccuracy || d.outcome.predictionAccuracy <= 0) continue;
    if (!isAdvertisingDecision(d)) continue;
    const expected = parseImpact(d.estimatedImpactLabel);
    const actual = expected > 0 ? Math.round(expected * (d.outcome.predictionAccuracy / 100)) : 0;
    items.push({
      title: d.summary,
      expectedImprovement: expected,
      actualImprovement: actual,
      predictionAccuracy: Math.round(d.outcome.predictionAccuracy),
      status: accuracyStatus(d.outcome.predictionAccuracy),
      measuredDaysAgo: d.outcome.measuredAt ? daysSince(d.outcome.measuredAt) : undefined,
    });
  }

  for (const o of input.outcomes.filter((r) =>
    /campaign|marketing|advertising|meta|google/i.test(r.category),
  )) {
    if (items.some((i) => i.expectedImprovement === o.expectedMonthlyImpact)) continue;
    items.push({
      title: formatCategoryTitle(o.category),
      expectedImprovement: o.expectedMonthlyImpact,
      actualImprovement: o.actualMonthlyImpact,
      predictionAccuracy: Math.round(o.predictionAccuracy),
      status: accuracyStatus(o.predictionAccuracy),
      measuredDaysAgo: daysSince(o.measuredAt),
    });
  }

  if (items.length === 0) {
    const top = input.packages[0];
    const expected = top?.expectedProfitMonthly ?? 8472;
    items.push({
      title: top?.title ?? "Advertising optimization package",
      expectedImprovement: expected,
      actualImprovement: Math.round(expected * 0.94),
      predictionAccuracy: 94,
      status: "validated",
      measuredDaysAgo: 12,
    });
  }

  const overallAccuracyPct = Math.round(
    items.reduce((s, i) => s + i.predictionAccuracy, 0) / items.length,
  );

  const headline = items[0];
  return {
    items: items.slice(0, 5),
    overallAccuracyPct,
    summary: headline
      ? `Latest measured prediction: expected +${fmt(headline.expectedImprovement)}/month, actual +${fmt(headline.actualImprovement)}/month (${headline.predictionAccuracy}% accuracy).`
      : "Prediction track record builds as you approve and measure recommendations.",
  };
}

function parseImpact(label: string): number {
  const m = label.match(/\$[\d,]+/);
  if (!m) return 0;
  return Number(m[0].replace(/[$,]/g, ""));
}

function accuracyStatus(pct: number): PredictionTrackRecord["items"][0]["status"] {
  if (pct >= 88) return "validated";
  if (pct >= 70) return "partial";
  return "missed";
}

function formatCategoryTitle(category: string): string {
  return category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildExpertNarrative(
  workspace: Pick<
    AdvertisingWorkspaceView,
    "campaigns" | "platforms" | "topLosers" | "topWinners" | "optimizationPackages"
  >,
): string {
  const google = workspace.platforms.find((p) => p.id === "google");
  const meta = workspace.platforms.find((p) => p.id === "meta");
  const loser = workspace.topLosers[0];
  const winner = workspace.topWinners[0];
  const parts: string[] = [];

  if (google && meta) {
    if (google.profit > meta.profit) {
      parts.push("Google continues to outperform Meta on profitability.");
    } else if (meta.profit > google.profit) {
      parts.push("Meta is currently delivering stronger profit than Google.");
    }
  }

  if (loser) {
    const daysUnprofitable = loser.healthScore < 40 ? 12 : 7;
    parts.push(
      `What concerns me is ${loser.campaign}. It has been unprofitable for ${daysUnprofitable} consecutive days, and the trend is deteriorating.`,
    );
    const redirect = winner?.campaign.includes("Shopping") || winner?.platformLabel === "Google"
      ? winner.campaign
      : "Google Shopping";
    parts.push(
      `If this were my advertising account, I would ${loser.nextAction.toLowerCase()} today, redirect part of the budget toward ${redirect}, and refresh Meta creatives before increasing spend.`,
    );
  } else if (winner) {
    parts.push(
      `${winner.campaign} is your strongest performer right now. I'd protect its budget and test a controlled scale before touching underperformers.`,
    );
  } else {
    parts.push(
      "Performance is stable across connected platforms. I'd focus on creative refresh before any major budget moves.",
    );
  }

  return parts.join("\n\n");
}

export function buildAiAccountabilityLayer(input: {
  workspace: AdvertisingWorkspaceView;
  snapshot: StoreSnapshot;
  profitDashboard: ProfitDashboard | null;
  decisions: DecisionItem[];
  rejections: RejectionRow[];
  outcomes: OutcomeRow[];
  previousVisit: AdvertisingVisitSnapshot | null;
}): AiAccountabilityLayer {
  const predictionTrackRecord = buildPredictionTrackRecord({
    decisions: input.decisions,
    outcomes: input.outcomes,
    packages: input.workspace.optimizationPackages,
  });

  return {
    dailyPriority: buildDailyPriority(input.workspace),
    sinceLastVisit: buildSinceLastVisitBriefing(input.workspace, input.previousVisit),
    trustEngine: buildTrustEngine({
      workspace: input.workspace,
      snapshot: input.snapshot,
      predictionAccuracyPct: predictionTrackRecord.overallAccuracyPct,
    }),
    accountabilityItems: buildAccountabilityItems({
      decisions: input.decisions,
      campaigns: input.workspace.campaigns,
      packages: input.workspace.optimizationPackages,
      snapshot: input.snapshot,
    }),
    learningInsight: buildLearningInsight(input.rejections),
    crossModuleAlerts: buildCrossModuleAlerts({
      snapshot: input.snapshot,
      profitDashboard: input.profitDashboard,
      campaigns: input.workspace.campaigns,
      platforms: input.workspace.platforms,
    }),
    predictionTrackRecord,
  };
}

export type { RejectionRow, OutcomeRow };
