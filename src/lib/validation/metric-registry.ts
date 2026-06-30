/**
 * Canonical metric registry — single source of truth for Phase 1–3 validation.
 * Every KPI displayed in the app should have an entry here.
 *
 * @see docs/METRIC_VALIDATION_TABLE.md
 * @see docs/CALCULATION_REGISTRY.md
 * @see docs/SOURCE_TRACEABILITY.md
 */

export type MetricValidationStatus =
  | "pass" // Formula verified + automated or manual cross-check
  | "estimated" // Documented estimate when source data missing
  | "blocked" // Connector not implemented (e.g. live GA4)
  | "pending"; // Awaiting pilot store cross-check

export type MetricRegistryEntry = {
  id: string;
  label: string;
  sourceApi: string;
  sourceField: string;
  calculation: string;
  codePath: string;
  dependencies: string[];
  surfaces: string[]; // pages/components that display this metric
  validationStatus: MetricValidationStatus;
  crossCheckWith?: string;
  varianceNotes?: string;
  expectedRange?: string;
};

export const METRIC_REGISTRY: MetricRegistryEntry[] = [
  // ——— Shopify commerce ———
  {
    id: "shopify.revenue_30d",
    label: "Revenue (30d)",
    sourceApi: "Shopify Admin GraphQL",
    sourceField: "orders[].totalPriceSet.shopMoney.amount",
    calculation: "SUM(order totals) for orders in 30d window",
    codePath: "lib/shopify/sync.ts → computeStoreMetrics",
    dependencies: ["shopify"],
    surfaces: ["Executive", "Profit", "Reports", "Products", "Marketing (context)"],
    validationStatus: "pass",
    crossCheckWith: "Shopify Analytics → Total sales",
    varianceNotes: "Match date range and currency; refunds may differ by report type",
    expectedRange: "> 0 for active stores",
  },
  {
    id: "shopify.orders_30d",
    label: "Orders (30d)",
    sourceApi: "Shopify Admin GraphQL",
    sourceField: "orders count in sync window",
    calculation: "COUNT(orders)",
    codePath: "lib/shopify/sync.ts → computeStoreMetrics",
    dependencies: ["shopify"],
    surfaces: ["Executive", "Profit", "Reports", "Live"],
    validationStatus: "pass",
    crossCheckWith: "Shopify Analytics → Orders",
  },
  {
    id: "shopify.aov",
    label: "Average Order Value",
    sourceApi: "Shopify (derived)",
    sourceField: "revenue30d, orders30d",
    calculation: "revenue30d ÷ orders30d",
    codePath: "lib/shopify/sync.ts → computeStoreMetrics",
    dependencies: ["shopify"],
    surfaces: ["Executive", "Customers", "Reports"],
    validationStatus: "pass",
    crossCheckWith: "Shopify Analytics → AOV",
  },
  {
    id: "shopify.refunds",
    label: "Refunds",
    sourceApi: "Shopify Admin GraphQL",
    sourceField: "order.totalRefundedSet",
    calculation: "SUM(refunds) per profit window bucket",
    codePath: "lib/shopify/sync.ts → computeProfitRollups",
    dependencies: ["shopify"],
    surfaces: ["Profit"],
    validationStatus: "pass",
    crossCheckWith: "Shopify Analytics → Returns",
  },
  {
    id: "shopify.cogs",
    label: "COGS",
    sourceApi: "Shopify inventoryItem.unitCost OR estimate",
    sourceField: "inventoryItem.unitCost × units sold",
    calculation: "SUM(unitCost × qty); fallback ESTIMATED_COGS_RATE (45%)",
    codePath: "lib/profit/engine.ts, lib/profit/constants.ts",
    dependencies: ["shopify"],
    surfaces: ["Profit", "Products"],
    validationStatus: "estimated",
    varianceNotes: "Flagged in profit confidence when unit costs missing",
    expectedRange: "10–70% of revenue depending on category",
  },
  {
    id: "shopify.transaction_fees",
    label: "Payment / transaction fees",
    sourceApi: "Estimated (Shopify Payments pattern)",
    sourceField: "N/A — not from Payments API",
    calculation: "2.9% × revenue + $0.30 × orders",
    codePath: "lib/profit/constants.ts, lib/profit/engine.ts",
    dependencies: ["shopify"],
    surfaces: ["Profit"],
    validationStatus: "estimated",
    varianceNotes: "Replace with actual fee data when Payments API integrated",
  },
  // ——— Profit ———
  {
    id: "profit.net_profit",
    label: "Net Profit",
    sourceApi: "Derived",
    sourceField: "profitRollups + ad spend + fees",
    calculation: "Revenue − COGS − Shipping − Refunds − Fees − Ad Spend − Ops",
    codePath: "lib/profit/engine.ts → buildPeriodMetrics",
    dependencies: ["shopify", "meta_ads", "google_ads"],
    surfaces: ["Executive", "Profit", "Reports", "Live"],
    validationStatus: "pass",
    crossCheckWith: "Manual spreadsheet",
    varianceNotes: "Automated 0% tolerance vs manualNetProfit in validate suite",
  },
  {
    id: "profit.gross_profit",
    label: "Gross Profit",
    sourceApi: "Derived",
    sourceField: "revenue, cogs",
    calculation: "Revenue − COGS",
    codePath: "lib/profit/engine.ts",
    dependencies: ["shopify"],
    surfaces: ["Profit"],
    validationStatus: "pass",
  },
  {
    id: "profit.margin_pct",
    label: "Profit Margin %",
    sourceApi: "Derived",
    sourceField: "netProfit, revenue",
    calculation: "(netProfit ÷ revenue) × 100",
    codePath: "lib/profit/engine.ts",
    dependencies: ["shopify"],
    surfaces: ["Profit", "Executive"],
    validationStatus: "pass",
  },
  // ——— ROAS / ads ———
  {
    id: "roas.blended",
    label: "Blended ROAS",
    sourceApi: "Derived",
    sourceField: "Shopify revenue + total ad spend",
    calculation: "Shopify revenue (window) ÷ total ad spend (window)",
    codePath: "lib/profit/roas.ts → computeRoas",
    dependencies: ["shopify", "meta_ads", "google_ads"],
    surfaces: ["Executive", "Profit", "Marketing", "Reports"],
    validationStatus: "pass",
    crossCheckWith: "Shopify revenue ÷ (Meta spend + Google spend)",
    varianceNotes: "Not platform-reported ROAS; uses store revenue not attributed revenue",
  },
  {
    id: "roas.mer",
    label: "MER",
    sourceApi: "Derived",
    sourceField: "revenue30d, spend30d",
    calculation: "revenue ÷ total ad spend",
    codePath: "lib/analytics/executive.ts (same inputs as blended ROAS)",
    dependencies: ["shopify", "meta_ads", "google_ads"],
    surfaces: ["Internal only"],
    validationStatus: "pass",
  },
  {
    id: "meta.spend_7d",
    label: "Meta Spend (7d)",
    sourceApi: "Meta Graph API Insights",
    sourceField: "insights.spend",
    calculation: "SUM(campaign/account insights spend)",
    codePath: "lib/meta/sync.ts",
    dependencies: ["meta_ads"],
    surfaces: ["Marketing", "Executive", "Reports"],
    validationStatus: "pass",
    crossCheckWith: "Meta Ads Manager → Amount spent",
    varianceNotes: "Timezone and attribution window may differ slightly",
  },
  {
    id: "meta.roas_7d",
    label: "Meta ROAS (7d)",
    sourceApi: "Meta Graph API + derived",
    sourceField: "insights spend + purchase action_values",
    calculation: "purchase_value ÷ spend",
    codePath: "lib/meta/sync.ts",
    dependencies: ["meta_ads"],
    surfaces: ["Marketing", "Campaign detail"],
    validationStatus: "pass",
    crossCheckWith: "Meta Ads Manager → Purchase ROAS",
    varianceNotes: "Meta uses its attribution model; may differ from blended ROAS",
  },
  {
    id: "meta.impressions",
    label: "Meta Impressions",
    sourceApi: "Meta Graph API Insights",
    sourceField: "insights.impressions",
    calculation: "Passthrough",
    codePath: "lib/meta/sync.ts",
    dependencies: ["meta_ads"],
    surfaces: ["Marketing"],
    validationStatus: "pass",
    crossCheckWith: "Meta Ads Manager",
  },
  {
    id: "meta.clicks",
    label: "Meta Clicks",
    sourceApi: "Meta Graph API Insights",
    sourceField: "insights.clicks",
    calculation: "Passthrough",
    codePath: "lib/meta/sync.ts",
    dependencies: ["meta_ads"],
    surfaces: ["Marketing"],
    validationStatus: "pass",
  },
  {
    id: "meta.ctr",
    label: "Meta CTR",
    sourceApi: "Meta Graph API Insights",
    sourceField: "insights.ctr OR clicks÷impressions",
    calculation: "Passthrough or derived",
    codePath: "lib/meta/sync.ts, lib/analytics/marketing.ts",
    dependencies: ["meta_ads"],
    surfaces: ["Marketing"],
    validationStatus: "pass",
  },
  {
    id: "meta.purchases",
    label: "Meta Purchases",
    sourceApi: "Meta Graph API Insights",
    sourceField: "actions[type=purchase]",
    calculation: "Parsed from actions array",
    codePath: "lib/meta/sync.ts",
    dependencies: ["meta_ads"],
    surfaces: ["Marketing"],
    validationStatus: "pass",
    crossCheckWith: "Meta Ads Manager → Purchases",
  },
  {
    id: "google.spend",
    label: "Google Ads Spend",
    sourceApi: "Google Ads API (GAQL)",
    sourceField: "metrics.cost_micros",
    calculation: "cost_micros ÷ 1,000,000",
    codePath: "lib/google-ads/api.ts",
    dependencies: ["google_ads"],
    surfaces: ["Marketing", "Executive"],
    validationStatus: "pass",
    crossCheckWith: "Google Ads → Cost",
  },
  {
    id: "google.conversions",
    label: "Google Conversions",
    sourceApi: "Google Ads API",
    sourceField: "metrics.conversions",
    calculation: "Passthrough",
    codePath: "lib/google-ads/api.ts",
    dependencies: ["google_ads"],
    surfaces: ["Marketing"],
    validationStatus: "pass",
  },
  {
    id: "google.conversion_value",
    label: "Google Conversion Value",
    sourceApi: "Google Ads API",
    sourceField: "metrics.conversions_value",
    calculation: "Passthrough",
    codePath: "lib/google-ads/api.ts",
    dependencies: ["google_ads"],
    surfaces: ["Marketing"],
    validationStatus: "pass",
  },
  {
    id: "google.roas",
    label: "Google ROAS",
    sourceApi: "Derived",
    sourceField: "conversions_value, spend",
    calculation: "conversion_value ÷ spend",
    codePath: "lib/google-ads/api.ts",
    dependencies: ["google_ads"],
    surfaces: ["Marketing"],
    validationStatus: "pass",
  },
  {
    id: "marketing.campaign_profit",
    label: "Campaign Profit (marketing table)",
    sourceApi: "Meta campaign profit7d when synced",
    sourceField: "campaign.profit7d",
    calculation: "From sync when available; otherwise not shown (—)",
    codePath: "lib/analytics/marketing.ts",
    dependencies: ["meta_ads", "profit"],
    surfaces: ["Marketing"],
    validationStatus: "estimated",
    varianceNotes: "Requires profit allocation per campaign",
  },
  // ——— GA4 / traffic ———
  {
    id: "ga4.sessions",
    label: "Sessions",
    sourceApi: "GA4 Data API",
    sourceField: "sessions metric",
    calculation: "Passthrough",
    codePath: "NOT IMPLEMENTED — demo fixture only in dev",
    dependencies: ["ga4"],
    surfaces: ["Traffic", "Executive", "Funnel"],
    validationStatus: "blocked",
    crossCheckWith: "GA4 → Sessions",
    varianceNotes: "Live connector required before App Store claim",
  },
  {
    id: "analytics.cvr",
    label: "Conversion Rate",
    sourceApi: "Derived",
    sourceField: "shopify.orders30d, ga4.sessions30d",
    calculation: "(orders ÷ sessions) × 100",
    codePath: "lib/analytics/executive.ts",
    dependencies: ["shopify", "ga4"],
    surfaces: ["Executive"],
    validationStatus: "blocked",
    varianceNotes: "Shows — without GA4",
  },
  // ——— Reports (aggregates same sources) ———
  {
    id: "reports.executive_revenue",
    label: "Reports — Executive Revenue",
    sourceApi: "Same as shopify.revenue_30d / profit.primary",
    sourceField: "profitDashboard.primary.revenue",
    calculation: "Passed through from profit dashboard",
    codePath: "lib/reports/build-weekly-briefing.ts",
    dependencies: ["shopify"],
    surfaces: ["Reports"],
    validationStatus: "pass",
    varianceNotes: "Must match Executive dashboard for same period",
  },
  {
    id: "reports.ai_outcomes",
    label: "Reports — AI recovery metrics",
    sourceApi: "Recommendation intelligence + outcomes DB",
    sourceField: "intelligence.*, aiPerformance.*",
    calculation: "From measured recommendations and opportunity totals",
    codePath: "lib/reports/build-weekly-briefing.ts",
    dependencies: ["shopify"],
    surfaces: ["Reports"],
    validationStatus: "pending",
    varianceNotes: "Depends on completed recommendation measurements",
  },
  // ——— AI recommendations (projections, not historical KPIs) ———
  {
    id: "ai.estimated_impact",
    label: "Recommendation estimated impact",
    sourceApi: "Opportunity engine (projections)",
    sourceField: "estimatedMonthlyNetProfitImpact",
    calculation: "Heuristic models in lib/opportunities/engine.ts",
    codePath: "lib/opportunities/engine.ts",
    dependencies: ["shopify", "meta_ads"],
    surfaces: ["Decisions", "Reports", "Executive opportunities"],
    validationStatus: "estimated",
    varianceNotes: "Forward-looking estimate — not a historical KPI",
  },
];

export function getMetricById(id: string): MetricRegistryEntry | undefined {
  return METRIC_REGISTRY.find((m) => m.id === id);
}

export function metricsBySurface(surface: string): MetricRegistryEntry[] {
  return METRIC_REGISTRY.filter((m) => m.surfaces.some((s) => s.toLowerCase().includes(surface.toLowerCase())));
}

export function metricsByStatus(status: MetricValidationStatus): MetricRegistryEntry[] {
  return METRIC_REGISTRY.filter((m) => m.validationStatus === status);
}

export function registrySummary(): {
  total: number;
  pass: number;
  estimated: number;
  blocked: number;
  pending: number;
  readyForRc1: boolean;
} {
  const pass = metricsByStatus("pass").length;
  const estimated = metricsByStatus("estimated").length;
  const blocked = metricsByStatus("blocked").length;
  const pending = metricsByStatus("pending").length;
  return {
    total: METRIC_REGISTRY.length,
    pass,
    estimated,
    blocked,
    pending,
    readyForRc1: blocked === 0 && pending === 0,
  };
}
