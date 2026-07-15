/**
 * Financial Integrity Suite — structural invariants that must always hold.
 * Runs in CI irrespective of fixture values.
 */

export type IntegrityViolation = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type IntegrityInput = {
  revenue: number;
  orders: number;
  cogs: number;
  shippingCost: number;
  refunds: number;
  platformFees: number;
  adSpend: number;
  grossProfit: number;
  netProfit: number;
  contributionMargin: number;
  blendedRoas: number | null;
  mer: number | null;
  aov: number | null;
  cpa: number | null;
  cac: number | null;
  grossMarginPct: number | null;
  netMarginPct: number | null;
  conversionRatePct: number | null;
};

function approx(a: number, b: number, eps = 0.02): boolean {
  return Math.abs(a - b) <= eps;
}

export function runFinancialIntegrityChecks(input: IntegrityInput): IntegrityViolation[] {
  const v: IntegrityViolation[] = [];

  if (input.orders < 0 || input.revenue < 0 || input.cogs < 0 || input.adSpend < 0) {
    v.push({
      code: "NEGATIVE_BASE_INPUT",
      message: "Base inputs (orders/revenue/cogs/adSpend) must not be negative.",
      severity: "error",
    });
  }

  const expectedGross = input.revenue - input.cogs;
  if (!approx(input.grossProfit, expectedGross)) {
    v.push({
      code: "GROSS_PROFIT_IDENTITY",
      message: `Gross Profit ${input.grossProfit} ≠ Revenue − COGS (${expectedGross}).`,
      severity: "error",
    });
  }

  const expectedNet =
    input.revenue -
    input.cogs -
    input.shippingCost -
    input.refunds -
    input.platformFees -
    input.adSpend;
  if (!approx(input.netProfit, expectedNet)) {
    v.push({
      code: "NET_PROFIT_IDENTITY",
      message: `Net Profit ${input.netProfit} ≠ Gross path − shipping − refunds − fees − ads (${expectedNet}).`,
      severity: "error",
    });
  }

  const expectedContribution = input.revenue - input.cogs - input.adSpend;
  if (!approx(input.contributionMargin, expectedContribution)) {
    v.push({
      code: "CONTRIBUTION_IDENTITY",
      message: `Contribution ${input.contributionMargin} ≠ Revenue − COGS − Ad Spend (${expectedContribution}).`,
      severity: "error",
    });
  }

  if (input.adSpend > 0) {
    const expectedRoas = input.revenue / input.adSpend;
    if (input.blendedRoas == null || !approx(input.blendedRoas, expectedRoas, 1e-9)) {
      v.push({
        code: "ROAS_IDENTITY",
        message: `ROAS ${input.blendedRoas} ≠ Revenue ÷ Ad Spend (${expectedRoas}).`,
        severity: "error",
      });
    }
    if (input.mer == null || !approx(input.mer, expectedRoas, 1e-9)) {
      v.push({
        code: "MER_IDENTITY",
        message: `MER ${input.mer} ≠ Revenue ÷ Ad Spend (${expectedRoas}).`,
        severity: "error",
      });
    }
  }

  if (input.orders > 0) {
    const expectedAov = input.revenue / input.orders;
    if (input.aov == null || !approx(input.aov, expectedAov, 1e-9)) {
      v.push({
        code: "AOV_IDENTITY",
        message: `AOV ${input.aov} ≠ Revenue ÷ Orders (${expectedAov}).`,
        severity: "error",
      });
    }
  }

  // Positive inputs → net should not be mysteriously negative beyond arithmetic
  const allCostsPositive =
    input.revenue > 0 &&
    input.cogs >= 0 &&
    input.shippingCost >= 0 &&
    input.refunds >= 0 &&
    input.platformFees >= 0 &&
    input.adSpend >= 0;
  if (allCostsPositive && input.netProfit < 0 && expectedNet >= 0) {
    v.push({
      code: "UNJUSTIFIED_NEGATIVE_NET",
      message: "Net profit is negative while arithmetic identity predicts non-negative.",
      severity: "error",
    });
  }

  for (const [label, pct] of [
    ["grossMarginPct", input.grossMarginPct],
    ["netMarginPct", input.netMarginPct],
    ["conversionRatePct", input.conversionRatePct],
  ] as const) {
    if (pct != null && (pct < -1000 || pct > 1000)) {
      v.push({
        code: "PERCENT_OUT_OF_RANGE",
        message: `${label}=${pct} is outside a sane percentage range.`,
        severity: "error",
      });
    }
  }

  if (input.grossMarginPct != null && (input.grossMarginPct < -50 || input.grossMarginPct > 100)) {
    v.push({
      code: "GROSS_MARGIN_RANGE",
      message: `Gross margin ${input.grossMarginPct}% looks implausible for retail unit economics.`,
      severity: "warning",
    });
  }

  return v;
}

export function assertFinancialIntegrity(input: IntegrityInput): void {
  const violations = runFinancialIntegrityChecks(input).filter((x) => x.severity === "error");
  if (violations.length === 0) return;
  throw new Error(
    `Financial integrity failed:\n${violations.map((v) => `  [${v.code}] ${v.message}`).join("\n")}`,
  );
}
