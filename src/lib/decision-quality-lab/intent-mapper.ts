import type { EnrichedDecisionItem } from "@/lib/decisions/engine/types";
import {
  DECISION_INTENT_TAXONOMY,
  type DecisionIntent,
  type IntentDefinition,
} from "./intents";

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function decisionTextBlob(item: EnrichedDecisionItem): string {
  return normalize(
    [
      item.summary,
      item.why,
      item.recommendedAction,
      item.problemKey,
      item.source,
      item.businessModelPack,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function matchesPatterns(text: string, patterns: string[]): boolean {
  return patterns.some((p) => text.includes(normalize(p)));
}

export function mapDecisionToIntents(item: EnrichedDecisionItem): DecisionIntent[] {
  const text = decisionTextBlob(item);
  const intents = new Set<DecisionIntent>();

  for (const def of DECISION_INTENT_TAXONOMY) {
    if (matchesPatterns(text, def.acceptPatterns)) {
      if (def.rejectPatterns?.some((r) => text.includes(normalize(r)))) continue;
      intents.add(def.id);
    }
  }

  if (item.strategyComparison) {
    const rec = normalize(item.strategyComparison.recommended.label);
    if (rec.includes("clearance") || rec.includes("discount")) intents.add("inventory_clearance");
    if (rec.includes("bundle")) intents.add("bundle_products");
    if (rec.includes("scale") || rec.includes("increase")) intents.add("scaling");
    if (rec.includes("pause") || rec.includes("reduce")) intents.add("reduce_advertising");
  }

  return [...intents];
}

export function intentDefinition(id: DecisionIntent): IntentDefinition | undefined {
  return DECISION_INTENT_TAXONOMY.find((d) => d.id === id);
}

export function intentsAreCompatible(expected: DecisionIntent, actual: DecisionIntent): boolean {
  if (expected === actual) return true;

  const compatible: Partial<Record<DecisionIntent, DecisionIntent[]>> = {
    reduce_advertising: ["roas_optimization", "campaign_review", "profit_preservation"],
    increase_advertising: ["scaling", "roas_optimization", "customer_acquisition"],
    inventory_clearance: ["bundle_products", "cash_flow_improvement", "pricing_adjustment"],
    scaling: ["increase_advertising", "roas_optimization"],
    roas_optimization: ["reduce_advertising", "increase_advertising", "campaign_review"],
    conversion_optimization: ["landing_page_optimization", "merchandising", "pricing_adjustment"],
    landing_page_optimization: ["conversion_optimization", "merchandising"],
    pricing_adjustment: ["profit_preservation", "conversion_optimization"],
    profit_preservation: ["pricing_adjustment", "reduce_advertising"],
    cash_flow_improvement: ["inventory_clearance", "pricing_adjustment"],
    merchandising: ["landing_page_optimization", "customer_acquisition"],
    healthy_baseline: [],
  };

  return compatible[expected]?.includes(actual) ?? false;
}

export function findDecisionsMatchingIntent(
  decisions: EnrichedDecisionItem[],
  expectedIntent: DecisionIntent,
): EnrichedDecisionItem[] {
  return decisions.filter((d) => {
    const intents = mapDecisionToIntents(d);
    return intents.some(
      (actual) => actual === expectedIntent || intentsAreCompatible(expectedIntent, actual),
    );
  });
}
