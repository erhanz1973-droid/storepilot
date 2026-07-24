import type { MetaCampaign } from "@/lib/connectors/types";
import { ALPINE_OUTFITTERS } from "./constants";

/** Fixed campaign start anchors — deterministic across refreshes. */
const START = "2025-11-01T12:00:00.000Z";

/**
 * Meta campaigns — 7d totals match ALPINE_OUTFITTERS.metaSpend7d / metaRevenue7d.
 * Includes two underperformers for pause recommendations.
 */
export const ALPINE_META_CAMPAIGNS: MetaCampaign[] = [
  {
    id: "ao-meta-prospecting-lookalike",
    name: "Prospecting — Outdoor Lookalike",
    status: "ACTIVE",
    effectiveStatus: "ACTIVE",
    metaEffectiveStatus: "ACTIVE",
    objective: "OUTCOME_SALES",
    dailyBudgetCents: 22_000,
    currency: "USD",
    startTime: START,
    spend7d: 720,
    revenue7d: 3_168,
    roas7d: 4.4,
    profit7d: 1_420,
    ctr7d: 2.7,
    frequency7d: 1.5,
    impressions7d: 86_000,
    clicks7d: 2_322,
    conversions7d: 48,
  },
  {
    id: "ao-meta-retarget-cart",
    name: "Retargeting — Cart Abandoners",
    status: "ACTIVE",
    effectiveStatus: "ACTIVE",
    metaEffectiveStatus: "ACTIVE",
    objective: "OUTCOME_SALES",
    spend7d: 480,
    revenue7d: 2_640,
    roas7d: 5.5,
    profit7d: 1_380,
    ctr7d: 3.4,
    frequency7d: 2.0,
    impressions7d: 38_000,
    clicks7d: 1_292,
    conversions7d: 40,
  },
  {
    id: "ao-meta-brand-alpine",
    name: "Brand — Alpine Community",
    status: "ACTIVE",
    effectiveStatus: "ACTIVE",
    metaEffectiveStatus: "ACTIVE",
    objective: "OUTCOME_SALES",
    spend7d: 360,
    revenue7d: 1_404,
    roas7d: 3.9,
    profit7d: 620,
    ctr7d: 2.5,
    frequency7d: 1.7,
    impressions7d: 42_000,
    clicks7d: 1_050,
    conversions7d: 21,
  },
  {
    id: "ao-meta-catalog-bestsellers",
    name: "Catalog — Bestsellers",
    status: "ACTIVE",
    effectiveStatus: "ACTIVE",
    metaEffectiveStatus: "ACTIVE",
    objective: "OUTCOME_SALES",
    spend7d: 338,
    revenue7d: 811,
    roas7d: 2.4,
    profit7d: 180,
    ctr7d: 1.9,
    frequency7d: 1.9,
    impressions7d: 52_000,
    clicks7d: 988,
    conversions7d: 12,
  },
  {
    id: "ao-meta-spring-awareness",
    name: "Spring Awareness — Broad Interest",
    status: "ACTIVE",
    effectiveStatus: "ACTIVE",
    metaEffectiveStatus: "ACTIVE",
    objective: "OUTCOME_AWARENESS",
    spend7d: 220,
    revenue7d: 88,
    roas7d: 0.4,
    profit7d: -140,
    ctr7d: 0.9,
    frequency7d: 2.8,
    impressions7d: 94_000,
    clicks7d: 846,
    conversions7d: 2,
  },
  {
    id: "ao-meta-ig-reels-test",
    name: "Instagram Reels — Gear Tips Test",
    status: "ACTIVE",
    effectiveStatus: "ACTIVE",
    metaEffectiveStatus: "ACTIVE",
    objective: "OUTCOME_TRAFFIC",
    spend7d: 180,
    revenue7d: 32,
    roas7d: 0.18,
    profit7d: -155,
    ctr7d: 1.1,
    frequency7d: 2.6,
    impressions7d: 61_000,
    clicks7d: 671,
    conversions7d: 1,
  },
];

export function alpineMetaSpend7dTotal(): number {
  return ALPINE_META_CAMPAIGNS.reduce((s, c) => s + c.spend7d, 0);
}

export function alpineMetaRevenue7dTotal(): number {
  return ALPINE_META_CAMPAIGNS.reduce((s, c) => s + c.revenue7d, 0);
}

/** Sanity: totals must match showcase constants. */
export function assertAlpineMetaTotals(): void {
  const spend = alpineMetaSpend7dTotal();
  const rev = alpineMetaRevenue7dTotal();
  if (spend !== ALPINE_OUTFITTERS.metaSpend7d || rev !== ALPINE_OUTFITTERS.metaRevenue7d) {
    throw new Error(
      `Alpine Meta 7d spend/rev ${spend}/${rev} !== ${ALPINE_OUTFITTERS.metaSpend7d}/${ALPINE_OUTFITTERS.metaRevenue7d}`,
    );
  }
}
