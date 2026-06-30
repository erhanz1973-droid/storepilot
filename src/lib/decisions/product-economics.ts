import {
  DEFAULT_TRANSACTION_FEE_FIXED,
  DEFAULT_TRANSACTION_FEE_RATE,
} from "@/lib/profit/constants";
import type { ProductProfitRow, ProfitDashboard } from "@/lib/profit/types";
import type { StoreSnapshot } from "@/lib/connectors/types";

export type ProductEconomicsInput = {
  productId: string;
  title: string;
  price: number;
  unitCost: number;
  unitsSold30d: number;
  inventory: number;
  inventoryAgeDays?: number;
  costSource: ProductProfitRow["costSource"];
};

export type StrategyEstimate = {
  strategyId: string;
  label: string;
  expectedUnitsSold: number;
  expectedRevenue: number;
  expectedGrossProfit: number;
  expectedNetProfit: number;
  inventoryReduction: number;
  remainingInventory: number;
  cashFlowImpact: number;
  roasImpact: number;
  riskScore: number;
  confidence: number;
  reasoning: string;
  waterfall?: ProfitWaterfall;
};

export type ProfitWaterfall = {
  revenue: number;
  productCost: number;
  advertising: number;
  shipping: number;
  processingFees: number;
  netProfit: number;
  refunds?: number;
};

const PRICE_ELASTICITY = 0.85;
const AD_COST_PER_UNIT_FALLBACK = 4;

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function perUnitFees(price: number): number {
  return round(price * DEFAULT_TRANSACTION_FEE_RATE + DEFAULT_TRANSACTION_FEE_FIXED);
}

function estimateAdCostPerUnit(
  product: ProductEconomicsInput,
  profitDashboard?: ProfitDashboard | null,
): number {
  if (!profitDashboard || product.unitsSold30d <= 0) return AD_COST_PER_UNIT_FALLBACK;
  const adSpend = profitDashboard.primary.adSpend;
  const totalUnits = Math.max(
    1,
    (profitDashboard.byProduct ?? []).reduce((sum, row) => sum + row.unitsSold, 0),
  );
  const share = product.unitsSold30d / totalUnits;
  const productAd = (adSpend * share) / Math.max(1, product.unitsSold30d);
  return round(productAd || AD_COST_PER_UNIT_FALLBACK);
}

function estimateShippingPerUnit(profitDashboard?: ProfitDashboard | null): number {
  if (!profitDashboard || profitDashboard.primary.orders <= 0) return 5;
  return round(profitDashboard.primary.shippingCost / profitDashboard.primary.orders);
}

function buildEstimate(
  strategyId: string,
  label: string,
  input: ProductEconomicsInput,
  unitsSold: number,
  avgPrice: number,
  adCostPerUnit: number,
  shippingPerUnit: number,
  inventoryReduction: number,
  roasImpact: number,
  riskScore: number,
  confidence: number,
  reasoning: string,
): StrategyEstimate {
  const revenue = round(avgPrice * unitsSold);
  const cogs = round(input.unitCost * unitsSold);
  const fees = round(perUnitFees(avgPrice) * unitsSold);
  const shipping = round(shippingPerUnit * unitsSold);
  const adCost = round(adCostPerUnit * unitsSold);
  const grossProfit = round(revenue - cogs);
  const netProfit = round(grossProfit - fees - shipping - adCost);
  const remainingInventory = Math.max(0, input.inventory - inventoryReduction);
  const cashFlowImpact = round(revenue - cogs - fees);

  return {
    strategyId,
    label,
    expectedUnitsSold: round(unitsSold),
    expectedRevenue: revenue,
    expectedGrossProfit: grossProfit,
    expectedNetProfit: netProfit,
    inventoryReduction: round(inventoryReduction),
    remainingInventory,
    cashFlowImpact,
    roasImpact: round(roasImpact),
    riskScore,
    confidence,
    reasoning,
    waterfall: {
      revenue,
      productCost: cogs,
      advertising: adCost,
      shipping,
      processingFees: fees,
      netProfit,
    },
  };
}

function baselineUnits(input: ProductEconomicsInput): number {
  return Math.max(1, input.unitsSold30d);
}

export function productEconomicsFromSnapshot(
  snapshot: StoreSnapshot,
  profitDashboard: ProfitDashboard,
  productId?: string,
): ProductEconomicsInput | null {
  const product = productId
    ? snapshot.products.find((p) => p.id === productId)
    : snapshot.products.find((p) => p.unitsSold30d <= 20 && p.inventoryQuantity >= 30);

  if (!product) return null;

  const profitRow =
    (profitDashboard.byProduct ?? []).find((p) => p.productId === product.id) ??
    (profitDashboard.byProduct ?? []).find((p) => p.title === product.title);

  const unitCost = profitRow?.unitCost ?? round(product.price * 0.45);
  const inventoryAgeDays =
    product.inventoryQuantity > 0 && product.unitsSold30d === 0
      ? 120
      : product.unitsSold30d > 0
        ? round((product.inventoryQuantity / (product.unitsSold30d / 30)) * 1.2)
        : 60;

  return {
    productId: product.id,
    title: product.title,
    price: product.price,
    unitCost,
    unitsSold30d: product.unitsSold30d,
    inventory: product.inventoryQuantity,
    inventoryAgeDays,
    costSource: profitRow?.costSource ?? "estimated",
  };
}

export function simulateDiscount(
  input: ProductEconomicsInput,
  discountPct: number,
  profitDashboard?: ProfitDashboard | null,
): StrategyEstimate {
  const baseUnits = baselineUnits(input);
  const volumeLift = discountPct * PRICE_ELASTICITY;
  const unitsSold = Math.min(input.inventory, Math.round(baseUnits * (1 + volumeLift)));
  const avgPrice = round(input.price * (1 - discountPct));
  const adCost = estimateAdCostPerUnit(input, profitDashboard);
  const shipping = estimateShippingPerUnit(profitDashboard);

  return buildEstimate(
    `discount_${Math.round(discountPct * 100)}`,
    `${Math.round(discountPct * 100)}% Discount`,
    input,
    unitsSold,
    avgPrice,
    adCost * (1 + volumeLift * 0.3),
    shipping,
    unitsSold,
    -discountPct * 40,
    Math.min(0.85, 0.35 + discountPct),
    Math.max(0.55, 0.82 - discountPct * 0.5),
    `${Math.round(discountPct * 100)}% off lifts unit velocity ~${Math.round(volumeLift * 100)}% but compresses margin per unit.`,
  );
}

export function simulateBundleOffer(
  input: ProductEconomicsInput,
  profitDashboard?: ProfitDashboard | null,
): StrategyEstimate {
  const baseUnits = baselineUnits(input);
  const bundleUnits = Math.min(input.inventory, Math.round(baseUnits * 1.15));
  const bundlePrice = round(input.price * 1.7);
  const effectiveUnitPrice = round(bundlePrice / 2);
  const adCost = estimateAdCostPerUnit(input, profitDashboard);
  const shipping = estimateShippingPerUnit(profitDashboard);

  return buildEstimate(
    "bundle_offer",
    "Bundle Offer",
    input,
    bundleUnits,
    effectiveUnitPrice,
    adCost * 1.05,
    shipping * 0.92,
    bundleUnits,
    5,
    0.35,
    0.74,
    "Pairing SKUs preserves more margin than a straight discount while still accelerating sell-through.",
  );
}

export function simulateBogoHalf(
  input: ProductEconomicsInput,
  profitDashboard?: ProfitDashboard | null,
): StrategyEstimate {
  const baseUnits = baselineUnits(input);
  const unitsSold = Math.min(input.inventory, Math.round(baseUnits * 1.35));
  const avgPrice = round(input.price * 0.75);
  const adCost = estimateAdCostPerUnit(input, profitDashboard);
  const shipping = estimateShippingPerUnit(profitDashboard);

  return buildEstimate(
    "bogo_50",
    "Buy One Get One 50%",
    input,
    unitsSold,
    avgPrice,
    adCost * 1.1,
    shipping,
    unitsSold,
    -8,
    0.55,
    0.68,
    "BOGO moves inventory quickly but at a steep blended price — best when cash recovery matters more than margin.",
  );
}

export function simulateIncreaseAds(
  input: ProductEconomicsInput,
  profitDashboard?: ProfitDashboard | null,
): StrategyEstimate {
  const baseUnits = baselineUnits(input);
  const unitsSold = Math.min(input.inventory, Math.round(baseUnits * 1.08));
  const adCost = estimateAdCostPerUnit(input, profitDashboard) * 1.2;

  return buildEstimate(
    "increase_google_budget",
    "Increase Google Ads Budget",
    input,
    unitsSold,
    input.price,
    adCost,
    estimateShippingPerUnit(profitDashboard),
    unitsSold,
    12,
    0.45,
    0.62,
    "Higher ad spend may lift demand, but slow SKUs often waste budget unless creative and audience fit improve.",
  );
}

export function simulatePauseAds(
  input: ProductEconomicsInput,
  profitDashboard?: ProfitDashboard | null,
): StrategyEstimate {
  const baseUnits = baselineUnits(input);
  const unitsSold = Math.max(1, Math.round(baseUnits * 0.82));
  const adCost = estimateAdCostPerUnit(input, profitDashboard) * 0.15;

  return buildEstimate(
    "pause_ads",
    "Pause Advertising",
    input,
    unitsSold,
    input.price,
    adCost,
    estimateShippingPerUnit(profitDashboard),
    unitsSold,
    18,
    0.25,
    0.78,
    "Pausing spend protects profit on inefficient SKUs but reduces visibility and unit velocity.",
  );
}

export function simulateDoNothing(
  input: ProductEconomicsInput,
  profitDashboard?: ProfitDashboard | null,
): StrategyEstimate {
  const baseUnits = baselineUnits(input);
  const adCost = estimateAdCostPerUnit(input, profitDashboard);

  return buildEstimate(
    "do_nothing",
    "Do Nothing",
    input,
    baseUnits,
    input.price,
    adCost,
    estimateShippingPerUnit(profitDashboard),
    baseUnits,
    0,
    0.15,
    0.9,
    "Baseline scenario — no merchandising or marketing change.",
  );
}

export function profitRowToEconomics(row: ProductProfitRow): ProductEconomicsInput {
  return {
    productId: row.productId,
    title: row.title,
    price: row.unitsSold > 0 ? round(row.revenue / row.unitsSold) : 0,
    unitCost: row.unitCost ?? round(row.cogs / Math.max(1, row.unitsSold)),
    unitsSold30d: row.unitsSold,
    inventory: row.inventory,
    inventoryAgeDays: row.daysOfCover != null ? round(row.daysOfCover * 1.5) : 90,
    costSource: row.costSource,
  };
}
