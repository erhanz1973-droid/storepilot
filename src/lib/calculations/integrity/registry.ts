/**
 * KPI Validation Registry — every production KPI must appear here.
 * Status: validated = formula + source + expected + unit test + example exist.
 */

export type KpiTrustStatus = "validated" | "provisional" | "deprecated";

export type KpiValidationEntry = {
  id: string;
  name: string;
  formula: string;
  sourceData: string[];
  /** Pointer to automated test file covering this KPI */
  unitTest: string;
  /** Worked example (human readable) */
  example: string;
  /** exact | relative */
  tolerance: "exact" | "relative_1pct";
  status: KpiTrustStatus;
};

export const KPI_VALIDATION_REGISTRY: KpiValidationEntry[] = [
  {
    id: "revenue",
    name: "Revenue",
    formula: "Σ order.total_price (window)",
    sourceData: ["Shopify orders export"],
    unitTest: "integrity/__tests__/kpi-matrix.test.ts",
    example: "10 orders summing to $52,340 → Revenue = 52340",
    tolerance: "exact",
    status: "validated",
  },
  {
    id: "orders",
    name: "Orders",
    formula: "Count(orders in window)",
    sourceData: ["Shopify orders export"],
    unitTest: "integrity/__tests__/kpi-matrix.test.ts",
    example: "10 order rows → Orders = 10",
    tolerance: "exact",
    status: "validated",
  },
  {
    id: "ad_spend",
    name: "Ad Spend",
    formula: "Σ campaign.spend (window)",
    sourceData: ["Meta Ads export", "Google Ads (when connected)"],
    unitTest: "integrity/__tests__/kpi-matrix.test.ts",
    example: "7 Meta campaigns summing to $12,100 → Ad Spend = 12100",
    tolerance: "exact",
    status: "validated",
  },
  {
    id: "gross_profit",
    name: "Gross Profit",
    formula: "Revenue − COGS",
    sourceData: ["Shopify revenue", "Product cost / COGS"],
    unitTest: "formulas.test.ts + integrity suite",
    example: "52340 − 22100 = 30240",
    tolerance: "exact",
    status: "validated",
  },
  {
    id: "net_profit",
    name: "Net Profit",
    formula: "Revenue − COGS − Shipping − Refunds − Platform Fees − Ad Spend − Ops",
    sourceData: ["Shopify", "Meta/Google Ads"],
    unitTest: "formulas.test.ts + integrity suite",
    example: "52340 − 22100 − 4100 − 0 − 720 − 12100 = 13320",
    tolerance: "exact",
    status: "validated",
  },
  {
    id: "roas",
    name: "Blended ROAS",
    formula: "Revenue ÷ Ad Spend",
    sourceData: ["Shopify revenue", "Ad platform spend"],
    unitTest: "formulas.test.ts + integrity suite",
    example: "52340 ÷ 12100 ≈ 4.3256",
    tolerance: "exact",
    status: "validated",
  },
  {
    id: "mer",
    name: "MER",
    formula: "Revenue ÷ Ad Spend (same inputs as blended ROAS)",
    sourceData: ["Shopify revenue", "Ad platform spend"],
    unitTest: "integrity suite",
    example: "52340 ÷ 12100 ≈ 4.3256",
    tolerance: "exact",
    status: "validated",
  },
  {
    id: "cpa",
    name: "CPA",
    formula: "Ad Spend ÷ Purchases",
    sourceData: ["Ad platform purchases", "Ad spend"],
    unitTest: "integrity suite",
    example: "12100 ÷ 190 ≈ 63.684",
    tolerance: "exact",
    status: "validated",
  },
  {
    id: "cac",
    name: "CAC",
    formula: "Ad Spend ÷ Customers acquired (orders proxy when customers unknown)",
    sourceData: ["Ad spend", "Shopify customers"],
    unitTest: "integrity suite",
    example: "12100 ÷ 280 ≈ 43.214",
    tolerance: "exact",
    status: "validated",
  },
  {
    id: "aov",
    name: "AOV",
    formula: "Revenue ÷ Orders",
    sourceData: ["Shopify"],
    unitTest: "formulas.test.ts + integrity suite",
    example: "52340 ÷ 10 = 5234",
    tolerance: "exact",
    status: "validated",
  },
  {
    id: "business_recovery",
    name: "Business Recovery",
    formula: "Avoided Waste + Recovered Revenue + Margin Improvement",
    sourceData: ["DecisionImpact / campaign savings bounds"],
    unitTest: "impact.test.ts + golden-audit + e2e-reconciliation",
    example: "Low savings bound $6,168 → Business Recovery = 6168",
    tolerance: "exact",
    status: "validated",
  },
  {
    id: "net_profit_impact",
    name: "Net Profit Impact",
    formula:
      "Marketing: Amount × 0.55 efficiency — or Amount × store net margin %",
    sourceData: ["DecisionImpact", "BusinessKPIs.netMarginPct"],
    unitTest: "impact.test.ts + golden-audit + e2e-reconciliation",
    example: "Explicit label profit preserved → Net Profit Impact = 636",
    tolerance: "exact",
    status: "validated",
  },
];

export function assertRegistryComplete(requiredIds: string[]): void {
  const have = new Set(KPI_VALIDATION_REGISTRY.map((k) => k.id));
  const missing = requiredIds.filter((id) => !have.has(id));
  if (missing.length) {
    throw new Error(`KPI registry missing ids: ${missing.join(", ")}`);
  }
  const provisional = KPI_VALIDATION_REGISTRY.filter(
    (k) => requiredIds.includes(k.id) && k.status !== "validated",
  );
  if (provisional.length) {
    throw new Error(
      `Required KPIs not validated: ${provisional.map((k) => k.id).join(", ")}`,
    );
  }
}
