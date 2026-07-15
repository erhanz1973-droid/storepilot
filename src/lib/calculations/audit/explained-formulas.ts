import {
  formulaAdvertisingSavings,
  formulaBusinessRecovery,
  formulaGrossProfit,
  formulaNetProfit,
  formulaRevenueToNetProfit,
} from "../formulas";
import { FORMULA_ENGINE_VERSION } from "../version";
import { currencyStep, explainedValue } from "./explained";
import type { ExplainedValue } from "./types";

/** Gross Profit with audit trail */
export function explainGrossProfit(revenue: number, cogs: number): ExplainedValue {
  const value = formulaGrossProfit(revenue, cogs);
  return explainedValue({
    value,
    formulaId: "gross_profit",
    formula: "Gross Profit = Revenue − COGS",
    inputs: { revenue, cogs },
    intermediateSteps: [
      currencyStep("Revenue", revenue, "input", { source: "Shopify orders" }),
      currencyStep("COGS", cogs, "subtract", { source: "Product costs" }),
      currencyStep("Gross Profit", value, "result"),
    ],
    dataSources: ["Shopify"],
  });
}

/** Net Profit with full waterfall — merchant-ready */
export function explainNetProfit(input: {
  revenue: number;
  cogs: number;
  shippingCost: number;
  refunds: number;
  platformFees: number;
  adSpend: number;
  operationalCost?: number;
  lastUpdatedAt?: string | null;
  assumptions?: string[];
}): ExplainedValue {
  const ops = input.operationalCost ?? 0;
  const gross = formulaGrossProfit(input.revenue, input.cogs);
  const value = formulaNetProfit({
    revenue: input.revenue,
    cogs: input.cogs,
    shippingCost: input.shippingCost,
    refunds: input.refunds,
    platformFees: input.platformFees,
    adSpend: input.adSpend,
    operationalCost: ops,
  });

  const warnings: string[] = [];
  if (input.platformFees === 0) {
    warnings.push("Platform fees are 0 — confirm fee estimate is applied or not applicable.");
  }

  return explainedValue({
    value,
    formulaId: "net_profit",
    formula:
      "Net Profit = Revenue − COGS − Shipping − Refunds − Platform Fees − Ad Spend − Ops",
    inputs: {
      revenue: input.revenue,
      cogs: input.cogs,
      shippingCost: input.shippingCost,
      refunds: input.refunds,
      platformFees: input.platformFees,
      adSpend: input.adSpend,
      operationalCost: ops,
    },
    intermediateSteps: [
      currencyStep("Revenue", input.revenue, "input", { source: "Shopify" }),
      currencyStep("COGS", input.cogs, "subtract", { source: "Product costs" }),
      currencyStep("Gross Profit", gross, "result"),
      currencyStep("Advertising", input.adSpend, "subtract", { source: "Meta / Google Ads" }),
      currencyStep("Shipping", input.shippingCost, "subtract", { source: "Shopify" }),
      currencyStep("Platform Fees", input.platformFees, "subtract", {
        source: "Estimated fees",
        assumed: input.platformFees > 0,
      }),
      currencyStep("Refunds", input.refunds, "subtract"),
      ...(ops > 0 ? [currencyStep("Operational Cost", ops, "subtract")] : []),
      currencyStep("Net Profit", value, "result"),
    ],
    dataSources: ["Shopify", "Meta Ads", "Google Ads"],
    assumptions: input.assumptions ?? [],
    warnings,
    lastUpdatedAt: input.lastUpdatedAt ?? null,
  });
}

export function explainAdvertisingSavings(
  currentAdSpend: number,
  expectedAdSpend: number,
): ExplainedValue {
  const value = formulaAdvertisingSavings(currentAdSpend, expectedAdSpend);
  return explainedValue({
    value,
    formulaId: "advertising_savings",
    formula: "Advertising Savings = Current Ad Spend − Expected Ad Spend",
    inputs: { currentAdSpend, expectedAdSpend },
    intermediateSteps: [
      currencyStep("Current Ad Spend", currentAdSpend, "input", { source: "Ad platforms" }),
      currencyStep("Expected Ad Spend", expectedAdSpend, "subtract"),
      currencyStep("Advertising Savings", value, "result"),
    ],
    dataSources: ["Meta Ads", "Google Ads"],
  });
}

export function explainBusinessRecovery(input: {
  avoidedWaste: number;
  advertisingSavings: number;
  recoveredRevenue: number;
  marginImprovement: number;
  composedValue: number;
  recoveryDefinition: string;
  businessLeakage?: number;
}): ExplainedValue {
  const leakage =
    input.businessLeakage ??
    input.avoidedWaste + input.advertisingSavings + input.marginImprovement;

  return explainedValue({
    value: input.composedValue,
    formulaId: "business_recovery",
    formula: input.recoveryDefinition,
    inputs: {
      avoidedWaste: input.avoidedWaste,
      advertisingSavings: input.advertisingSavings,
      recoveredRevenue: input.recoveredRevenue,
      marginImprovement: input.marginImprovement,
      businessLeakage: leakage,
    },
    intermediateSteps: [
      currencyStep("Business Leakage", leakage, "input"),
      currencyStep("Advertising Waste", input.advertisingSavings || input.avoidedWaste, "note"),
      currencyStep("Margin Improvement", input.marginImprovement, "add"),
      currencyStep("Recovered Revenue", input.recoveredRevenue, "add"),
      currencyStep("Recoverable Opportunity", input.composedValue, "result"),
    ],
    dataSources: ["Decision Impact Engine", `Formula ${FORMULA_ENGINE_VERSION}`],
  });
}

export function explainNetProfitImpact(input: {
  sourceAmount: number;
  netProfitImpact: number;
  isMarketingEfficiency: boolean;
  storeNetMarginPct: number | null;
}): ExplainedValue {
  const assumed = input.isMarketingEfficiency
    ? "Marketing efficiency factor 0.55"
    : `Store net margin ${input.storeNetMarginPct ?? 38}%`;

  // Recompute for audit trail display
  const recomputed = formulaRevenueToNetProfit(input.sourceAmount, {
    isMarketingEfficiency: input.isMarketingEfficiency,
    storeNetMarginPct: input.storeNetMarginPct,
  });

  return explainedValue({
    value: input.netProfitImpact,
    formulaId: "net_profit_impact",
    formula: input.isMarketingEfficiency
      ? "Net Profit Impact = Amount × 0.55 (marketing efficiency)"
      : "Net Profit Impact = Amount × Store Net Margin %",
    inputs: {
      sourceAmount: input.sourceAmount,
      isMarketingEfficiency: input.isMarketingEfficiency ? 1 : 0,
      storeNetMarginPct: input.storeNetMarginPct,
      recomputed,
    },
    intermediateSteps: [
      currencyStep("Source Amount", input.sourceAmount, "input"),
      {
        label: "Conversion",
        value: assumed,
        unit: "text",
        op: "note",
        assumed: true,
      },
      currencyStep("Net Profit Improvement", input.netProfitImpact, "result"),
    ],
    assumptions: [assumed],
    dataSources: ["Impact Engine"],
  });
}
