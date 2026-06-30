import type {
  AiActionCard,
  AiChatMessage,
  AskAiResponse,
  BusinessContext,
} from "./types";
import type { Opportunity, Recommendation } from "@/lib/types";
import { recommendationHasMeasurableImpact } from "@/lib/recommendations/impact";
import { formatMonthlyImpact, formatNetProfitImpact } from "@/lib/opportunities/engine";
import {
  getSessionSummary,
  hasDiscussedTopic,
  recordTopic,
} from "./session";
import {
  analyzeSalesTrends,
  campaignHasDeliveryData,
  formatTrendLine,
  INSUFFICIENT_SALES_HISTORY_MESSAGE,
} from "./sales-trends";
import { summarizeWeeklyReport } from "@/lib/learning/weekly-report";
import {
  answerNetProfit,
  answerProductProfit,
  answerProfitDecrease,
  answerCollectionProfit,
  answerMarginWeek,
} from "@/lib/profit/advisor";
import {
  answerHiddenWinners,
  answerMostProfitableProducts,
  answerProductProfitDecrease,
  answerProductsLosingMoney,
  answerProductsNeedMoreAds,
  answerProductsToBundle,
  answerProductsToPromote,
  answerProductsToRestock,
} from "@/lib/products/advisor";
import {
  answerBiggestProblem,
  answerFastestProfit,
  answerFocusToday,
  answerInvestNext,
  answerStopDoing,
  answerWastingMoney,
} from "@/lib/autopilot/advisor";
import {
  answerAssistedTouchpoints,
  answerBestAcquisitionChannel,
  answerCampaignsMoreBudget,
  answerCreativesToPause,
  answerMetaRevenueDecline,
  answerRevenueNotProfitCampaigns,
} from "@/lib/attribution/advisor";
import {
  answerAdProfitable,
  answerBestChannel,
  answerIncreaseAdSpend,
  answerMetaVsBlended,
  answerRoasDecrease,
} from "@/lib/profit/roas-advisor";
import { isSimulationQuestion, runSimulation } from "./simulator";

type Intent =
  | "sales_decrease"
  | "reorder"
  | "campaign_waste"
  | "increase_revenue"
  | "bundle"
  | "customers"
  | "today"
  | "weekly_report"
  | "simulation"
  | "profit_decrease"
  | "net_profit"
  | "product_profit"
  | "collection_profit"
  | "margin_week"
  | "roas_decrease"
  | "meta_vs_blended"
  | "increase_ad_spend"
  | "ad_profitable"
  | "best_channel"
  | "product_ads"
  | "product_losing"
  | "product_profit_decrease"
  | "product_restock"
  | "product_bundle_ai"
  | "product_promote"
  | "hidden_winners"
  | "attr_budget"
  | "attr_pause_creative"
  | "attr_acquisition"
  | "attr_meta_decline"
  | "attr_rev_not_profit"
  | "attr_assisted"
  | "autopilot_problem"
  | "autopilot_fast_profit"
  | "autopilot_waste"
  | "autopilot_stop"
  | "autopilot_invest"
  | "general";

function detectIntent(question: string): Intent {
  const q = question.toLowerCase();
  if (isSimulationQuestion(question)) return "simulation";
  if (
    q.includes("what should i do") ||
    q.includes("do today") ||
    q.includes("focus today") ||
    q.includes("priorities today") ||
    (q.includes("today") && (q.includes("should") || q.includes("focus") || q.includes("priority")))
  ) {
    return "today";
  }
  if (q.includes("sales") && (q.includes("decrease") || q.includes("drop") || q.includes("down") || q.includes("why")))
    return "sales_decrease";
  if (q.includes("reorder") || q.includes("restock") || q.includes("inventory") || q.includes("stock"))
    return "reorder";
  if (q.includes("campaign") && (q.includes("wast") || q.includes("losing") || q.includes("bad") || q.includes("review")))
    return "campaign_waste";
  if (
    q.includes("campaign") &&
    (q.includes("pause") || q.includes("stop") || q.includes("should i"))
  ) {
    return "attr_pause_creative";
  }
  if (
    (q.includes("product") || q.includes("products")) &&
    (q.includes("ad budget") || q.includes("more ads") || q.includes("deserve"))
  ) {
    return "product_ads";
  }
  if (
    q.includes("sales") &&
    (q.includes("lower") || q.includes("down")) &&
    q.includes("week")
  ) {
    return "sales_decrease";
  }
  if (q.includes("revenue") || q.includes("increase sales") || q.includes("grow"))
    return "increase_revenue";
  if (q.includes("bundle") || q.includes("combine"))
    return "bundle";
  if (q.includes("weekly report") || q.includes("ai performance") || q.includes("prediction accuracy"))
    return "weekly_report";
  if (
    q.includes("roas") &&
    (q.includes("decrease") || q.includes("drop") || q.includes("down") || q.includes("why"))
  ) {
    return "roas_decrease";
  }
  if (
    q.includes("meta") &&
    q.includes("roas") &&
    (q.includes("blended") || q.includes("higher") || q.includes("than"))
  ) {
    return "meta_vs_blended";
  }
  if (
    (q.includes("increase") && (q.includes("ad spend") || q.includes("budget"))) ||
    q.includes("scale ad")
  ) {
    return "increase_ad_spend";
  }
  if (
    q.includes("advertising profitable") ||
    q.includes("ads profitable") ||
    (q.includes("advertising") && q.includes("making money")) ||
    q.includes("is advertising")
  ) {
    return "ad_profitable";
  }
  if (
    (q.includes("which channel") || q.includes("best channel")) &&
    (q.includes("perform") || q.includes("roas") || q.includes("profit"))
  ) {
    return "best_channel";
  }
  if (
    q.includes("profit") &&
    (q.includes("decrease") || q.includes("drop") || q.includes("down") || q.includes("why"))
  ) {
    return "profit_decrease";
  }
  if (
    q.includes("collection") &&
    (q.includes("profit") || q.includes("profitable") || q.includes("margin"))
  ) {
    return "collection_profit";
  }
  if (
    q.includes("margin") &&
    (q.includes("lower") || q.includes("week") || q.includes("this week") || q.includes("why"))
  ) {
    return "margin_week";
  }
  if (q.includes("assist") && (q.includes("conversion") || q.includes("touchpoint"))) {
    return "attr_assisted";
  }
  if (
    (q.includes("revenue") && q.includes("not") && q.includes("profit")) ||
    (q.includes("campaign") && q.includes("revenue") && q.includes("profit") && q.includes("not"))
  ) {
    return "attr_rev_not_profit";
  }
  if (
    q.includes("meta") &&
    (q.includes("decline") || q.includes("drop") || q.includes("down") || q.includes("why"))
  ) {
    return "attr_meta_decline";
  }
  if (
    (q.includes("acquire") || q.includes("acquisition") || q.includes("cac")) &&
    (q.includes("channel") || q.includes("profitable") || q.includes("customer"))
  ) {
    return "attr_acquisition";
  }
  if (
    (q.includes("creative") || q.includes("ad")) &&
    (q.includes("pause") || q.includes("stop") || q.includes("underperform"))
  ) {
    return "attr_pause_creative";
  }
  if (
    (q.includes("campaign") || q.includes("budget")) &&
    (q.includes("more") || q.includes("deserve") || q.includes("increase") || q.includes("scale"))
  ) {
    return "attr_budget";
  }
  if (q.includes("focus on today") || q.includes("what should i focus")) {
    return "today";
  }
  if (q.includes("biggest problem") || q.includes("main problem") || q.includes("worst issue")) {
    return "autopilot_problem";
  }
  if (q.includes("fastest") && (q.includes("profit") || q.includes("money"))) {
    return "autopilot_fast_profit";
  }
  if (q.includes("wasting money") || q.includes("waste money") || q.includes("where am i wasting")) {
    return "autopilot_waste";
  }
  if (q.includes("stop doing") || q.includes("should i stop")) {
    return "autopilot_stop";
  }
  if (q.includes("invest in next") || q.includes("what should i invest") || q.includes("invest next")) {
    return "autopilot_invest";
  }
  if (q.includes("hidden winner")) return "hidden_winners";
  if (
    (q.includes("advertis") || q.includes("ad spend") || q.includes("more ads")) &&
    q.includes("product")
  ) {
    return "product_ads";
  }
  if (
    q.includes("restock") ||
    (q.includes("stock") && q.includes("product")) ||
    (q.includes("inventory") && q.includes("which product"))
  ) {
    return "product_restock";
  }
  if (q.includes("promote") && q.includes("product")) return "product_promote";
  if (q.includes("promote this week")) return "product_promote";
  if (
    q.includes("bundle") &&
    (q.includes("which product") || q.includes("should i bundle"))
  ) {
    return "product_bundle_ai";
  }
  if (
    q.includes("product") &&
    q.includes("profit") &&
    (q.includes("decrease") || q.includes("drop") || q.includes("down") || q.includes("why"))
  ) {
    return "product_profit_decrease";
  }
  if (
    q.includes("losing money") ||
    q.includes("lose money") ||
    (q.includes("product") && q.includes("losing"))
  ) {
    return "product_losing";
  }
  if (
    q.includes("which product") ||
    q.includes("most profit") ||
    q.includes("most profitable") ||
    q.includes("top profit") ||
    q.includes("generate the most profit")
  ) {
    return "product_profit";
  }
  if (
    q.includes("net profit") ||
    q.includes("gross profit") ||
    q.includes("profit margin") ||
    q.includes("how much") && q.includes("make") ||
    q.includes("cogs") ||
    (q.includes("profit") && !q.includes("increase"))
  ) {
    return "net_profit";
  }
  if (q.includes("customer") || q.includes("target") || q.includes("audience"))
    return "customers";
  return "general";
}

function recToActionCard(rec: Recommendation, confidencePenalty = 0): AiActionCard {
  return {
    recommendationId: rec.id,
    title: rec.title.replace(/^[^:]+:\s*/, ""),
    reason: rec.reason,
    expectedImpact: rec.expectedImpact,
    confidence: Math.max(0.35, rec.confidenceScore - confidencePenalty),
    actionLabel: "Approve recommendation",
  };
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString()}`;
}

function answerSalesDecrease(ctx: BusinessContext, sessionId: string): AskAiResponse {
  const topic = "sales_decrease";
  const brief = !hasDiscussedTopic(sessionId, topic);
  const trendAnalysis = analyzeSalesTrends(ctx.salesTrends);
  const lines: string[] = [];

  if (!trendAnalysis.hasSufficientHistory) {
    lines.push(INSUFFICIENT_SALES_HISTORY_MESSAGE);
    recordTopic(sessionId, topic);
    return buildResponse(sessionId, lines.join("\n\n"), []);
  }

  if (brief) {
    lines.push(
      `I compared your synced sales periods (${ctx.isDemo ? "demo" : "live"} data) before drawing conclusions:`,
    );
  } else {
    lines.push("Building on our earlier analysis:");
  }

  if (trendAnalysis.weekOverWeek) {
    lines.push(formatTrendLine("This week vs last week", trendAnalysis.weekOverWeek));
  }
  if (trendAnalysis.monthOverMonth) {
    lines.push(
      formatTrendLine("Last 30 days vs previous 30 days", trendAnalysis.monthOverMonth),
    );
  }

  if (!trendAnalysis.salesDecreased) {
    lines.push(
      "\nBased on these comparisons, **sales have not decreased** in the periods with available history.",
    );
    recordTopic(sessionId, topic);
    return buildResponse(sessionId, lines.join("\n\n"), []);
  }

  lines.push("\n**Sales are down** in at least one comparison window. Contributing factors from your store data:");

  const lowStock = ctx.lowStockProducts[0];
  if (lowStock) {
    lines.push(
      `• **${lowStock.title}** has only ${lowStock.inventory} units (~${lowStock.daysOfCover.toFixed(0)} days of cover) — stockouts may have capped revenue.`,
    );
  }

  const weakCampaign = ctx.hasActiveMetaCampaigns
    ? ctx.campaigns.find((c) => c.roas7d < 1 && campaignHasDeliveryData(c))
    : undefined;
  if (weakCampaign) {
    lines.push(
      `• **${weakCampaign.name}** spent ${formatCurrency(weakCampaign.spend7d)} for ${formatCurrency(weakCampaign.revenue7d)} return (ROAS ${weakCampaign.roas7d.toFixed(2)}) — ad efficiency may be dragging performance.`,
    );
  }

  const slowCount = ctx.slowProducts.length;
  if (slowCount > 0) {
    lines.push(`• ${slowCount} SKU(s) show slow sell-through, tying up cash without contributing to weekly velocity.`);
  }

  lines.push(
    `Store health score: **${ctx.healthScore}/100**. ${ctx.aiBrief.criticalAlertCount} critical alert(s) need attention.`,
  );

  const actions = ctx.activeRecommendations
    .filter((r) => ["low_inventory", "campaign_review", "slow_selling"].includes(r.category))
    .slice(0, 3)
    .map((rec) => recToActionCard(rec, trendAnalysis.confidencePenalty));

  recordTopic(sessionId, topic);
  return buildResponse(sessionId, lines.join("\n\n"), actions);
}

function answerReorder(ctx: BusinessContext, sessionId: string): AskAiResponse {
  const topic = "reorder";
  const lines: string[] = [];

  if (ctx.lowStockProducts.length === 0) {
    lines.push("No products are currently flagged for urgent reorder based on inventory velocity.");
  } else {
    lines.push("These products should be reordered first, based on days-of-cover and 30-day sell-through:");
    for (const p of ctx.lowStockProducts.slice(0, 4)) {
      lines.push(
        `• **${p.title}** — ${p.inventory} units left (~${p.daysOfCover.toFixed(1)} days of cover)`,
      );
    }
  }

  const actions = ctx.activeRecommendations
    .filter((r) => r.category === "low_inventory")
    .slice(0, 3)
    .map(recToActionCard);

  recordTopic(sessionId, topic);
  return buildResponse(sessionId, lines.join("\n\n"), actions);
}

function answerCampaignWaste(ctx: BusinessContext, sessionId: string): AskAiResponse {
  const topic = "campaign_waste";
  const lines: string[] = [];

  if (!ctx.hasActiveAdsConnector) {
    lines.push(
      "No ad platform is connected yet. Connect **Meta Ads**, **Google Ads**, or **TikTok Ads** to analyze campaign ROAS, spend, and frequency.",
      "",
      "Until then, I can only advise on Shopify inventory, merchandising, and promotions.",
    );
    recordTopic(sessionId, topic);
    return buildResponse(sessionId, lines.join("\n\n"), []);
  }

  if (!ctx.hasActiveMetaCampaigns) {
    lines.push("No active Meta campaigns found.");
    recordTopic(sessionId, topic);
    return buildResponse(sessionId, lines.join("\n\n"), []);
  }

  const wasteful = ctx.campaigns
    .filter((c) => campaignHasDeliveryData(c))
    .filter((c) => c.roas7d < 1.2 || c.frequency7d > 4)
    .sort((a, b) => a.roas7d - b.roas7d);

  const undelivered = ctx.campaigns.filter((c) => !campaignHasDeliveryData(c));

  if (wasteful.length === 0) {
    if (undelivered.length > 0) {
      lines.push(
        `No active campaigns with sufficient delivery data are flagged as wasteful. ${undelivered.length} active campaign${undelivered.length === 1 ? "" : "s"} ${undelivered.length === 1 ? "has" : "have"} not accumulated enough delivery data to evaluate performance.`,
      );
    } else {
      lines.push(
        "No Meta campaigns are currently flagged as wasteful. All active campaigns with delivery data meet ROAS and frequency thresholds.",
      );
    }
  } else {
    lines.push("These campaigns need review — efficiency is below target:");
    for (const c of wasteful) {
      lines.push(
        `• **${c.name}** — ROAS ${c.roas7d.toFixed(2)}, spend ${formatCurrency(c.spend7d)}/week, frequency ${c.frequency7d.toFixed(1)}`,
      );
    }
    lines.push(
      "\nI recommend reviewing targeting and creative before reducing budget. Pausing abruptly can hurt retargeting pools.",
    );
  }

  const actions = ctx.activeRecommendations
    .filter((r) => r.category === "campaign_review")
    .slice(0, 2)
    .map(recToActionCard);

  recordTopic(sessionId, topic);
  return buildResponse(sessionId, lines.join("\n\n"), actions);
}

function answerIncreaseRevenue(ctx: BusinessContext, sessionId: string): AskAiResponse {
  const topic = "increase_revenue";
  const lines: string[] = [
    `Estimated revenue opportunity this month: **${formatCurrency(ctx.aiBrief.estimatedRevenueOpportunity)}** based on active recommendations.`,
    "",
    "Top levers from your store data:",
  ];

  for (const p of ctx.aiBrief.topPriorities) {
    lines.push(`${p.rank}. **${p.title}** — ${p.detail}`);
  }

  if (ctx.activeRecommendations.some((r) => r.category === "homepage_merchandising")) {
    lines.push("\n• Homepage merchandising: surfacing your top collection could lift CTR 10–18%.");
  }

  const actions = ctx.activeRecommendations
    .filter((r) =>
      ["bundle_opportunity", "promotion_opportunity", "homepage_merchandising", "low_inventory"].includes(
        r.category,
      ),
    )
    .slice(0, 3)
    .map(recToActionCard);

  recordTopic(sessionId, topic);
  return buildResponse(sessionId, lines.join("\n"), actions);
}

function answerBundle(ctx: BusinessContext, sessionId: string): AskAiResponse {
  const topic = "bundle";
  const bundleRecs = ctx.activeRecommendations.filter((r) => r.category === "bundle_opportunity");
  const lines: string[] = [];

  if (bundleRecs.length > 0) {
    lines.push(bundleRecs[0].reason);
    lines.push(`\nExpected impact: ${bundleRecs[0].expectedImpact}`);
  } else {
    const candidates = ctx.topProducts.filter((p) => p.unitsSold30d >= 20).slice(0, 2);
    if (candidates.length >= 2) {
      lines.push(
        `Consider bundling **${candidates[0].title}** and **${candidates[1].title}** — both show steady 30-day demand (${candidates[0].unitsSold30d} and ${candidates[1].unitsSold30d} units sold).`,
      );
    } else {
      lines.push("No strong bundle candidates detected yet. Need at least 2 SKUs with correlated demand.");
    }
  }

  const actions = bundleRecs.slice(0, 2).map(recToActionCard);
  recordTopic(sessionId, topic);
  return buildResponse(sessionId, lines.join("\n\n"), actions);
}

function answerCustomers(ctx: BusinessContext, sessionId: string): AskAiResponse {
  const topic = "customers";
  const lines: string[] = [
    `Your store processed **${ctx.storeMetrics.orders30d} orders** in the last 30 days (AOV ${formatCurrency(ctx.storeMetrics.aov30d)}).`,
    "",
    "Customer targeting recommendations based on purchase patterns:",
    `• **High-AOV buyers** — target with bundle offers (AOV lift opportunity)`,
    `• **Repeat-category buyers** — ${ctx.topProducts[0]?.title ?? "top SKU"} buyers are your core segment (${ctx.topProducts[0]?.unitsSold30d ?? 0} units / 30d)`,
  ];

  const retarget = ctx.hasActiveMetaCampaigns
    ? ctx.campaigns.find((c) => c.name.toLowerCase().includes("retarget"))
    : undefined;
  if (retarget) {
    lines.push(
      `• **Cart abandoners** — your Retargeting campaign shows ROAS ${retarget.roas7d.toFixed(2)}; ${retarget.frequency7d > 4 ? "frequency is high — refresh creative before expanding audience" : "audience is healthy for scaling"}`,
    );
  }

  if (ctx.slowProducts.length > 0) {
    lines.push(
      `• **Win-back segment** — customers who bought slow movers like ${ctx.slowProducts[0].title} may respond to limited offers`,
    );
  }

  recordTopic(sessionId, topic);
  return buildResponse(sessionId, lines.join("\n"), []);
}

function opportunityToActionCard(opp: Opportunity, rec?: Recommendation): AiActionCard {
  return {
    recommendationId: rec?.id ?? opp.recommendationId,
    title: opp.title,
    reason: opp.description,
    expectedImpact: `Est. ${formatNetProfitImpact(opp.estimatedMonthlyNetProfitImpact)}/month net profit`,
    confidence: opp.confidenceScore,
    actionLabel: "Review opportunity",
  };
}

function answerTodayPriorities(ctx: BusinessContext, sessionId: string): AskAiResponse {
  const topic = "today";
  const opportunities = ctx.topOpportunities;
  const lines: string[] = [];

  if (opportunities.length === 0) {
    lines.push(
      "I don't have ranked growth opportunities yet — connect Shopify and sync your store data.",
      "",
      `Store health: **${ctx.healthScore}/100**. Critical alerts: ${ctx.aiBrief.criticalAlertCount}.`,
    );
    recordTopic(sessionId, topic);
    return buildResponse(sessionId, lines.join("\n"), []);
  }

  const totalImpact = opportunities.reduce(
    (sum, o) => sum + o.estimatedMonthlyNetProfitImpact,
    0,
  );

  lines.push(
    `Here are your **top profit opportunities** for today (${ctx.isDemo ? "demo" : "live"} data), ranked by expected net profit impact:`,
    "",
    `Combined upside: **${formatNetProfitImpact(totalImpact)}/month** net profit across ${opportunities.length} opportunities.`,
    "",
  );

  for (const [i, opp] of opportunities.slice(0, 5).entries()) {
    lines.push(
      `**${i + 1}. ${opp.title}**`,
      `• Impact: ${formatNetProfitImpact(opp.estimatedMonthlyNetProfitImpact)}/month net profit · ${opp.implementationEffort} effort · ${Math.round(opp.confidenceScore * 100)}% confidence`,
      `• ${opp.requiredActions[0]}`,
      "",
    );
  }

  if (ctx.aiBrief.criticalAlertCount > 0) {
    lines.push(
      `_Note: ${ctx.aiBrief.criticalAlertCount} critical alert(s) also need attention — check the dashboard after tackling growth levers._`,
    );
  }

  const recById = new Map(ctx.activeRecommendations.map((r) => [r.id, r]));
  const actions = opportunities
    .slice(0, 3)
    .map((opp) => {
      const rec = opp.recommendationId ? recById.get(opp.recommendationId) : undefined;
      return opportunityToActionCard(opp, rec);
    });

  recordTopic(sessionId, topic);
  return buildResponse(sessionId, lines.join("\n"), actions);
}

function answerWeeklyReport(ctx: BusinessContext, sessionId: string): AskAiResponse {
  const topic = "weekly_report";
  const report = ctx.weeklyReport;
  const perf = ctx.aiPerformance;
  const lines = [
    ...summarizeWeeklyReport(report),
    "",
    "**AI Performance (all time)**",
    `• Prediction accuracy: **${perf.predictionAccuracy}%**`,
    `• Measured recommendations: **${perf.measuredCount}**`,
    `• Revenue influenced: **$${perf.revenueInfluenced.toLocaleString()}**`,
    `• Best category: **${perf.bestCategoryLabel}**`,
  ];

  recordTopic(sessionId, topic);
  return buildResponse(sessionId, lines.join("\n"), []);
}

function answerGeneral(ctx: BusinessContext, sessionId: string): AskAiResponse {
  const sessionNote = getSessionSummary(sessionId);
  const lines: string[] = [
    `I'm your StorePilot AI advisor. Here's a snapshot of your store (${ctx.dataSourceSummary}):`,
    "",
    `• Health score: **${ctx.healthScore}/100**`,
    `• Revenue (30d): ${formatCurrency(ctx.storeMetrics.revenue30d)} | Orders: ${ctx.storeMetrics.orders30d}`,
    `• Products: ${ctx.productCount} | Inventory units: ${ctx.inventoryUnits}`,
    `• Active recommendations: ${ctx.activeRecommendations.length}`,
    "",
    "Ask me what you should do today, about sales trends, reorder priorities, campaign efficiency, bundles, or revenue growth.",
  ];

  if (sessionNote) lines.push(`\n_${sessionNote}_`);

  const actions = ctx.activeRecommendations.slice(0, 2).map(recToActionCard);
  recordTopic(sessionId, "general");
  return buildResponse(sessionId, lines.join("\n"), actions);
}

function buildResponse(
  sessionId: string,
  content: string,
  actionCards: AiActionCard[],
  simulation?: AskAiResponse["message"]["simulation"],
): AskAiResponse {
  const message: AiChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    actionCards: actionCards.length > 0 ? actionCards : undefined,
    simulation,
    createdAt: new Date().toISOString(),
  };

  return { message, sessionId };
}

async function tryOpenAI(
  ctx: BusinessContext,
  question: string,
  sessionId: string,
): Promise<AskAiResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const systemPrompt = `You are StorePilot AI, a Shopify business advisor. Answer using ONLY the provided store data. Be specific with numbers. Suggest actionable next steps. Never recommend automatic store changes. Use markdown sparingly (bold for emphasis).

Trend analysis rules:
- When asked why sales decreased, NEVER assume sales actually decreased.
- First compare this week vs last week and last 30 days vs previous 30 days using salesTrends.
- If salesTrends is missing or has insufficient history, respond: "I cannot determine whether sales decreased because there isn't enough historical sales data."
- Only cite contributing factors (inventory, campaigns) if comparisons show a real decrease.
- For campaigns: do not recommend ROAS changes when spend, impressions, or purchases/revenue are zero. Say the campaign has not accumulated enough delivery data to evaluate performance.
- Do not suggest recommendations with $0 expected impact.

Opportunity-first guidance:
- When asked what to do today, prioritize topOpportunities (growth levers) over problem alerts.
- Lead with estimated monthly net profit impact, effort level, and the first required action for each opportunity.

Session note: ${getSessionSummary(sessionId)}

Store context:
${JSON.stringify({
  healthScore: ctx.healthScore,
  metrics: ctx.storeMetrics,
  salesTrends: ctx.salesTrends,
  topProducts: ctx.topProducts,
  lowStock: ctx.lowStockProducts,
  campaigns: ctx.hasActiveMetaCampaigns ? ctx.campaigns : [],
  hasActiveMetaCampaigns: ctx.hasActiveMetaCampaigns,
  brief: ctx.aiBrief,
  activeRecommendationTitles: ctx.activeRecommendations.map((r) => r.title),
  blendedRoas: ctx.profitDashboard?.blendedRoas
    ? {
        blendedRoas30d: ctx.profitDashboard.blendedRoas.blendedRoas30d,
        metaRoas30d: ctx.profitDashboard.blendedRoas.metaRoas30d,
        isAdvertisingProfitable: ctx.profitDashboard.blendedRoas.isAdvertisingProfitable,
        confidence: ctx.profitDashboard.blendedRoas.confidence,
      }
    : null,
  topOpportunities: ctx.topOpportunities.map((o) => ({
    title: o.title,
    category: o.category,
    monthlyImpact: o.estimatedMonthlyNetProfitImpact,
    effort: o.implementationEffort,
    confidence: o.confidenceScore,
    actions: o.requiredActions,
  })),
})}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        temperature: 0.4,
        max_tokens: 800,
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const intent = detectIntent(question);
    recordTopic(sessionId, intent);

    const trendAnalysis = analyzeSalesTrends(ctx.salesTrends);
    const penalty =
      intent === "sales_decrease" && !trendAnalysis.hasSufficientHistory
        ? trendAnalysis.confidencePenalty
        : 0;
    const actions = ctx.activeRecommendations
      .filter(recommendationHasMeasurableImpact)
      .slice(0, 2)
      .map((rec) => recToActionCard(rec, penalty));
    return buildResponse(sessionId, content, actions);
  } catch {
    return null;
  }
}

export async function generateAdvisorResponse(
  ctx: BusinessContext,
  question: string,
  sessionId: string,
): Promise<AskAiResponse> {
  const simulation = runSimulation(ctx, question);
  if (simulation) {
    recordTopic(sessionId, "simulation");
    const content = `**Scenario: ${simulation.scenario}**\n\n${simulation.summary}\n\n**Estimated impact:** ${simulation.estimatedImpact}`;
    return buildResponse(sessionId, content, [], simulation);
  }

  const openAi = await tryOpenAI(ctx, question, sessionId);
  if (openAi) return openAi;

  const intent = detectIntent(question);

  switch (intent) {
    case "sales_decrease":
      return answerSalesDecrease(ctx, sessionId);
    case "reorder":
      return answerReorder(ctx, sessionId);
    case "campaign_waste":
      return answerCampaignWaste(ctx, sessionId);
    case "increase_revenue":
      return answerIncreaseRevenue(ctx, sessionId);
    case "bundle":
      return answerBundle(ctx, sessionId);
    case "customers":
      return answerCustomers(ctx, sessionId);
    case "today":
      return ctx.autopilotDashboard
        ? answerFocusToday(ctx, sessionId)
        : answerTodayPriorities(ctx, sessionId);
    case "weekly_report":
      return answerWeeklyReport(ctx, sessionId);
    case "profit_decrease":
      return answerProfitDecrease(ctx, sessionId);
    case "net_profit":
      return answerNetProfit(ctx, sessionId);
    case "product_profit":
      return ctx.productIntelligence
        ? answerMostProfitableProducts(ctx, sessionId)
        : answerProductProfit(ctx, sessionId);
    case "product_ads":
      return answerProductsNeedMoreAds(ctx, sessionId);
    case "product_losing":
      return answerProductsLosingMoney(ctx, sessionId);
    case "product_profit_decrease":
      return answerProductProfitDecrease(ctx, sessionId);
    case "product_restock":
      return answerProductsToRestock(ctx, sessionId);
    case "product_bundle_ai":
      return answerProductsToBundle(ctx, sessionId);
    case "product_promote":
      return answerProductsToPromote(ctx, sessionId);
    case "hidden_winners":
      return answerHiddenWinners(ctx, sessionId);
    case "attr_budget":
      return answerCampaignsMoreBudget(ctx, sessionId);
    case "attr_pause_creative":
      return answerCreativesToPause(ctx, sessionId);
    case "attr_acquisition":
      return answerBestAcquisitionChannel(ctx, sessionId);
    case "attr_meta_decline":
      return answerMetaRevenueDecline(ctx, sessionId);
    case "attr_rev_not_profit":
      return answerRevenueNotProfitCampaigns(ctx, sessionId);
    case "attr_assisted":
      return answerAssistedTouchpoints(ctx, sessionId);
    case "autopilot_problem":
      return answerBiggestProblem(ctx, sessionId);
    case "autopilot_fast_profit":
      return answerFastestProfit(ctx, sessionId);
    case "autopilot_waste":
      return answerWastingMoney(ctx, sessionId);
    case "autopilot_stop":
      return answerStopDoing(ctx, sessionId);
    case "autopilot_invest":
      return answerInvestNext(ctx, sessionId);
    case "collection_profit":
      return answerCollectionProfit(ctx, sessionId);
    case "margin_week":
      return answerMarginWeek(ctx, sessionId);
    case "roas_decrease":
      return answerRoasDecrease(ctx, sessionId);
    case "meta_vs_blended":
      return answerMetaVsBlended(ctx, sessionId);
    case "increase_ad_spend":
      return answerIncreaseAdSpend(ctx, sessionId);
    case "ad_profitable":
      return answerAdProfitable(ctx, sessionId);
    case "best_channel":
      return answerBestChannel(ctx, sessionId);
    case "simulation": {
      const sim = runSimulation(ctx, question);
      if (sim) {
        return buildResponse(
          sessionId,
          `**Scenario: ${sim.scenario}**\n\n${sim.summary}`,
          [],
          sim,
        );
      }
      return answerGeneral(ctx, sessionId);
    }
    default:
      return answerGeneral(ctx, sessionId);
  }
}
