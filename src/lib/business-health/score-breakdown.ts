import type { StoreHealthFactor } from "@/lib/store-health/score";
import type { HealthScoreBreakdownRow } from "./types";

/** Map store-health factors into the five executive health areas with weight %. */
const DOMAIN_FACTOR_WEIGHTS: Record<string, StoreHealthFactor[]> = {
  profit: ["profit_trend", "revenue_trend"],
  marketing: ["marketing_efficiency", "blended_roas"],
  inventory: ["inventory_health"],
  customers: ["customer_retention"],
  "cash-flow": ["profit_trend"],
};

const DISPLAY_WEIGHTS: Record<string, number> = {
  profit: 25,
  marketing: 20,
  inventory: 30,
  customers: 15,
  "cash-flow": 10,
};

export function buildScoreBreakdown(
  domains: { id: string; label: string; score: number }[],
  factorWeights?: { factor: StoreHealthFactor; weight: number }[],
): HealthScoreBreakdownRow[] {
  const computed = domains.map((d) => {
    const factors = DOMAIN_FACTOR_WEIGHTS[d.id] ?? [];
    let weightPct = DISPLAY_WEIGHTS[d.id] ?? Math.round(100 / domains.length);

    if (factorWeights && factors.length > 0) {
      const raw = factorWeights
        .filter((f) => factors.includes(f.factor))
        .reduce((sum, f) => sum + f.weight, 0);
      if (raw > 0) {
        weightPct = Math.round(raw * 100);
      }
    }

    return {
      id: d.id,
      label: d.label,
      score: d.score,
      weightPct,
    };
  });

  const total = computed.reduce((s, r) => s + r.weightPct, 0);
  if (total !== 100 && computed.length > 0) {
    const delta = 100 - total;
    computed[0]!.weightPct += delta;
  }

  return computed;
}

export function weightedOverallScore(breakdown: HealthScoreBreakdownRow[]): number {
  const totalWeight = breakdown.reduce((s, r) => s + r.weightPct, 0);
  if (totalWeight === 0) return 0;
  const weighted = breakdown.reduce((s, r) => s + r.score * r.weightPct, 0);
  return Math.round(weighted / totalWeight);
}
