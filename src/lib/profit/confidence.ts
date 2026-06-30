import type { ShopifyProduct, StoreSnapshot } from "@/lib/connectors/types";
import type { ProductCostRecord } from "@/lib/db/product-costs";
import { resolveCostSource } from "@/lib/profit/cost-source";
import {
  detectProfitInputs,
  missingInputIds,
} from "@/lib/profit/input-availability";
import type { ProfitConfidence } from "./types";
import { PROFIT_INPUT_LABELS } from "./types";

export { resolveCostSource, type CostSource } from "@/lib/profit/cost-source";

const INPUT_WEIGHTS: Record<string, number> = {
  revenue: 25,
  product_costs: 25,
  advertising: 20,
  shipping_costs: 15,
  payment_fees: 15,
};

function scoreFromInputs(
  inputs: ReturnType<typeof detectProfitInputs>,
): number {
  let earned = 0;
  let possible = 0;
  for (const [id, weight] of Object.entries(INPUT_WEIGHTS)) {
    const row = inputs.find((i) => i.id === id);
    if (!row) continue;
    possible += weight;
    if (!row.available) continue;
    if (row.estimated || row.source === "estimated") {
      earned += weight * 0.55;
    } else {
      earned += weight;
    }
  }
  if (possible === 0) return 0;
  return Math.round((earned / possible) * 100);
}

function deriveStatus(
  inputs: ReturnType<typeof detectProfitInputs>,
  scorePct: number,
  catalogProductsWithSales: number,
  productsWithEstimatedCost: number,
  snapshot?: StoreSnapshot,
): ProfitConfidence["status"] {
  const revenue = inputs.find((i) => i.id === "revenue");
  const costs = inputs.find((i) => i.id === "product_costs");

  if (!revenue?.available) return "unavailable";
  if (!snapshot?.profitRollups) return "unavailable";

  const hasAccountingCogs =
    snapshot.operationalCosts?.actualCogs30d != null &&
    snapshot.operationalCosts.actualCogs30d > 0;

  if (
    catalogProductsWithSales > 0 &&
    productsWithEstimatedCost === catalogProductsWithSales &&
    !hasAccountingCogs
  ) {
    return "unavailable";
  }

  if (costs?.source === "missing") return "unavailable";

  const missing = missingInputIds(inputs);
  const requiredVerified =
    missing.length === 0 &&
    !inputs.some(
      (i) =>
        (i.id === "revenue" ||
          i.id === "product_costs" ||
          i.id === "advertising" ||
          i.id === "shipping_costs" ||
          i.id === "payment_fees") &&
        i.estimated,
    );

  if (requiredVerified && scorePct >= 98) return "verified";
  if (scorePct > 0 && revenue.available) return "estimated";
  return "unavailable";
}

function buildNotice(
  status: ProfitConfidence["status"],
  missing: ProfitConfidence["missingInputs"],
): string | null {
  if (status === "verified") return null;
  if (status === "unavailable") {
    return "Complete Profit Setup to unlock accurate profitability analytics.";
  }
  if (missing.length === 0) return "Profit is estimated and may change after completing setup.";
  const labels = missing.map((id) => PROFIT_INPUT_LABELS[id].toLowerCase());
  if (labels.length === 1) {
    return `${PROFIT_INPUT_LABELS[missing[0]]} are not configured. Profit is estimated and may change after completing setup.`;
  }
  return `Some costs (${labels.slice(0, 2).join(", ")}) are not fully configured. Profit is estimated and may change after completing setup.`;
}

function buildReason(
  status: ProfitConfidence["status"],
  missing: ProfitConfidence["missingInputs"],
  productsWithEstimatedCost: number,
  catalogProductsWithSales: number,
): string {
  if (status === "verified") {
    return "All required profit inputs are available from connected data sources.";
  }
  if (status === "unavailable") {
    if (missing.includes("revenue")) return "Revenue data is not available — connect Shopify and sync orders.";
    if (missing.includes("product_costs")) {
      return "Product costs are not configured for any active SKU — add COGS to calculate profit.";
    }
    return "Critical profit inputs are missing.";
  }
  if (productsWithEstimatedCost > 0) {
    return `${productsWithEstimatedCost} of ${catalogProductsWithSales} products use estimated COGS.`;
  }
  if (missing.includes("shipping_costs")) {
    return "Shipping costs are estimated from order data or not fully configured.";
  }
  if (missing.includes("payment_fees")) {
    return "Payment fees use default rate estimates (2.9% + $0.30 per order).";
  }
  if (missing.includes("advertising")) {
    return "Advertising spend is not connected — profit may exclude ad costs.";
  }
  return "Some cost inputs are estimated or missing.";
}

export function computeProfitConfidence(
  products: ShopifyProduct[],
  costs: Map<string, ProductCostRecord>,
  snapshot?: StoreSnapshot,
): ProfitConfidence {
  const withSales = products.filter((p) => p.unitsSold30d > 0);
  let actual = 0;
  let estimated = 0;

  for (const p of withSales) {
    const source = resolveCostSource(p, costs);
    if (source === "estimated") estimated += 1;
    else actual += 1;
  }

  const catalogProductsWithSales = withSales.length;
  const inputs = snapshot
    ? detectProfitInputs(snapshot, products, costs)
    : [];

  let scorePct = snapshot ? scoreFromInputs(inputs) : 0;

  const hasAccountingCogs =
    snapshot?.operationalCosts?.actualCogs30d != null &&
    snapshot.operationalCosts.actualCogs30d > 0;

  const usesEstimatedCogs = hasAccountingCogs ? false : estimated > 0;

  const missingInputs = snapshot ? missingInputIds(inputs) : [];
  const status = snapshot
    ? deriveStatus(inputs, scorePct, catalogProductsWithSales, estimated, snapshot)
    : "unavailable";

  if (status === "unavailable") scorePct = 0;
  else if (status === "verified") scorePct = 100;

  let level: ProfitConfidence["level"] = "Low";
  if (scorePct >= 85) level = "High";
  else if (scorePct >= 50) level = "Medium";

  const reason = buildReason(
    status,
    missingInputs,
    estimated,
    catalogProductsWithSales,
  );
  const notice = buildNotice(status, missingInputs);

  return {
    scorePct,
    level,
    status,
    productsWithActualCost: actual,
    productsWithEstimatedCost: estimated,
    catalogProductsWithSales,
    usesEstimatedCogs,
    missingInputs,
    inputs,
    reason,
    notice,
    setupRequired: status !== "verified",
  };
}
