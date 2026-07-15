/**
 * Formula Library — pure, documented, unit-tested financial formulas.
 * Screens and presenters must never reimplement these.
 *
 * Spec: docs/Calculation-Bible.md
 */

/** Default when store net margin unknown (non-marketing paths). */
export const DEFAULT_NET_MARGIN_RATE = 0.38;

/**
 * Marketing efficiency: portion of ad savings / revenue that typically
 * becomes net profit after creative/ops overhead and partial margin.
 */
export const MARKETING_EFFICIENCY_TO_NET = 0.55;

export function safeDiv(numerator: number, denominator: number): number | null {
  if (denominator === 0 || !Number.isFinite(denominator) || !Number.isFinite(numerator)) {
    return null;
  }
  return numerator / denominator;
}

export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Gross Profit = Revenue − COGS */
export function formulaGrossProfit(revenue: number, cogs: number): number {
  return round2(revenue - cogs);
}

/**
 * Net Profit = Revenue − COGS − Shipping − Refunds − Platform Fees − Ad Spend − Ops
 * Ops defaults to 0 when unknown.
 */
export function formulaNetProfit(input: {
  revenue: number;
  cogs: number;
  shippingCost: number;
  refunds: number;
  platformFees: number;
  adSpend: number;
  operationalCost?: number;
}): number {
  const ops = input.operationalCost ?? 0;
  return round2(
    input.revenue -
      input.cogs -
      input.shippingCost -
      input.refunds -
      input.platformFees -
      input.adSpend -
      ops,
  );
}

/** Gross Margin % = (Gross Profit ÷ Revenue) × 100 */
export function formulaGrossMarginPct(grossProfit: number, revenue: number): number | null {
  const r = safeDiv(grossProfit, revenue);
  return r == null ? null : round2(r * 100);
}

/** Net Margin % = (Net Profit ÷ Revenue) × 100 */
export function formulaNetMarginPct(netProfit: number, revenue: number): number | null {
  const r = safeDiv(netProfit, revenue);
  return r == null ? null : round2(r * 100);
}

/** Contribution Margin ≈ Revenue − COGS − Ad Spend (variable costs before ops) */
export function formulaContributionMargin(
  revenue: number,
  cogs: number,
  adSpend: number,
): number {
  return round2(revenue - cogs - adSpend);
}

/** Blended ROAS = Revenue ÷ Ad Spend */
export function formulaBlendedRoas(revenue: number, adSpend: number): number | null {
  return safeDiv(revenue, adSpend);
}

/** MER = Revenue ÷ Ad Spend (same inputs; reported as MER) */
export function formulaMer(revenue: number, adSpend: number): number | null {
  return formulaBlendedRoas(revenue, adSpend);
}

/** CAC = Ad Spend ÷ New Customers (or orders as proxy) */
export function formulaCac(adSpend: number, customersAcquired: number): number | null {
  return safeDiv(adSpend, customersAcquired);
}

/** CPA = Ad Spend ÷ Purchases */
export function formulaCpa(adSpend: number, purchases: number): number | null {
  return safeDiv(adSpend, purchases);
}

/** AOV = Revenue ÷ Orders */
export function formulaAov(revenue: number, orders: number): number | null {
  return safeDiv(revenue, orders);
}

/** Conversion Rate % = Orders ÷ Sessions × 100 */
export function formulaConversionRatePct(orders: number, sessions: number): number | null {
  const r = safeDiv(orders, sessions);
  return r == null ? null : round2(r * 100);
}

/**
 * Advertising Savings = Current Ad Spend − Expected Ad Spend after action
 * Never negative for "savings" framing (clamp at 0).
 */
export function formulaAdvertisingSavings(
  currentAdSpend: number,
  expectedAdSpend: number,
): number {
  return Math.max(0, roundMoney(currentAdSpend - expectedAdSpend));
}

/**
 * Business Recovery (Executive hero) =
 * Avoided Waste + Recovered Revenue + Margin Improvement
 * Not the same as Net Profit Improvement.
 */
export function formulaBusinessRecovery(input: {
  avoidedWaste: number;
  recoveredRevenue: number;
  marginImprovement: number;
}): number {
  return Math.max(
    0,
    roundMoney(input.avoidedWaste + input.recoveredRevenue + input.marginImprovement),
  );
}

/**
 * Convert revenue / savings dollars to expected net profit lift.
 * Marketing efficiency paths use MARKETING_EFFICIENCY_TO_NET;
 * otherwise store net margin (or DEFAULT_NET_MARGIN_RATE).
 */
export function formulaRevenueToNetProfit(
  amount: number,
  opts: {
    isMarketingEfficiency: boolean;
    storeNetMarginPct?: number | null;
  },
): number {
  if (amount <= 0) return 0;
  if (opts.isMarketingEfficiency) {
    return roundMoney(amount * MARKETING_EFFICIENCY_TO_NET);
  }
  const rate =
    opts.storeNetMarginPct != null && opts.storeNetMarginPct > 0
      ? opts.storeNetMarginPct / 100
      : DEFAULT_NET_MARGIN_RATE;
  return roundMoney(amount * rate);
}

/**
 * Confidence 0–100 from measurable inputs (geometric mean of available factors).
 * Missing factors are skipped (not treated as zero).
 */
export function formulaConfidence(input: {
  dataQuality?: number | null;
  sampleSizeScore?: number | null;
  predictionStability?: number | null;
  historicalAccuracy?: number | null;
}): number {
  const factors = [
    input.dataQuality,
    input.sampleSizeScore,
    input.predictionStability,
    input.historicalAccuracy,
  ]
    .filter((f): f is number => f != null && Number.isFinite(f) && f > 0)
    .map((f) => Math.min(1, Math.max(0, f > 1 ? f / 100 : f)));

  if (factors.length === 0) return 0;

  const product = factors.reduce((p, f) => p * f, 1);
  const geo = Math.pow(product, 1 / factors.length);
  return Math.round(geo * 100);
}

/**
 * Sample-size score 0–1 from order/impression volume (diminishing returns).
 */
export function formulaSampleSizeScore(sampleCount: number, fullConfidenceAt = 100): number {
  if (sampleCount <= 0) return 0;
  return Math.min(1, sampleCount / fullConfidenceAt);
}

/** Payback days = Change Cost ÷ (Daily Net Profit Gain) */
export function formulaPaybackDays(
  implementationCost: number,
  monthlyNetProfitGain: number,
): number | null {
  if (implementationCost <= 0) return 0;
  if (monthlyNetProfitGain <= 0) return null;
  const daily = monthlyNetProfitGain / 30;
  if (daily <= 0) return null;
  return Math.round(implementationCost / daily);
}

/** Inventory days of cover ≈ Inventory Units ÷ (Units Sold / Days) */
export function formulaInventoryDays(
  inventoryUnits: number,
  unitsSoldInWindow: number,
  windowDays: number,
): number | null {
  if (inventoryUnits < 0 || unitsSoldInWindow < 0 || windowDays <= 0) return null;
  const daily = unitsSoldInWindow / windowDays;
  if (daily <= 0) return null;
  return round2(inventoryUnits / daily);
}

/** Inventory turnover = COGS ÷ Average Inventory Value */
export function formulaInventoryTurnover(
  cogs: number,
  averageInventoryValue: number,
): number | null {
  return safeDiv(cogs, averageInventoryValue);
}
