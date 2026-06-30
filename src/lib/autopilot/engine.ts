import type { Recommendation } from "@/lib/types";
import { buildActionQueue } from "./actions";
import { buildAutopilotAlerts } from "./alerts";
import { buildBudgetRecommendations } from "./budget";
import { buildExecutiveDailyBrief } from "./brief";
import { buildInventoryForecasts, buildProfitForecasts } from "./forecast";
import { computeExecutiveHealthScore } from "./health";
import { buildPricingRecommendations } from "./pricing";
import { buildDecisionTimeline } from "./timeline";
import type { AutopilotContext, AutopilotDashboard } from "./types";

export function buildAutopilotDashboard(
  ctx: AutopilotContext,
  allRecommendations: Recommendation[] = [],
): AutopilotDashboard {
  const netMargin = ctx.profitDashboard?.primary.profitMarginPct ?? 38;

  const executiveHealth = computeExecutiveHealthScore(
    ctx.snapshot,
    ctx.profitDashboard,
    ctx.productIntelligence,
    ctx.attributionDashboard,
    ctx.storeHealthScore,
  );

  const profitForecasts = buildProfitForecasts(ctx.snapshot, ctx.profitDashboard);
  const inventoryForecasts = buildInventoryForecasts(ctx.snapshot.products, netMargin);
  const budgetRecommendations = buildBudgetRecommendations(ctx.attributionDashboard);
  const pricingRecommendations = buildPricingRecommendations(
    ctx.snapshot,
    ctx.productIntelligence,
  );
  const alerts = buildAutopilotAlerts(ctx);
  const actions = buildActionQueue(
    ctx.topOpportunities,
    ctx.activeRecommendations,
    ctx.criticalAlerts,
    budgetRecommendations,
    pricingRecommendations,
    inventoryForecasts,
  );
  const executiveBrief = buildExecutiveDailyBrief(ctx, actions, executiveHealth.score);
  const timeline = buildDecisionTimeline(allRecommendations, ctx.snapshot.syncedAt);

  return {
    syncedAt: ctx.snapshot.syncedAt,
    executiveBrief,
    executiveHealth,
    actions,
    profitForecasts,
    inventoryForecasts,
    budgetRecommendations,
    pricingRecommendations,
    alerts,
    timeline,
  };
}

export function summarizeAutopilotForAi(dashboard: AutopilotDashboard): string {
  const top = dashboard.actions[0];
  return [
    `Executive health ${dashboard.executiveHealth.score}/100 (${dashboard.executiveHealth.label}).`,
    top ? `Top action: ${top.title} (+$${top.expectedNetProfitGain.toLocaleString()}/mo, ${Math.round(top.confidenceScore * 100)}% confidence).` : "",
    `${dashboard.alerts.length} active alerts · ${dashboard.actions.length} prioritized actions.`,
  ]
    .filter(Boolean)
    .join(" ");
}
