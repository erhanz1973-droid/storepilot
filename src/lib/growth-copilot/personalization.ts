import type { DecisionItem } from "@/lib/decisions/center";
import type { MerchantStage } from "./types";

/**
 * Topic boosts for the existing Decision Engine.
 * Does not replace Merchant DNA growthStage personalization — it layers on top.
 */
export const MERCHANT_STAGE_PRIORITIES: Record<
  MerchantStage,
  { focus: string; boostTopics: string[]; suppressTopics: string[] }
> = {
  new: {
    focus: "Store setup, product quality, and first sales",
    boostTopics: [
      "landing_page",
      "winning_products",
      "marketing_efficiency",
      "store_setup",
      "product_quality",
    ],
    suppressTopics: [
      "roas_optimization",
      "campaign_scaling",
      "product_scaling",
      "inventory_clearance",
      "dead_inventory",
      "cash_flow",
      "customer_ltv",
      "churn_risk",
    ],
  },
  growing: {
    focus: "Marketing optimization, conversion, and product profitability",
    boostTopics: [
      "roas_optimization",
      "marketing_efficiency",
      "winning_products",
      "product_scaling",
      "bundles",
    ],
    suppressTopics: ["warehouse_optimization"],
  },
  established: {
    focus: "Profitability, blended ROAS, budget allocation, and cash flow",
    boostTopics: [
      "roas_optimization",
      "price_optimization",
      "marketing_efficiency",
      "customer_ltv",
      "cash_flow",
      "bundles",
    ],
    suppressTopics: [],
  },
};

function topicsFromDecision(item: DecisionItem): string[] {
  const lower = `${item.summary} ${item.why} ${item.recommendedAction}`.toLowerCase();
  const topics: string[] = [];
  if (/scale|budget|campaign/i.test(lower)) topics.push("campaign_scaling", "product_scaling");
  if (/roas|cpa|ads/i.test(lower)) topics.push("roas_optimization", "marketing_efficiency");
  if (/inventory|clearance|slow|warehouse|dead/i.test(lower)) {
    topics.push("inventory_clearance", "dead_inventory", "cash_flow");
  }
  if (/discount|promotion|price/i.test(lower)) topics.push("price_optimization");
  if (/winner|hero|description|image|title/i.test(lower)) topics.push("winning_products", "product_quality");
  if (/churn|retention|ltv/i.test(lower)) topics.push("churn_risk", "customer_ltv");
  if (/bundle/i.test(lower)) topics.push("bundles");
  if (/setup|connect|policy|shipping/i.test(lower)) topics.push("store_setup");
  if (/landing|conversion/i.test(lower)) topics.push("landing_page");
  return topics;
}

export function adjustDecisionPriorityForMerchantStage(
  item: DecisionItem,
  stage: MerchantStage,
): number {
  let delta = 0;
  const prefs = MERCHANT_STAGE_PRIORITIES[stage];
  const topics = topicsFromDecision(item);
  for (const topic of topics) {
    if (prefs.boostTopics.includes(topic)) delta += 10;
    if (prefs.suppressTopics.includes(topic)) delta -= 14;
  }

  if (stage === "new") {
    if (/\broas\b|profitability|blended|cac\b/i.test(item.summary)) delta -= 20;
    if (/connect meta|connect google|description|image/i.test(`${item.summary} ${item.recommendedAction}`)) {
      delta += 12;
    }
  }
  if (stage === "established" && /profit|roas|budget|cash/i.test(item.summary)) {
    delta += 8;
  }
  return delta;
}

export function applyMerchantStageToDecisions<T extends DecisionItem>(
  decisions: T[],
  stage: MerchantStage,
): T[] {
  const focus = MERCHANT_STAGE_PRIORITIES[stage].focus;
  return decisions
    .map((item) => ({
      ...item,
      priorityScore: item.priorityScore + adjustDecisionPriorityForMerchantStage(item, stage),
      why: `${item.why}\n\nMerchant stage: ${stage} — ${focus}.`,
    }))
    .sort((a, b) => {
      const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
      return (
        SEVERITY_RANK[a.priority] - SEVERITY_RANK[b.priority] ||
        b.priorityScore - a.priorityScore
      );
    });
}
