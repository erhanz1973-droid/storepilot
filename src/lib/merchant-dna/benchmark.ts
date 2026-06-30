import type { ProfitDashboard } from "@/lib/profit/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { MerchantBenchmark, MerchantDNA } from "./types";
import { BUSINESS_MODEL_LABELS } from "@/lib/business-model/types";
import { GROWTH_STAGE_LABELS, PRODUCT_DNA_LABELS } from "./types";

/** Cohort fingerprint — merchants only compared within similar DNA */
export function buildBenchmarkCohortId(dna: Pick<MerchantDNA, "businessModel" | "growthStage" | "productDna" | "pricePosition">): string {
  return [dna.businessModel, dna.growthStage, dna.productDna, dna.pricePosition].join(":");
}

export function buildBenchmarkCohortLabel(dna: MerchantDNA): string {
  return [
    BUSINESS_MODEL_LABELS[dna.businessModel],
    GROWTH_STAGE_LABELS[dna.growthStage],
    PRODUCT_DNA_LABELS[dna.productDna],
  ].join(" · ");
}

/** Synthetic cohort medians — replaced by peer data as platform scales */
const COHORT_MEDIANS: Record<
  string,
  { roas: number; margin: number; aov: number; conversion: number }
> = {
  "dropshipping:scaling:hero_product:mid_market": { roas: 2.1, margin: 32, aov: 55, conversion: 2.2 },
  "dropshipping:growing:general_store:budget": { roas: 1.6, margin: 28, aov: 38, conversion: 1.8 },
  "own_inventory:mature:large_catalog:mid_market": { roas: 2.4, margin: 38, aov: 72, conversion: 2.5 },
  "own_inventory:growing:general_store:mid_market": { roas: 1.9, margin: 35, aov: 65, conversion: 2.1 },
  default: { roas: 1.8, margin: 30, aov: 55, conversion: 2.0 },
};

function percentile(value: number, median: number, spread = 0.35): number {
  const ratio = value / (median || 1);
  const raw = 50 + (ratio - 1) * (50 / spread);
  return Math.max(5, Math.min(95, Math.round(raw)));
}

export function buildMerchantBenchmark(input: {
  dna: MerchantDNA;
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
}): MerchantBenchmark {
  const cohortId = buildBenchmarkCohortId(input.dna);
  const medians = COHORT_MEDIANS[cohortId] ?? COHORT_MEDIANS.default;

  const roas = input.profitDashboard?.blendedRoas?.blendedRoas30d ?? 0;
  const margin = input.profitDashboard?.primary.profitMarginPct ?? 0;
  const aov = input.dna.averageOrderValue ?? input.snapshot.storeMetrics?.aov30d ?? 0;
  const conversion = input.snapshot.storeMetrics?.conversionRate30d ?? 0;

  return {
    cohortId,
    cohortLabel: buildBenchmarkCohortLabel(input.dna),
    similarMerchantCount: 48,
    metrics: [
      {
        id: "roas",
        label: "Blended ROAS",
        merchantValue: roas,
        cohortMedian: medians.roas,
        cohortPercentile: percentile(roas, medians.roas),
        unit: "ratio",
      },
      {
        id: "margin",
        label: "Net Margin",
        merchantValue: margin,
        cohortMedian: medians.margin,
        cohortPercentile: percentile(margin, medians.margin),
        unit: "percent",
      },
      {
        id: "aov",
        label: "Average Order Value",
        merchantValue: aov,
        cohortMedian: medians.aov,
        cohortPercentile: percentile(aov, medians.aov),
        unit: "currency",
      },
      {
        id: "conversion",
        label: "Conversion Rate",
        merchantValue: conversion,
        cohortMedian: medians.conversion,
        cohortPercentile: percentile(conversion, medians.conversion),
        unit: "percent",
      },
    ],
  };
}
