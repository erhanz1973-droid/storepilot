import {
  MODE_SCORE_WEIGHTS,
  MERCHANT_MODE_LABELS,
  type MerchantMode,
} from "@/lib/decisions/merchant-mode";
import type { ModeWeightDisplay } from "./types";

const WEIGHT_LABELS: Record<keyof (typeof MODE_SCORE_WEIGHTS)["profit"], string> = {
  netProfit: "Net Profit",
  revenue: "Revenue",
  inventoryReduction: "Inventory Clearance",
  cashRecovery: "Cash Flow",
  unitsSold: "Customer Acquisition",
  roasImpact: "ROAS / Ads Efficiency",
};

/** Human-readable weight breakdown for the active merchant mode. */
export function formatModeWeights(mode: MerchantMode): ModeWeightDisplay[] {
  const weights = MODE_SCORE_WEIGHTS[mode];
  const entries = Object.entries(weights) as [keyof typeof weights, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0) || 1;

  return entries
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, weight]) => ({
      label: WEIGHT_LABELS[key],
      weightPct: Math.round((weight / total) * 100),
    }));
}

export function modeRankingSummary(mode: MerchantMode): string {
  const top = formatModeWeights(mode).slice(0, 3);
  return `${MERCHANT_MODE_LABELS[mode]} prioritizes ${top.map((t) => `${t.label} (${t.weightPct}%)`).join(", ")}.`;
}
