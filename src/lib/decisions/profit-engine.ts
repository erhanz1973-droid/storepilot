import type { BusinessContext } from "@/lib/ai/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProductProfitRow, ProfitDashboard } from "@/lib/profit/types";
import type { Recommendation } from "@/lib/types";
import { formatNetProfitImpact } from "@/lib/opportunities/profit-impact";
import type { MerchantMode } from "@/lib/decisions/merchant-mode";
import { MERCHANT_MODE_LABELS } from "@/lib/decisions/merchant-mode";
import {
  productEconomicsFromSnapshot,
  profitRowToEconomics,
  type ProductEconomicsInput,
} from "@/lib/decisions/product-economics";
import {
  compareSlowProductStrategies,
  type StrategyComparisonResult,
} from "@/lib/decisions/strategy-comparison";
import { buildProfitAwareSummary } from "@/lib/decisions/explainability";

export type ProfitAwareRecommendation = {
  id: string;
  title: string;
  description: string;
  entityType: "product" | "campaign" | "collection";
  entityId: string;
  entityName: string;
  estimatedRevenue: number;
  estimatedGrossProfit: number;
  estimatedNetProfit: number;
  inventoryImpact: number;
  cashFlowImpact: number;
  confidenceScore: number;
  reasoning: string;
  recommendedStrategy: string;
  merchantMode: MerchantMode;
  strategyComparison?: StrategyComparisonResult;
  supportingMetrics: { label: string; value: string }[];
};

export type ProfitDecisionEngineResult = {
  merchantMode: MerchantMode;
  objective: string;
  recommendations: ProfitAwareRecommendation[];
  slowProductStrategies: StrategyComparisonResult[];
};

function productRows(profitDashboard: ProfitDashboard): ProductProfitRow[] {
  return profitDashboard.byProduct ?? [];
}

function slowProductsFromDashboard(
  profitDashboard: ProfitDashboard,
): ProductEconomicsInput[] {
  return productRows(profitDashboard)
    .filter((row) => row.inventory >= 30 && row.unitsSold <= 20)
    .sort((a, b) => b.inventory - a.inventory)
    .slice(0, 5)
    .map(profitRowToEconomics);
}

function recommendationFromComparison(
  comparison: StrategyComparisonResult,
  mode: MerchantMode,
): ProfitAwareRecommendation {
  const best = comparison.recommended;
  return {
    id: `profit-strategy-${comparison.productId}`,
    title: `Profit strategy — ${comparison.productTitle}`,
    description: comparison.expectedBusinessImpact,
    entityType: "product",
    entityId: comparison.productId,
    entityName: comparison.productTitle,
    estimatedRevenue: best.expectedRevenue,
    estimatedGrossProfit: best.expectedGrossProfit,
    estimatedNetProfit: best.expectedNetProfit,
    inventoryImpact: best.inventoryReduction,
    cashFlowImpact: best.cashFlowImpact,
    confidenceScore: best.confidence,
    reasoning: comparison.explanation,
    recommendedStrategy: best.label,
    merchantMode: mode,
    strategyComparison: comparison,
    supportingMetrics: [
      { label: "Strategy", value: best.label },
      { label: "Net profit (30d)", value: formatNetProfitImpact(best.expectedNetProfit) },
      { label: "Revenue (30d)", value: formatNetProfitImpact(best.expectedRevenue) },
      { label: "Inventory cleared", value: String(Math.round(best.inventoryReduction)) },
      { label: "Cash flow", value: formatNetProfitImpact(best.cashFlowImpact) },
      { label: "Confidence", value: `${Math.round(best.confidence * 100)}%` },
      { label: "Mode", value: MERCHANT_MODE_LABELS[mode] },
    ],
  };
}

function enrichExistingRecommendation(
  rec: Recommendation,
  profitDashboard: ProfitDashboard,
  mode: MerchantMode,
): ProfitAwareRecommendation | null {
  const productHint = rec.title.split("—").pop()?.trim() ?? rec.title;
  const productRow = productRows(profitDashboard).find((p) =>
    p.title.toLowerCase().includes(productHint.toLowerCase()),
  );
  if (!productRow) return null;

  const economics = profitRowToEconomics(productRow);
  const comparison = compareSlowProductStrategies({
    product: economics,
    profitDashboard,
    merchantMode: mode,
  });

  return {
    id: `profit-aware-${rec.id}`,
    title: rec.title,
    description: buildProfitAwareSummary(comparison.recommended),
    entityType: "product",
    entityId: productRow.productId,
    entityName: productRow.title,
    estimatedRevenue: comparison.recommended.expectedRevenue,
    estimatedGrossProfit: comparison.recommended.expectedGrossProfit,
    estimatedNetProfit: comparison.recommended.expectedNetProfit,
    inventoryImpact: comparison.recommended.inventoryReduction,
    cashFlowImpact: comparison.recommended.cashFlowImpact,
    confidenceScore: comparison.recommended.confidence,
    reasoning: comparison.explanation,
    recommendedStrategy: comparison.recommended.label,
    merchantMode: mode,
    strategyComparison: comparison,
    supportingMetrics: [
      { label: "Net profit (30d)", value: formatNetProfitImpact(comparison.recommended.expectedNetProfit) },
      { label: "Revenue (30d)", value: formatNetProfitImpact(comparison.recommended.expectedRevenue) },
      { label: "Strategy", value: comparison.recommended.label },
      { label: "Confidence", value: `${Math.round(comparison.recommended.confidence * 100)}%` },
    ],
  };
}

export function buildProfitDecisionEngine(input: {
  snapshot: StoreSnapshot;
  profitDashboard: ProfitDashboard;
  context?: BusinessContext;
  merchantMode?: MerchantMode;
  enableInventoryStrategies?: boolean;
}): ProfitDecisionEngineResult {
  const mode = input.merchantMode ?? input.context?.merchantMode ?? "profit";
  const inventoryEnabled = input.enableInventoryStrategies !== false;

  const slowProducts = !inventoryEnabled
    ? []
    : slowProductsFromDashboard(input.profitDashboard).length > 0
      ? slowProductsFromDashboard(input.profitDashboard)
      : (() => {
          const fallback = productEconomicsFromSnapshot(input.snapshot, input.profitDashboard);
          return fallback ? [fallback] : [];
        })();

  const slowProductStrategies = slowProducts.map((product) =>
    compareSlowProductStrategies({
      product,
      profitDashboard: input.profitDashboard,
      merchantMode: mode,
    }),
  );

  const strategyRecs = slowProductStrategies.map((comparison) =>
    recommendationFromComparison(comparison, mode),
  );

  const enrichedRecs =
    (input.context?.activeRecommendations ?? [])
      .map((rec) => enrichExistingRecommendation(rec, input.profitDashboard, mode))
      .filter((rec): rec is ProfitAwareRecommendation => rec != null);

  const byEntity = new Map<string, ProfitAwareRecommendation>();
  for (const rec of [...strategyRecs, ...enrichedRecs]) {
    const existing = byEntity.get(rec.entityId);
    if (!existing || rec.estimatedNetProfit > existing.estimatedNetProfit) {
      byEntity.set(rec.entityId, rec);
    }
  }

  const recommendations = [...byEntity.values()].sort(
    (a, b) => b.estimatedNetProfit - a.estimatedNetProfit,
  );

  return {
    merchantMode: mode,
    objective: "Maximize expected net profit — not revenue alone.",
    recommendations,
    slowProductStrategies,
  };
}
