import { hasActiveAdsConnector } from "@/lib/connectors/active";
import type { ShopifyProduct, StoreSnapshot } from "@/lib/connectors/types";
import type { ProductCostRecord } from "@/lib/db/product-costs";
import { resolveCostSource } from "@/lib/profit/cost-source";
import type { ProfitInputAvailability, ProfitInputId } from "@/lib/profit/types";

function input(
  id: ProfitInputId,
  label: string,
  available: boolean,
  source: ProfitInputAvailability["source"],
  estimated: boolean,
): ProfitInputAvailability {
  return { id, label, available, source, estimated };
}

export function detectProfitInputs(
  snapshot: StoreSnapshot,
  products: ShopifyProduct[],
  costs: Map<string, ProductCostRecord>,
): ProfitInputAvailability[] {
  const rollups = snapshot.profitRollups;
  const revenue30d = rollups?.last30d.revenue ?? 0;
  const orders30d = rollups?.last30d.orders ?? 0;
  const shippingFromOrders = (rollups?.last30d.shipping ?? 0) > 0;
  const ops = snapshot.operationalCosts;
  const shopifyConnected =
    snapshot.connectorStates.shopify === "connected" ||
    snapshot.connectorStates.shopify === "demo";

  const withSales = products.filter((p) => p.unitsSold30d > 0);
  let actualCosts = 0;
  let estimatedCosts = 0;
  for (const p of withSales) {
    const source = resolveCostSource(p, costs);
    if (source === "estimated") estimatedCosts += 1;
    else actualCosts += 1;
  }

  const hasAccountingCogs = ops?.actualCogs30d != null && ops.actualCogs30d > 0;
  const allCostsMissing =
    withSales.length > 0 && actualCosts === 0 && !hasAccountingCogs;
  const someCostsEstimated = estimatedCosts > 0 && !hasAccountingCogs;
  const allCostsVerified =
    withSales.length > 0 && estimatedCosts === 0 && actualCosts > 0;

  let productCostSource: ProfitInputAvailability["source"] = "missing";
  if (hasAccountingCogs) productCostSource = "accounting";
  else if (allCostsVerified) productCostSource = "shopify";
  else if (someCostsEstimated || allCostsMissing) productCostSource = "estimated";

  const adsConnected = hasActiveAdsConnector(snapshot.connectorStates);
  const adSpendFromSnapshot =
    (snapshot.adSpendSnapshot?.totalRollups.last30d.spend ?? 0) > 0 ||
    snapshot.campaigns.some((c) => c.spend7d > 0) ||
    (snapshot.googleAdsSnapshot?.rollups.last30d.spend ?? 0) > 0;

  let adSource: ProfitInputAvailability["source"] = "missing";
  if (adsConnected && adSpendFromSnapshot) {
    if (snapshot.adSpendSnapshot) adSource = "shopify";
    else if (snapshot.googleAdsSnapshot?.rollups.last30d.spend) adSource = "google";
    else adSource = "meta";
  } else if (adsConnected) {
    adSource = "meta";
  }

  const shippingFromOps =
    ops != null &&
    ops.shippingCost30d > 0 &&
    ops.sources.some((s) => /ship|carrier/i.test(s));
  const shippingFromManual =
    ops != null && ops.shippingCost30d > 0 && !shippingFromOps;
  const shippingFromIntegration = snapshot.integrationSnapshot?.shipping != null;

  let shippingSource: ProfitInputAvailability["source"] = "missing";
  if (shippingFromIntegration || shippingFromOps) shippingSource = "carrier";
  else if (shippingFromManual) shippingSource = "manual";
  else if (shippingFromOrders) shippingSource = "shopify";

  const packagingConfigured =
    ops != null && (ops.packingCost30d ?? 0) > 0;

  const paymentFeesEstimated = true;

  const refundsFromShopify = (rollups?.last30d.refunds ?? 0) >= 0 && shopifyConnected;

  return [
    input(
      "revenue",
      "Revenue",
      shopifyConnected && revenue30d > 0,
      shopifyConnected ? "shopify" : "missing",
      false,
    ),
    input(
      "product_costs",
      "Product Costs",
      hasAccountingCogs || allCostsVerified || someCostsEstimated,
      productCostSource,
      allCostsMissing || someCostsEstimated,
    ),
    input(
      "advertising",
      "Advertising Costs",
      adsConnected,
      adSource,
      adsConnected && !adSpendFromSnapshot,
    ),
    input(
      "shipping_costs",
      "Shipping Costs",
      shippingFromOrders || shippingFromOps || shippingFromManual || shippingFromIntegration,
      shippingSource,
      shippingFromOrders && !shippingFromOps && !shippingFromManual && !shippingFromIntegration,
    ),
    input(
      "packaging_costs",
      "Packaging Costs",
      packagingConfigured,
      packagingConfigured ? "manual" : "missing",
      !packagingConfigured,
    ),
    input(
      "payment_fees",
      "Payment Fees",
      shopifyConnected,
      paymentFeesEstimated ? "estimated" : "shopify",
      paymentFeesEstimated,
    ),
    input(
      "refunds",
      "Refunds",
      refundsFromShopify && orders30d > 0,
      refundsFromShopify ? "shopify" : "missing",
      false,
    ),
    input(
      "taxes",
      "Taxes",
      false,
      "missing",
      true,
    ),
  ];
}

export function missingInputIds(inputs: ProfitInputAvailability[]): ProfitInputId[] {
  const required: ProfitInputId[] = [
    "revenue",
    "product_costs",
    "advertising",
    "shipping_costs",
    "payment_fees",
  ];
  const missing: ProfitInputId[] = [];
  for (const id of required) {
    const row = inputs.find((i) => i.id === id);
    if (!row?.available || row.estimated) missing.push(id);
  }
  for (const row of inputs) {
    if (row.id === "packaging_costs" && row.estimated && !missing.includes(row.id)) {
      missing.push(row.id);
    }
  }
  return missing;
}
