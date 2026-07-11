import { buildMarketingCampaigns } from "@/lib/analytics/marketing";
import type { MarketingCampaignRow } from "@/lib/analytics/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";

export type ProfitRecoveryPriority = 1 | 2 | 3 | 4;

export type ProfitRecoveryOpportunity = {
  id: string;
  rank: number;
  priority: ProfitRecoveryPriority;
  priorityLabel: string;
  title: string;
  description: string;
  reason: string;
  estimatedMonthlyRecovery: number;
  confidencePct: number;
  difficulty: "Low" | "Medium" | "High";
  timeRequired: string;
  isLastResort?: boolean;
};

const PRIORITY_LABELS: Record<ProfitRecoveryPriority, string> = {
  1: "Optimize efficiency",
  2: "Reallocate budget",
  3: "Improve unit economics",
  4: "Last resort",
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function weeklyToMonthly(weekly: number): number {
  return Math.round(weekly * 4.33);
}

function campaignTone(name: string): "prospecting" | "retargeting" | "general" {
  const n = name.toLowerCase();
  if (n.includes("prospect")) return "prospecting";
  if (n.includes("retarget") || n.includes("remarket")) return "retargeting";
  return "general";
}

function optimizationDescription(campaign: MarketingCampaignRow): string {
  const tone = campaignTone(campaign.campaign);
  if (tone === "prospecting") {
    return "Prospecting campaigns are currently operating below your estimated break-even ROAS. Consider reducing budget or restructuring targeting before pausing entirely.";
  }
  if (tone === "retargeting") {
    return "Retargeting is underperforming. Test new audiences or creatives before considering a pause.";
  }
  return `${campaign.campaign} is below break-even ROAS. Optimize targeting, creatives, or bidding before pausing entirely.`;
}

export function estimateBreakEvenRoas(dashboard: ProfitDashboard): number | null {
  const p = dashboard.primary;
  if (p.revenue <= 0 || p.grossProfit <= 0) return null;
  const margin = p.grossProfit / p.revenue;
  return round(1 / margin);
}

export function buildAdvertisingReason(
  dashboard: ProfitDashboard,
  campaign?: MarketingCampaignRow,
): string {
  const p = dashboard.primary;
  const parts: string[] = [];

  if (p.grossProfit > 0) {
    const adPct = Math.round((p.adSpend / p.grossProfit) * 100);
    parts.push(`Advertising currently represents ${adPct}% of gross profit.`);
  }

  const breakEven = estimateBreakEvenRoas(dashboard);
  if (breakEven != null) {
    parts.push(`Estimated break-even ROAS: ${breakEven}`);
  }

  const currentRoas = campaign?.roas ?? (p.adSpend > 0 ? round(p.revenue / p.adSpend) : null);
  if (currentRoas != null) {
    parts.push(`Current ROAS: ${currentRoas.toFixed(2)}`);
    if (breakEven != null && breakEven > 0) {
      const gapPct = Math.round((1 - currentRoas / breakEven) * 100);
      parts.push(`Gap: ${gapPct > 0 ? "-" : "+"}${Math.abs(gapPct)}%`);
    }
  }

  return parts.join(" ");
}

function canRecommendPause(campaign: MarketingCampaignRow): boolean {
  return campaign.roas < 0.85 && campaign.spend > 200 && campaign.profit < 0;
}

function recoveryMeta(priority: ProfitRecoveryPriority): {
  difficulty: ProfitRecoveryOpportunity["difficulty"];
  timeRequired: string;
} {
  if (priority === 1) return { difficulty: "Medium", timeRequired: "2–4 weeks" };
  if (priority === 2) return { difficulty: "Medium", timeRequired: "1–2 weeks" };
  if (priority === 3) return { difficulty: "Low", timeRequired: "1–3 weeks" };
  return { difficulty: "High", timeRequired: "Immediate" };
}

function addOpportunity(
  list: ProfitRecoveryOpportunity[],
  opp: Omit<ProfitRecoveryOpportunity, "rank" | "difficulty" | "timeRequired">,
): void {
  if (opp.estimatedMonthlyRecovery <= 0) return;
  const meta = recoveryMeta(opp.priority);
  list.push({
    ...opp,
    difficulty: meta.difficulty,
    timeRequired: meta.timeRequired,
    rank: 0,
  });
}

export function buildStagedRecoveryOpportunities(
  dashboard: ProfitDashboard,
  snapshot: StoreSnapshot,
): ProfitRecoveryOpportunity[] {
  const opportunities: ProfitRecoveryOpportunity[] = [];
  const campaigns = buildMarketingCampaigns(snapshot);
  const scale = 30 / 7;
  const p = dashboard.primary;
  const underperformers = campaigns.filter((c) => c.roas < 1.2 && c.spend > 50);
  const winners = campaigns
    .filter((c) => c.roas >= 1.5 && c.profit > 0)
    .sort((a, b) => b.roas - a.roas);

  for (const c of underperformers) {
    const monthlySpend = Math.round(c.spend * scale);
    const description = optimizationDescription(c);

    addOpportunity(opportunities, {
      id: `reduce-budget-${c.id}`,
      priority: 1,
      priorityLabel: PRIORITY_LABELS[1],
      title: `Reduce ${c.campaign} budget by 25%`,
      description,
      reason: `${c.campaign} ROAS is ${c.roas.toFixed(2)} — trim spend while testing new audiences.`,
      estimatedMonthlyRecovery: Math.round(monthlySpend * 0.25),
      confidencePct: 84,
    });

    addOpportunity(opportunities, {
      id: `optimize-targeting-${c.id}`,
      priority: 1,
      priorityLabel: PRIORITY_LABELS[1],
      title: `Improve targeting and creatives — ${c.campaign}`,
      description:
        campaignTone(c.campaign) === "retargeting"
          ? "Refresh audiences and ad creative to recover retargeting efficiency before cutting spend."
          : "Exclude low-performing audiences and test new creative angles to lift ROAS.",
      reason: `Creative and audience refresh on ${c.campaign} can lift ROAS before budget cuts.`,
      estimatedMonthlyRecovery: Math.round(monthlySpend * 0.18),
      confidencePct: 76,
    });

    if (winners.length > 0 && c.roas < 1) {
      const target = winners[0]!;
      addOpportunity(opportunities, {
        id: `reallocate-${c.id}-to-${target.id}`,
        priority: 2,
        priorityLabel: PRIORITY_LABELS[2],
        title: `Reallocate budget from ${c.campaign} to ${target.campaign}`,
        description: `Shift spend toward ${target.campaign}, which is delivering ${target.roas.toFixed(2)} ROAS with positive profit.`,
        reason: `${target.campaign} is outperforming — shift budget from weaker campaigns.`,
        estimatedMonthlyRecovery: Math.round(monthlySpend * 0.22),
        confidencePct: 79,
      });
    }

    if (canRecommendPause(c)) {
      const recovery =
        c.profit < 0 ? Math.abs(c.profit) * 4.33 : weeklyToMonthly(c.spend * 0.28);
      addOpportunity(opportunities, {
        id: `pause-last-resort-${c.id}`,
        priority: 4,
        priorityLabel: PRIORITY_LABELS[4],
        title: `Pause ${c.campaign} (last resort)`,
        description:
          "Negative profit has persisted with ROAS below break-even and no improving trend detected. Consider pausing only after optimization attempts.",
        reason: `Only after targeting and creative tests fail on ${c.campaign}.`,
        estimatedMonthlyRecovery: Math.round(recovery),
        confidencePct: 68,
        isLastResort: true,
      });
    }
  }

  if (p.adSpend > p.grossProfit && p.grossProfit > 0) {
    const cacRecovery = Math.round((p.adSpend - p.grossProfit) * 0.35);
    if (cacRecovery > 500) {
      addOpportunity(opportunities, {
        id: "reduce-cac-targeting",
        priority: 1,
        priorityLabel: PRIORITY_LABELS[1],
        title: "Reduce Customer Acquisition Cost",
        description:
          "Tighten audience targeting and refresh underperforming ad sets before increasing overall demand.",
        reason: "Blended acquisition cost is above gross profit — efficiency gains unlock margin first.",
        estimatedMonthlyRecovery: cacRecovery,
        confidencePct: 85,
      });
    }
  }

  for (const product of dashboard.losingProducts.slice(0, 2)) {
    addOpportunity(opportunities, {
      id: `price-${product.productId}`,
      priority: 3,
      priorityLabel: PRIORITY_LABELS[3],
      title: `Increase price — ${product.title}`,
      description: "Improve unit economics with a modest price increase on a SKU with negative contribution margin.",
      reason: `${product.title} loses money after ads and fulfillment. Raising price improves margin per order.`,
      estimatedMonthlyRecovery: Math.round(Math.abs(product.netProfit) * 0.35),
      confidencePct: product.costSource === "estimated" ? 65 : 78,
    });
  }

  if (dashboard.losingProducts.length > 0 || underperformers.length > 0) {
    addOpportunity(opportunities, {
      id: "increase-aov-bundles",
      priority: 3,
      priorityLabel: PRIORITY_LABELS[3],
      title: "Increase AOV with bundles and upsells",
      description:
        "Bundle complementary products and add post-purchase upsells to lift average order value without cutting acquisition.",
      reason:
        "Bundle complementary products and add post-purchase upsells to lift average order value without cutting acquisition.",
      estimatedMonthlyRecovery: Math.round(Math.max(p.revenue * 0.03, 500)),
      confidencePct: 72,
    });
  }

  const sorted = opportunities.sort((a, b) => {
    if (a.isLastResort && !b.isLastResort) return 1;
    if (!a.isLastResort && b.isLastResort) return -1;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.estimatedMonthlyRecovery - a.estimatedMonthlyRecovery;
  });

  return sorted.slice(0, 8).map((opp, index) => ({
    ...opp,
    rank: index + 1,
  }));
}

export function channelOptimizationRecommendation(
  card: {
    connected: boolean;
    revenue: number;
    adSpend: number;
    roas: number | null;
    netProfit: number;
    marginPct: number;
    channel: string;
  },
  breakEvenRoas: number | null,
): string {
  if (!card.connected && card.revenue === 0) {
    return "Connect integration to measure profitability.";
  }
  if (card.adSpend > 0 && card.roas != null && card.roas < 1) {
    return "Reduce spend until ROAS exceeds break-even.";
  }
  if (card.adSpend > 0 && card.roas != null && card.roas < (breakEvenRoas ?? 1.5)) {
    return "Restructure campaigns before increasing budget.";
  }
  if (card.netProfit > 0 && card.marginPct > 25 && card.adSpend > 0) {
    return "Invest more — channel is profitable with room to scale.";
  }
  if (card.adSpend === 0 && card.revenue > 0) {
    return "Invest more in retention — strong organic contribution.";
  }
  return "Hold spend steady and monitor weekly contribution margin.";
}
