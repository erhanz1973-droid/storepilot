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

function addOpportunity(
  list: Omit<ProfitRecoveryOpportunity, "rank">[],
  opp: Omit<ProfitRecoveryOpportunity, "rank">,
): void {
  if (opp.estimatedMonthlyRecovery <= 0) return;
  list.push(opp);
}

export function buildStagedRecoveryOpportunities(
  dashboard: ProfitDashboard,
  snapshot: StoreSnapshot,
): ProfitRecoveryOpportunity[] {
  const opportunities: Omit<ProfitRecoveryOpportunity, "rank">[] = [];
  const campaigns = buildMarketingCampaigns(snapshot);
  const scale = 30 / 7;
  const p = dashboard.primary;
  const underperformers = campaigns.filter((c) => c.roas < 1.2 && c.spend > 50);
  const winners = campaigns
    .filter((c) => c.roas >= 1.5 && c.profit > 0)
    .sort((a, b) => b.roas - a.roas);

  for (const c of underperformers) {
    const monthlySpend = Math.round(c.spend * scale);
    const reason = buildAdvertisingReason(dashboard, c);
    const description = optimizationDescription(c);

    addOpportunity(opportunities, {
      id: `reduce-budget-${c.id}`,
      priority: 1,
      priorityLabel: PRIORITY_LABELS[1],
      title: `Reduce ${c.campaign} budget by 25%`,
      description,
      reason,
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
      reason,
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
        reason,
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
        reason: `${reason} Multiple optimization levers should be tested before pausing entirely.`,
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
        title: "Reduce CAC by improving targeting",
        description:
          "Acquisition costs exceed gross profit. Tighten audience targeting and refresh underperforming ad sets before reducing overall demand.",
        reason: buildAdvertisingReason(dashboard),
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
      reason: buildAdvertisingReason(dashboard),
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
  if (!card.connected && card.revenue === 0) return "Connect channel for attribution";
  if (card.adSpend > 0 && card.roas != null && card.roas < 1) {
    const be = breakEvenRoas != null ? breakEvenRoas.toFixed(1) : "break-even";
    return `${card.channel} is below ${be} ROAS. Reduce budget or improve targeting before pausing entirely.`;
  }
  if (card.adSpend > 0 && card.roas != null && card.roas < 1.5) {
    return "Optimize targeting, creatives, and bidding strategy to lift efficiency.";
  }
  if (card.netProfit > 0 && card.marginPct > 25) return "Scale — high margin channel";
  if (card.adSpend === 0 && card.revenue > 0) return "Invest in retention — strong organic";
  return "Monitor performance";
}
