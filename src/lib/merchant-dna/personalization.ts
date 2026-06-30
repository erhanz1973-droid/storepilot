import type { DecisionItem } from "@/lib/decisions/center";
import type { MerchantDNA } from "./types";
import { GROWTH_STAGE_PRIORITIES } from "./inference/growth-stage";
import {
  AUTOMATION_LABELS,
  GROWTH_STAGE_LABELS,
  PERSONALITY_LABELS,
  PRODUCT_DNA_LABELS,
  TRAFFIC_MIX_LABELS,
} from "./types";
import { BUSINESS_MODEL_LABELS } from "@/lib/business-model/types";

export function buildDnaPersonalizationNarrative(dna: MerchantDNA): string {
  const stage = GROWTH_STAGE_PRIORITIES[dna.growthStage];
  const personalityNote =
    dna.personality === "conservative"
      ? "profit preservation over aggressive scaling"
      : dna.personality === "aggressive"
        ? "growth and scaling opportunities"
        : "balanced growth and profit";

  return [
    "Your store is classified as:",
    `• Business Model: ${BUSINESS_MODEL_LABELS[dna.businessModel]}`,
    `• Growth Stage: ${GROWTH_STAGE_LABELS[dna.growthStage]} (${stage.focus})`,
    `• Primary Channel: ${TRAFFIC_MIX_LABELS[dna.trafficMix]}`,
    `• Product Strategy: ${PRODUCT_DNA_LABELS[dna.productDna]}`,
    `• Risk Profile: ${dna.riskTolerance} · ${PERSONALITY_LABELS[dna.personality]}`,
    `• Automation: ${AUTOMATION_LABELS[dna.automationPreference]}`,
    `Therefore recommendations prioritize ${personalityNote}.`,
  ].join("\n");
}

export function buildDnaPromptContext(dna: MerchantDNA): string {
  return buildDnaPersonalizationNarrative(dna);
}

function summaryTopics(summary: string): string[] {
  const lower = summary.toLowerCase();
  const topics: string[] = [];
  if (/scale|budget|campaign/i.test(lower)) topics.push("campaign_scaling", "product_scaling");
  if (/roas|cpa|ads/i.test(lower)) topics.push("roas_optimization", "marketing_efficiency");
  if (/inventory|clearance|slow|warehouse/i.test(lower)) {
    topics.push("inventory_clearance", "dead_inventory", "cash_flow");
  }
  if (/discount|promotion|price/i.test(lower)) topics.push("price_optimization");
  if (/winner|hero|scaling product/i.test(lower)) topics.push("winning_products");
  if (/churn|retention/i.test(lower)) topics.push("churn_risk", "customer_retention");
  if (/bundle/i.test(lower)) topics.push("bundles");
  return topics;
}

export function adjustDecisionPriorityForDna(
  item: DecisionItem,
  dna: MerchantDNA,
): number {
  let delta = 0;
  const topics = summaryTopics(`${item.summary} ${item.why}`);
  const stagePrefs = GROWTH_STAGE_PRIORITIES[dna.growthStage];

  for (const topic of topics) {
    if (stagePrefs.boostTopics.includes(topic)) delta += 8;
    if (stagePrefs.suppressTopics.includes(topic)) delta -= 12;
  }

  if (dna.trafficMix === "meta_first" && /google/i.test(item.summary)) delta -= 6;
  if (dna.trafficMix === "google_first" && /meta|facebook|instagram/i.test(item.summary)) {
    delta -= 6;
  }
  if (dna.trafficMix === "meta_first" && /meta|facebook|instagram/i.test(item.summary)) {
    delta += 5;
  }
  if (dna.trafficMix === "google_first" && /google|search|shopping/i.test(item.summary)) {
    delta += 5;
  }

  if (dna.personality === "conservative") {
    if (/scale|increase budget|aggressive/i.test(item.summary)) delta -= 10;
    if (/clearance|cash|margin|profit/i.test(item.summary)) delta += 4;
  }
  if (dna.personality === "aggressive") {
    if (/scale|growth|winner/i.test(item.summary)) delta += 8;
  }

  delta += Math.round(dna.learned.scalingAffinity * 10);
  delta -= Math.round(Math.abs(Math.min(0, dna.learned.aggressivenessBias)) * 12);

  if (dna.growthStage === "declining" && /scale|increase budget/i.test(item.summary)) {
    delta -= 15;
  }

  return delta;
}

export function applyDnaPersonalizationToDecisions<T extends DecisionItem>(
  decisions: T[],
  dna: MerchantDNA,
): T[] {
  const narrative = buildDnaPromptContext(dna);
  return decisions
    .map((item) => ({
      ...item,
      priorityScore: item.priorityScore + adjustDecisionPriorityForDna(item, dna),
      why: `${item.why}\n\n${narrative}`,
      merchantDnaContext: narrative,
    }))
    .sort((a, b) => {
      const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
      return (
        SEVERITY_RANK[a.priority] - SEVERITY_RANK[b.priority] ||
        b.priorityScore - a.priorityScore
      );
    });
}
