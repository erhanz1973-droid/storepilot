import type { BusinessKPIs } from "../kpis/engine";
import type { RealitySourceObservation, StorePilotKpiSnapshot } from "./types";

/**
 * Primary source-backed KPIs for Reality Validation.
 * Derived metrics (net profit, ROAS, …) inherit trust from inputs + integrity suite —
 * they are not independently present in Shopify/Meta Analytics UIs in the same form.
 */
export function storePilotKpisFromBusinessKpis(
  kpis: BusinessKPIs,
  opts?: { lastSyncedAt?: string | null; includeDerived?: boolean },
): StorePilotKpiSnapshot[] {
  const synced = opts?.lastSyncedAt ?? null;
  const primary: StorePilotKpiSnapshot[] = [
    { kpiId: "revenue", label: "Revenue", value: kpis.revenue, lastSyncedAt: synced, critical: true },
    { kpiId: "orders", label: "Orders", value: kpis.orders, lastSyncedAt: synced, critical: true },
    {
      kpiId: "ad_spend",
      label: "Advertising Spend",
      value: kpis.adSpend,
      lastSyncedAt: synced,
      critical: true,
    },
    {
      kpiId: "cogs",
      label: "Cost of Goods (COGS)",
      value: kpis.cogs > 0 ? kpis.cogs : null,
      lastSyncedAt: synced,
      profitSensitive: true,
    },
    { kpiId: "refunds", label: "Refunds", value: kpis.refunds, lastSyncedAt: synced },
    {
      kpiId: "shipping",
      label: "Shipping Cost",
      value: kpis.shippingCost,
      lastSyncedAt: synced,
      profitSensitive: true,
    },
    {
      kpiId: "platform_fees",
      label: "Platform Fees",
      value: kpis.platformFees,
      lastSyncedAt: synced,
      profitSensitive: true,
    },
  ];

  if (!opts?.includeDerived) return primary;

  return [
    ...primary,
    {
      kpiId: "gross_profit",
      label: "Gross Profit",
      value: kpis.grossProfit,
      lastSyncedAt: synced,
      profitSensitive: true,
    },
    {
      kpiId: "net_profit",
      label: "Net Profit",
      value: kpis.netProfit,
      lastSyncedAt: synced,
      profitSensitive: true,
    },
    { kpiId: "roas", label: "Blended ROAS", value: kpis.blendedRoas, lastSyncedAt: synced },
    { kpiId: "mer", label: "MER", value: kpis.mer, lastSyncedAt: synced },
    { kpiId: "aov", label: "AOV", value: kpis.aov, lastSyncedAt: synced },
    { kpiId: "cpa", label: "CPA", value: kpis.cpa, lastSyncedAt: synced },
    { kpiId: "cac", label: "CAC", value: kpis.cac, lastSyncedAt: synced },
    {
      kpiId: "sessions",
      label: "Sessions (GA4)",
      value: null,
      lastSyncedAt: synced,
    },
  ];
}

/** Build observations for integrity fixture = perfect Shopify + near Meta match */
export function realityObservationsFromIntegrityFixture(syncedAt: string): RealitySourceObservation[] {
  return [
    {
      kpiId: "revenue",
      source: "shopify_analytics",
      value: 52_340,
      observedAt: syncedAt,
      sourceField: "Shopify Orders · total_price sum",
    },
    {
      kpiId: "orders",
      source: "shopify_analytics",
      value: 10,
      observedAt: syncedAt,
      sourceField: "Shopify Orders · count",
    },
    {
      kpiId: "ad_spend",
      source: "meta_ads_manager",
      value: 12_087,
      observedAt: syncedAt,
      sourceField: "Meta Ads · amount_spent",
      knownCause: "timezone",
      explanation: "Timezone offset between Meta account TZ and StorePilot UTC day boundary.",
      relTolerance: 0.01,
    },
    {
      kpiId: "cogs",
      source: "shopify_analytics",
      value: 22_100,
      observedAt: syncedAt,
      sourceField: "Shopify · unit cost × quantity",
    },
    {
      kpiId: "refunds",
      source: "shopify_analytics",
      value: 0,
      observedAt: syncedAt,
    },
    {
      kpiId: "shipping",
      source: "shopify_analytics",
      value: 4_100,
      observedAt: syncedAt,
    },
    {
      kpiId: "platform_fees",
      source: "shopify_analytics",
      value: 720,
      observedAt: syncedAt,
    },
  ];
}
