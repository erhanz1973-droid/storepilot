import { parseRevenueImpact } from "@/lib/approvals/presenter";
import { effortForCategory } from "@/lib/approvals/effort";
import { isActionableRecommendation } from "@/lib/approvals/filters";
import { analyzerOutputToRecommendation } from "@/lib/recommendations/registry";
import type { Recommendation } from "@/lib/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import {
  buildFirstValueInsight,
  FIRST_VALUE_DEDUPE_KEY,
  isFirstValueRecommendation,
  type FirstValueInsight,
} from "@/lib/first-run/first-value";
import type {
  FirstRunAnalyzeResult,
  FirstRunDecision,
  FirstRunFirstValue,
  FirstRunStage,
  FirstRunStageId,
} from "@/lib/first-run/types";
import { classifyMerchantStage } from "@/lib/growth-copilot";

const STAGE_LABELS: Record<FirstRunStageId, string> = {
  shopify_connected: "Shopify connected",
  analyzing_products: "Analyzing products…",
  analyzing_orders: "Analyzing orders…",
  checking_inventory: "Checking inventory…",
  calculating_profitability: "Calculating profitability…",
  looking_for_growth: "Looking for growth opportunities…",
  preparing_briefing: "Preparing your executive briefing…",
};

function effortMinutes(category: Recommendation["category"]): number {
  const effort = effortForCategory(category);
  if (effort === "Low") return 15;
  if (effort === "Medium") return 30;
  return 45;
}

function riskFromEffort(category: Recommendation["category"]): string {
  const effort = effortForCategory(category);
  if (effort === "Low") return "Low Risk";
  if (effort === "Medium") return "Medium Risk";
  return "Higher effort";
}

export function buildFirstRunStages(input: {
  shopifyConnected: boolean;
  products: number;
  orders: number;
  inventorySkus: number;
  hasProfit: boolean;
  recommendationCount: number;
}): FirstRunStage[] {
  const ids: FirstRunStageId[] = [
    "shopify_connected",
    "analyzing_products",
    "analyzing_orders",
    "checking_inventory",
    "calculating_profitability",
    "looking_for_growth",
    "preparing_briefing",
  ];

  const details: Partial<Record<FirstRunStageId, string>> = {
    shopify_connected: input.shopifyConnected ? "Live store linked" : "Waiting for connection",
    analyzing_products: `${input.products.toLocaleString()} products`,
    analyzing_orders: `${input.orders.toLocaleString()} orders (30d)`,
    checking_inventory: `${input.inventorySkus.toLocaleString()} SKUs reviewed`,
    calculating_profitability: input.hasProfit
      ? "Cost and margin signals loaded"
      : "Using revenue signals until costs are set",
    looking_for_growth: `${input.recommendationCount} opportunities scored`,
    preparing_briefing: "Selecting today's #1 decision",
  };

  return ids.map((id, index) => {
    let status: FirstRunStage["status"] = "pending";
    if (!input.shopifyConnected) {
      status = index === 0 ? "active" : "pending";
    } else if (index < ids.length - 1 || input.recommendationCount >= 0) {
      status = "done";
    }
    return {
      id,
      label: STAGE_LABELS[id],
      status,
      detail: details[id],
    };
  });
}

export function pickBestRecommendation(recs: Recommendation[]): Recommendation | null {
  const actionable = recs.filter(isActionableRecommendation);
  const pool = actionable.length > 0 ? actionable : recs;
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => {
    const impactDiff =
      parseRevenueImpact(b.expectedImpact) - parseRevenueImpact(a.expectedImpact);
    if (impactDiff !== 0) return impactDiff;
    return b.confidenceScore - a.confidenceScore;
  })[0];
}

function toFirstValuePayload(insight: FirstValueInsight): FirstRunFirstValue {
  return {
    kind: insight.kind,
    headline: insight.headline,
    body: insight.body,
    known: insight.known,
    unknown: insight.unknown,
    nextActions: insight.nextActions,
    primaryAction: insight.primaryAction,
    whyThisMatters: insight.whyThisMatters,
    whatToDoNext: insight.whatToDoNext,
    recommendationType: insight.recommendationType,
  };
}

export function toFirstRunDecision(
  rec: Recommendation,
  stats: FirstRunAnalyzeResult["stats"],
  insight: FirstValueInsight | null,
): FirstRunDecision {
  const impactMonthly = parseRevenueImpact(rec.expectedImpact);
  const rawConfidence = rec.confidenceScore;
  const confidencePct = Math.round(
    Math.min(99, Math.max(1, rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence)),
  );
  const estimatedMinutes = effortMinutes(rec.category);
  const risk = riskFromEffort(rec.category);
  const evidencePoints = rec.supportingMetrics
    .slice(0, 4)
    .map((m) => `${m.label}: ${m.value}`);
  if (evidencePoints.length === 0 && rec.reason) {
    evidencePoints.push(rec.reason.slice(0, 180));
  }

  const presentation =
    impactMonthly > 0 && !isFirstValueRecommendation(rec)
      ? "executive_decision"
      : "first_insight";

  const confidenceSummary =
    confidencePct >= 85
      ? `Confidence is ${confidencePct}% because store data shows a clear, high-impact pattern with consistent supporting metrics.`
      : confidencePct >= 70
        ? `Confidence is ${confidencePct}% based on ${stats.productsAnalyzed} products and ${stats.ordersAnalyzed} recent orders in your catalog.`
        : `Confidence is ${confidencePct}% — this is still the strongest opportunity among ${stats.productsAnalyzed} products analyzed, but evidence is thinner.`;

  const impactLabel =
    impactMonthly > 0
      ? `+$${Math.round(impactMonthly).toLocaleString()}`
      : rec.expectedImpact;

  const persistedHref =
    rec.id && rec.id !== FIRST_VALUE_DEDUPE_KEY
      ? `/recommendations/${rec.id}`
      : insight?.primaryAction.href ?? "/products";
  const primaryCta =
    presentation === "first_insight"
      ? {
          label: insight?.primaryAction.label ?? rec.actionLabel ?? "Review product",
          href: persistedHref,
        }
      : {
          label: rec.actionLabel || "Approve",
          href: `/approvals?recommendationId=${encodeURIComponent(rec.id)}`,
        };

  return {
    recommendationId: rec.id,
    title: rec.title,
    actionLabel: rec.actionLabel || "Approve",
    reason: rec.reason,
    expectedImpactLabel: rec.expectedImpact,
    impactMonthly,
    confidencePct,
    estimatedMinutes,
    risk,
    evidencePoints,
    category: rec.category,
    presentation,
    recommendationType:
      insight?.recommendationType ??
      (isFirstValueRecommendation(rec) ? "best_seller_focus" : rec.category),
    whyThisMatters:
      insight?.whyThisMatters ??
      rec.reason ??
      "This is the strongest evidence-backed move StorePilot can support from your connected store data.",
    whatToDoNext:
      insight?.whatToDoNext ??
      `${rec.actionLabel || "Review"} this recommendation, then return to Executive for the next decision.`,
    primaryCta,
    why: {
      productsAnalyzed: stats.productsAnalyzed,
      ordersAnalyzed: stats.ordersAnalyzed,
      campaignsAnalyzed: stats.campaignsAnalyzed,
      confidenceSummary,
    },
    approvePreview: {
      estimatedMonthlyImprovement: impactLabel.startsWith("+")
        ? `${impactLabel}/mo`
        : impactLabel,
      estimatedImplementationTime: `${estimatedMinutes} minutes`,
      riskLevel: risk,
      expectedConfidence: `${confidencePct}%`,
    },
  };
}

export function extraAnalyzerOutputsForFirstValue(snapshot: StoreSnapshot) {
  const insight = buildFirstValueInsight(snapshot);
  return insight.output ? [insight.output] : [];
}

export function assembleFirstRunAnalyzeResult(input: {
  storeId: string;
  shopifyConnected: boolean;
  snapshot: StoreSnapshot;
  recommendations: Recommendation[];
  hasProfit: boolean;
  durationMs: number;
}): FirstRunAnalyzeResult {
  const productsAnalyzed = input.snapshot.products.length;
  const ordersAnalyzed =
    input.snapshot.commerceOrders?.length ?? input.snapshot.storeMetrics.orders30d ?? 0;
  const campaignsAnalyzed =
    input.snapshot.campaigns.length +
    (input.snapshot.googleAdsSnapshot?.campaigns?.length ?? 0);
  const inventorySkus = input.snapshot.products.filter(
    (p) => p.inventoryTracked !== false,
  ).length;

  const stats = {
    productsAnalyzed,
    ordersAnalyzed,
    campaignsAnalyzed,
    inventorySkus,
  };

  const insight = buildFirstValueInsight(input.snapshot);
  const firstValue = toFirstValuePayload(insight);
  const merchantStage = classifyMerchantStage({ snapshot: input.snapshot }).stage;

  if (!input.shopifyConnected) {
    return {
      ok: false,
      storeId: input.storeId,
      shopifyConnected: false,
      stages: buildFirstRunStages({
        shopifyConnected: false,
        products: productsAnalyzed,
        orders: ordersAnalyzed,
        inventorySkus,
        hasProfit: false,
        recommendationCount: 0,
      }),
      stats,
      decision: null,
      firstValue,
      merchantStage,
      emptyReason:
        "Connect Shopify so StorePilot can analyze your catalog and prepare your first executive recommendation.",
      durationMs: input.durationMs,
    };
  }

  let best = pickBestRecommendation(input.recommendations);
  if (!best && insight.output) {
    best = analyzerOutputToRecommendation(insight.output, new Date().toISOString());
  }

  const decision = best
    ? toFirstRunDecision(
        best,
        stats,
        isFirstValueRecommendation(best) ? insight : null,
      )
    : null;

  const stages = buildFirstRunStages({
    shopifyConnected: true,
    products: productsAnalyzed,
    orders: ordersAnalyzed,
    inventorySkus,
    hasProfit: input.hasProfit,
    recommendationCount: input.recommendations.length + (insight.output ? 1 : 0),
  });

  let emptyReason: string | null = null;
  if (!decision) {
    emptyReason =
      insight.kind === "low_data"
        ? insight.body
        : campaignsAnalyzed === 0
          ? `We analyzed ${productsAnalyzed.toLocaleString()} products and ${ordersAnalyzed.toLocaleString()} orders. Connect Meta or Google Ads to unlock advertising recommendations, or add product costs to sharpen profit opportunities.`
          : `We analyzed ${productsAnalyzed.toLocaleString()} products and ${ordersAnalyzed.toLocaleString()} orders, but no high-confidence actionable recommendation is ready yet. Sync again after more store activity.`;
  }

  return {
    ok: true,
    storeId: input.storeId,
    shopifyConnected: true,
    stages,
    stats,
    decision,
    firstValue,
    merchantStage,
    emptyReason,
    durationMs: input.durationMs,
  };
}
