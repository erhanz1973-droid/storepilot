import type { BusinessGoal } from "@/lib/business-goals/types";
import { BUSINESS_GOAL_LABELS } from "@/lib/business-goals/types";
import type { DailyMetricPoint } from "@/lib/connectors/types";
import type {
  AcquisitionMetrics,
  CampaignAttributionRow,
  ChannelAttributionRow,
} from "./models";
import type { BreakEvenRoasModel } from "./break-even-roas";
import type {
  AttributionBusinessObjective,
  AttributionStrategyId,
  DecisionPrecondition,
} from "./decision-engine-types";

export type { AttributionBusinessObjective, DecisionPrecondition };

export const ATTRIBUTION_OBJECTIVE_LABELS: Record<AttributionBusinessObjective, string> = {
  maximize_profit: "Maximize Profit",
  maximize_revenue: "Maximize Revenue",
  maximize_growth: "Maximize Growth",
  preserve_cash_flow: "Preserve Cash Flow",
  clear_inventory: "Clear Inventory",
};

export function mapBusinessGoalToObjective(
  goal: BusinessGoal,
  merchantMode?: string,
): AttributionBusinessObjective {
  if (merchantMode === "cash_flow") return "preserve_cash_flow";
  if (merchantMode === "growth") return "maximize_growth";
  if (merchantMode === "inventory_clearance") return "clear_inventory";

  switch (goal) {
    case "increase_profit":
      return "maximize_profit";
    case "increase_revenue":
      return "maximize_revenue";
    case "clear_inventory":
      return "clear_inventory";
    case "acquire_new_customers":
    case "build_brand_awareness":
    case "launch_new_product":
    case "grow_email_list":
      return "maximize_growth";
    default:
      return "maximize_profit";
  }
}

export function objectiveLabel(
  objective: AttributionBusinessObjective,
  businessGoal?: BusinessGoal,
): string {
  if (businessGoal && BUSINESS_GOAL_LABELS[businessGoal]) {
    return BUSINESS_GOAL_LABELS[businessGoal];
  }
  return ATTRIBUTION_OBJECTIVE_LABELS[objective];
}

export type DecisionSignals = {
  scope: string;
  breakEven: BreakEvenRoasModel;
  avgRoas: number | null;
  roasGapPct: number | null;
  totalSpend: number;
  totalRevenue: number;
  netProfit: number;
  revenueGrowthPct: number | null;
  conversionStable: boolean;
  assistedRevenue: number;
  cac: number | null;
  targetCac: number | null;
  cacGapPct: number | null;
  profitableCampaignCount: number;
  paidCampaignCount: number;
  hasWinnerLoser: boolean;
};

export function buildDecisionSignals(input: {
  channels: ChannelAttributionRow[];
  campaigns: CampaignAttributionRow[];
  acquisition: AcquisitionMetrics;
  breakEven: BreakEvenRoasModel;
  netProfit: number;
  storeRevenue: number;
  dailyMetrics?: DailyMetricPoint[];
}): DecisionSignals {
  const meta = input.channels.find((c) => c.channelId === "meta_ads");
  const scope = meta ? "Meta Advertising" : "Paid Advertising";
  const paid = input.campaigns.filter((c) => c.adSpend > 50);
  const totalSpend = paid.reduce((s, c) => s + c.adSpend, 0);
  const withRoas = paid.filter((c) => c.roas != null && c.adSpend > 0);
  const avgRoas =
    withRoas.length > 0 && totalSpend > 0
      ? Math.round(
          (withRoas.reduce((s, c) => s + (c.roas ?? 0) * c.adSpend, 0) / totalSpend) * 100,
        ) / 100
      : meta?.roas ?? null;

  const roasGapPct =
    avgRoas != null
      ? Math.round((1 - avgRoas / input.breakEven.breakEvenRoas) * 100)
      : null;

  const assistedRevenue = input.channels.reduce((s, c) => s + c.assistedRevenue, 0);
  const profitableCampaignCount = paid.filter(
    (c) => c.netProfit > 0 && (c.roas ?? 0) >= input.breakEven.breakEvenRoas * 0.95,
  ).length;

  const winner = paid.find(
    (c) => c.netProfit > 0 && (c.roas ?? 0) >= input.breakEven.breakEvenRoas,
  );
  const loser = paid.find((c) => c.netProfit < 0 && c.adSpend > 100);

  const customerCount = Math.max(
    input.acquisition.newCustomers + input.acquisition.returningCustomers,
    1,
  );
  const targetCac =
    input.breakEven.contributionMarginPct > 0
      ? Math.round((input.storeRevenue / customerCount) * (input.breakEven.contributionMarginPct / 100))
      : null;

  const cacGapPct =
    input.acquisition.cac != null && targetCac != null && targetCac > 0
      ? Math.round(((input.acquisition.cac - targetCac) / targetCac) * 100)
      : null;

  return {
    scope,
    breakEven: input.breakEven,
    avgRoas,
    roasGapPct,
    totalSpend,
    totalRevenue: input.storeRevenue,
    netProfit: input.netProfit,
    revenueGrowthPct: estimateRevenueGrowth(input.dailyMetrics),
    conversionStable: estimateConversionStability(input.dailyMetrics),
    assistedRevenue,
    cac: input.acquisition.cac,
    targetCac,
    cacGapPct,
    profitableCampaignCount,
    paidCampaignCount: paid.length,
    hasWinnerLoser: Boolean(winner && loser),
  };
}

function estimateRevenueGrowth(metrics?: DailyMetricPoint[]): number | null {
  if (!metrics || metrics.length < 14) return null;
  const recent = metrics.slice(-7);
  const prior = metrics.slice(-14, -7);
  const recentRev = recent.reduce((s, m) => s + m.revenue, 0);
  const priorRev = prior.reduce((s, m) => s + m.revenue, 0);
  if (priorRev <= 0) return null;
  return Math.round(((recentRev - priorRev) / priorRev) * 1000) / 10;
}

function estimateConversionStability(metrics?: DailyMetricPoint[]): boolean {
  if (!metrics || metrics.length < 7) return true;
  const recent = metrics.slice(-7);
  const orders = recent.map((m) => m.orders);
  const avg = orders.reduce((a, b) => a + b, 0) / orders.length;
  if (avg <= 0) return true;
  const variance = orders.reduce((s, o) => s + (o - avg) ** 2, 0) / orders.length;
  const cv = Math.sqrt(variance) / avg;
  return cv < 0.35;
}

export type StrategyScore = {
  strategy: AttributionStrategyId;
  score: number;
  reason: string;
};

const STRATEGY_LABELS: Record<AttributionStrategyId, string> = {
  scale: "Scale",
  optimize: "Optimize",
  reallocate: "Reallocate",
  reduce_budget: "Reduce Budget",
  pause: "Pause",
};

export function strategyShortLabel(id: AttributionStrategyId): string {
  return STRATEGY_LABELS[id];
}

export function scoreAllStrategies(
  signals: DecisionSignals,
  objective: AttributionBusinessObjective,
): StrategyScore[] {
  const be = signals.breakEven.breakEvenRoas;
  const avg = signals.avgRoas ?? 0;
  const growth = signals.revenueGrowthPct ?? 0;

  const base: Record<AttributionStrategyId, number> = {
    scale: 20,
    optimize: 50,
    reallocate: 40,
    reduce_budget: 35,
    pause: 15,
  };

  if (signals.profitableCampaignCount >= Math.max(1, signals.paidCampaignCount * 0.55) && avg >= be) {
    base.scale += 45;
  } else if (avg > 0 && avg < be) {
    base.optimize += 35;
    base.reduce_budget += 25;
    base.scale -= 15;
  }

  if (signals.hasWinnerLoser) base.reallocate += 30;
  if (signals.roasGapPct != null && signals.roasGapPct > 50) {
    base.pause += 15;
    base.reduce_budget += 15;
  }
  if (growth > 5) {
    base.scale += 15;
    base.optimize += 10;
    base.pause -= 20;
  }
  if (signals.assistedRevenue > 500) {
    base.optimize += 10;
    base.pause -= 10;
  }
  if (signals.netProfit < 0 && signals.totalSpend > 800) {
    base.reduce_budget += 20;
  }

  switch (objective) {
    case "maximize_profit":
      base.optimize += 15;
      base.reduce_budget += 10;
      base.scale -= 5;
      break;
    case "maximize_revenue":
    case "maximize_growth":
      base.scale += 20;
      base.optimize += 10;
      base.pause -= 25;
      base.reduce_budget -= 15;
      break;
    case "preserve_cash_flow":
      base.reduce_budget += 25;
      base.pause += 10;
      base.scale -= 20;
      break;
    case "clear_inventory":
      base.scale += 15;
      base.reallocate += 15;
      break;
  }

  const reasons: Record<AttributionStrategyId, string> = {
    scale: avg >= be ? "ROAS meets or exceeds dynamic break-even." : "ROAS below break-even.",
    optimize: "Efficiency gains available without stopping acquisition.",
    reallocate: signals.hasWinnerLoser
      ? "Budget can shift from losers to winners."
      : "No clear winner/loser split detected.",
    reduce_budget: "Could improve profitability but may reduce growth.",
    pause: growth > 0 ? "Revenue is still being generated." : "Sustained losses may require pausing.",
  };

  return (Object.keys(base) as AttributionStrategyId[])
    .map((strategy) => ({
      strategy,
      score: Math.max(0, Math.min(100, Math.round(base[strategy]))),
      reason: reasons[strategy],
    }))
    .sort((a, b) => b.score - a.score);
}

export function buildPreconditions(signals: DecisionSignals): DecisionPrecondition[] {
  const items: DecisionPrecondition[] = [];

  if (signals.roasGapPct != null) {
    items.push({
      id: "roas-gap",
      text:
        signals.roasGapPct > 0
          ? `ROAS is ${signals.roasGapPct}% below estimated break-even (${signals.breakEven.breakEvenRoas.toFixed(2)}).`
          : `ROAS is at or above break-even (${signals.breakEven.breakEvenRoas.toFixed(2)}).`,
      sentiment: signals.roasGapPct > 0 ? "negative" : "positive",
    });
  }

  if (signals.cacGapPct != null) {
    items.push({
      id: "cac-gap",
      text:
        signals.cacGapPct > 0
          ? `CAC exceeds target by ${signals.cacGapPct}%.`
          : "CAC is within target range.",
      sentiment: signals.cacGapPct > 0 ? "negative" : "positive",
    });
  }

  if (signals.revenueGrowthPct != null) {
    items.push({
      id: "revenue-growth",
      text:
        signals.revenueGrowthPct >= 0
          ? `Revenue is still growing (+${signals.revenueGrowthPct}%).`
          : `Revenue declined ${Math.abs(signals.revenueGrowthPct)}% vs prior week.`,
      sentiment: signals.revenueGrowthPct >= 0 ? "positive" : "negative",
    });
  }

  items.push({
    id: "conversion",
    text: signals.conversionStable
      ? "Conversion rate is stable."
      : "Conversion rate is volatile — monitor before major budget shifts.",
    sentiment: signals.conversionStable ? "positive" : "neutral",
  });

  if (signals.assistedRevenue > 0) {
    items.push({
      id: "assisted",
      text: `Campaigns are generating $${signals.assistedRevenue.toLocaleString()} in assisted conversions.`,
      sentiment: "positive",
    });
  }

  return items;
}

export function computeStability(
  dailyMetrics: DailyMetricPoint[] | undefined,
  confidencePct: number,
): { status: "Stable" | "Monitoring" | "Volatile"; message: string; daysAboveThreshold: number } {
  if (!dailyMetrics || dailyMetrics.length < 7) {
    return {
      status: "Monitoring",
      message: "Insufficient daily history — strategy will update as more data arrives.",
      daysAboveThreshold: 0,
    };
  }

  const recent = dailyMetrics.slice(-7);
  const roasSeries = recent
    .filter((d) => d.adSpend > 0)
    .map((d) => d.revenue / d.adSpend);

  if (roasSeries.length < 4) {
    return {
      status: "Monitoring",
      message: "Paid spend history is limited — monitoring before changing strategy.",
      daysAboveThreshold: 0,
    };
  }

  const avg = roasSeries.reduce((a, b) => a + b, 0) / roasSeries.length;
  const variance = roasSeries.reduce((s, r) => s + (r - avg) ** 2, 0) / roasSeries.length;
  const cv = Math.sqrt(variance) / Math.max(avg, 0.01);
  const daysAboveThreshold = roasSeries.filter((r) => r >= avg * 0.85).length;

  if (cv < 0.18 && confidencePct >= 80 && daysAboveThreshold >= 5) {
    return {
      status: "Stable",
      message: `Confidence has remained above 80% with low ROAS variance over ${daysAboveThreshold} consecutive days.`,
      daysAboveThreshold,
    };
  }

  if (cv > 0.35) {
    return {
      status: "Volatile",
      message: "Performance is fluctuating — wait for a statistically meaningful shift before changing strategy.",
      daysAboveThreshold,
    };
  }

  return {
    status: "Monitoring",
    message: "Strategy is stable but performance is still normalizing — review weekly.",
    daysAboveThreshold,
  };
}

export function buildWhyNotForStrategy(
  strategy: AttributionStrategyId,
  signals: DecisionSignals,
  selected: AttributionStrategyId,
  objective: import("./decision-engine-types").AttributionBusinessObjective,
): string[] {
  if (strategy === selected) return [];

  const reasons: string[] = [];
  const be = signals.breakEven.breakEvenRoas;
  const avg = signals.avgRoas ?? 0;
  const growth = signals.revenueGrowthPct ?? 0;

  switch (strategy) {
    case "pause":
      if (signals.assistedRevenue > 0) {
        reasons.push("Campaigns still generate assisted revenue.");
      }
      if (growth > 0) reasons.push("Customer acquisition would stop while revenue is still growing.");
      reasons.push("Optimization opportunities remain before pausing entirely.");
      break;
    case "scale":
      if (avg < be) reasons.push(`ROAS ${avg.toFixed(2)} is below break-even ${be.toFixed(2)}.`);
      if (signals.netProfit < 0) reasons.push("Paid acquisition is not yet profitable.");
      if (objective === "maximize_profit" || objective === "preserve_cash_flow") {
        reasons.push("Scaling spend conflicts with profitability-focused objectives.");
      }
      break;
    case "reduce_budget":
      if (growth > 8) reasons.push("Revenue growth would be constrained by further budget cuts.");
      if (objective === "maximize_revenue" || objective === "maximize_growth") {
        reasons.push("Budget reduction conflicts with revenue and growth objectives.");
      }
      reasons.push("Efficiency improvements should be attempted before cutting spend.");
      break;
    case "optimize":
      if (signals.roasGapPct != null && signals.roasGapPct > 60) {
        reasons.push("Losses are severe enough that deeper cuts may be required.");
      }
      break;
    case "reallocate":
      if (!signals.hasWinnerLoser) {
        reasons.push("No clear winner/loser campaign split to reallocate from.");
      }
      break;
  }

  if (reasons.length === 0) {
    reasons.push("Another strategy scored higher for current performance signals.");
  }

  return reasons.slice(0, 4);
}
