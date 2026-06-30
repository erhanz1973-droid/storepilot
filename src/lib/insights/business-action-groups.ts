import type { ShopifyProduct } from "@/lib/connectors/types";
import type { SupportingMetric } from "@/lib/types";
import type { FutureActionType } from "./actions";
import { createCommerceOpportunity, type CommerceOpportunity } from "./opportunity-schema";

export type AffectedEntity = {
  id: string;
  name: string;
  inventoryUnits?: number;
  unitsSold30d?: number;
  tiedUpValue?: number;
};

export const DEAD_INVENTORY_GROUP_ID = "shop-dead-inventory-clearance";
export const DEAD_INVENTORY_GROUP_KEY = "dead_inventory:clearance";

const CLEARANCE_DISCOUNT_PERCENT = 15;
const CLEARANCE_DURATION_DAYS = 7;

/** Sell-through heuristic for clearance promo impact estimates */
const REVENUE_RECOVERY_RATE = 0.32;
const INVENTORY_REDUCTION_RATE = 0.36;

export function isDeadInventoryProduct(product: ShopifyProduct): boolean {
  return (
    product.unitsSold30d <= 5 &&
    product.inventoryQuantity >= 7 &&
    product.price > 20
  );
}

export function detectDeadInventoryProducts(products: ShopifyProduct[]): ShopifyProduct[] {
  return products.filter(isDeadInventoryProduct);
}

export function buildDeadInventoryBusinessAction(
  products: ShopifyProduct[],
): CommerceOpportunity | null {
  const dead = detectDeadInventoryProducts(products);
  if (dead.length === 0) return null;

  const affectedEntities: AffectedEntity[] = dead.map((p) => ({
    id: p.id,
    name: p.title,
    inventoryUnits: p.inventoryQuantity,
    unitsSold30d: p.unitsSold30d,
    tiedUpValue: p.inventoryQuantity * p.price,
  }));

  const totalUnits = dead.reduce((sum, p) => sum + p.inventoryQuantity, 0);
  const tiedUpValue = dead.reduce((sum, p) => sum + p.inventoryQuantity * p.price, 0);
  const estimatedRevenueRecovery = Math.round(tiedUpValue * REVENUE_RECOVERY_RATE);
  const estimatedInventoryReduction = Math.max(1, Math.round(totalUnits * INVENTORY_REDUCTION_RATE));
  const avgConfidence = Math.round(
    dead.reduce((sum, p) => sum + (p.unitsSold30d === 0 ? 78 : 74), 0) / dead.length,
  );

  const severity =
    dead.length >= 5 || tiedUpValue >= 10_000
      ? "high"
      : dead.length >= 3 || tiedUpValue >= 5_000
        ? "medium"
        : "medium";

  const productLabel =
    dead.length === 1
      ? "1 product has not sold in the last 30 days."
      : `${dead.length} products have not sold in the last 30 days.`;

  const supportingMetrics: SupportingMetric[] = [
    { label: "Products affected", value: String(dead.length) },
    { label: "Total inventory", value: `${totalUnits} units` },
    { label: "Tied-up value", value: `$${tiedUpValue.toLocaleString()}` },
    { label: "Discount", value: `${CLEARANCE_DISCOUNT_PERCENT}%` },
    { label: "Duration", value: `${CLEARANCE_DURATION_DAYS} days` },
    {
      label: "Est. revenue recovery",
      value: `$${estimatedRevenueRecovery.toLocaleString()}`,
    },
    {
      label: "Est. inventory reduction",
      value: `${estimatedInventoryReduction} units`,
    },
  ];

  return createCommerceOpportunity({
    id: DEAD_INVENTORY_GROUP_ID,
    source: "shopify",
    severity,
    confidence: avgConfidence,
    title: "Dead inventory",
    description: productLabel,
    recommendation:
      dead.length === 1
        ? "Create one automatic clearance discount for this slow-moving SKU."
        : "Create one automatic clearance discount covering all affected products.",
    category: "inventory",
    supportingMetrics,
    why: [
      { label: "Problem", value: "Slow-moving stock tying up cash" },
      { label: "Products affected", value: String(dead.length) },
      { label: "Tied-up value", value: `$${tiedUpValue.toLocaleString()}` },
    ],
    expectedImpact: {
      revenueMonthly: estimatedRevenueRecovery,
      label: `Est. $${estimatedRevenueRecovery.toLocaleString()} revenue recovery`,
    },
    futureAction: "create_automatic_discount" satisfies FutureActionType,
    relatedEntityType: "product",
    relatedEntityId: dead[0].id,
    executionParams: {
      discountPercent: CLEARANCE_DISCOUNT_PERCENT,
      durationDays: CLEARANCE_DURATION_DAYS,
      productIds: dead.map((p) => p.id),
    },
    groupKey: DEAD_INVENTORY_GROUP_KEY,
    isGroupedAction: true,
    affectedEntities,
    memberOpportunityIds: dead.map((p) => `shop-dead-inv-${p.id}`),
  });
}

const PER_PRODUCT_DEAD_INV_PREFIX = "shop-dead-inv-";

export function isPerProductDeadInventoryOpportunity(opp: CommerceOpportunity): boolean {
  return opp.id.startsWith(PER_PRODUCT_DEAD_INV_PREFIX);
}

function normalizeSingleDeadInventory(single: CommerceOpportunity): CommerceOpportunity {
  const name = single.title.replace(/^Dead inventory — /i, "");
  return {
    ...single,
    id: DEAD_INVENTORY_GROUP_ID,
    title: "Dead inventory",
    description: "1 product has not sold in the last 30 days.",
    recommendation: "Create one automatic clearance discount for this slow-moving SKU.",
    isGroupedAction: true,
    groupKey: DEAD_INVENTORY_GROUP_KEY,
    memberOpportunityIds: [single.id],
    affectedEntities: single.relatedEntityId
      ? [{ id: single.relatedEntityId, name }]
      : [],
    executionParams: {
      discountPercent: CLEARANCE_DISCOUNT_PERCENT,
      durationDays: CLEARANCE_DURATION_DAYS,
      productIds: single.relatedEntityId ? [single.relatedEntityId] : [],
      ...single.executionParams,
    },
  };
}

function mergeDeadInventoryOpportunities(
  members: CommerceOpportunity[],
): CommerceOpportunity {
  const productIds = members
    .map((m) => m.relatedEntityId)
    .filter((id): id is string => Boolean(id));
  const affectedEntities: AffectedEntity[] = members
    .filter((m) => m.relatedEntityId)
    .map((m) => ({
      id: m.relatedEntityId!,
      name: m.title.replace(/^Dead inventory — /i, ""),
    }));

  let totalUnits = 0;
  let tiedUpValue = 0;
  for (const m of members) {
    const inv = m.supportingMetrics.find((s) => s.label === "Inventory");
    const tied = m.supportingMetrics.find((s) => s.label === "Tied-up value");
    if (inv) totalUnits += parseInt(inv.value, 10) || 0;
    if (tied) {
      tiedUpValue += parseFloat(tied.value.replace(/[$,]/g, "")) || 0;
    }
  }

  const estimatedRevenueRecovery = Math.round(
    tiedUpValue > 0 ? tiedUpValue * REVENUE_RECOVERY_RATE : members.reduce(
      (s, m) => s + (m.expectedImpact.revenueMonthly ?? 0),
      0,
    ),
  );
  const estimatedInventoryReduction = Math.max(
    1,
    Math.round(totalUnits > 0 ? totalUnits * INVENTORY_REDUCTION_RATE : members.length * 3),
  );

  return createCommerceOpportunity({
    id: DEAD_INVENTORY_GROUP_ID,
    source: "shopify",
    severity: members.length >= 5 ? "high" : "medium",
    confidence: Math.round(
      members.reduce((s, m) => s + m.confidence, 0) / members.length,
    ),
    title: "Dead inventory",
    description: `${members.length} products have not sold in the last 30 days.`,
    recommendation: "Create one automatic clearance discount covering all affected products.",
    category: "inventory",
    supportingMetrics: [
      { label: "Products affected", value: String(members.length) },
      { label: "Total inventory", value: `${totalUnits} units` },
      { label: "Tied-up value", value: `$${Math.round(tiedUpValue).toLocaleString()}` },
      { label: "Discount", value: `${CLEARANCE_DISCOUNT_PERCENT}%` },
      { label: "Duration", value: `${CLEARANCE_DURATION_DAYS} days` },
      {
        label: "Est. revenue recovery",
        value: `$${estimatedRevenueRecovery.toLocaleString()}`,
      },
      {
        label: "Est. inventory reduction",
        value: `${estimatedInventoryReduction} units`,
      },
    ],
    expectedImpact: {
      revenueMonthly: estimatedRevenueRecovery,
      label: `Est. $${estimatedRevenueRecovery.toLocaleString()} revenue recovery`,
    },
    futureAction: "create_automatic_discount",
    relatedEntityType: "product",
    relatedEntityId: productIds[0],
    executionParams: {
      discountPercent: CLEARANCE_DISCOUNT_PERCENT,
      durationDays: CLEARANCE_DURATION_DAYS,
      productIds,
    },
    groupKey: DEAD_INVENTORY_GROUP_KEY,
    isGroupedAction: true,
    affectedEntities,
    memberOpportunityIds: members.map((m) => m.id),
  });
}

export function collectGroupedProductIds(opportunities: CommerceOpportunity[]): Set<string> {
  const ids = new Set<string>();
  for (const opp of opportunities) {
    if (!opp.isGroupedAction) continue;
    for (const entity of opp.affectedEntities ?? []) {
      ids.add(entity.id);
    }
    for (const productId of opp.executionParams?.productIds ?? []) {
      ids.add(productId);
    }
  }
  return ids;
}

/**
 * Replace per-SKU dead inventory cards with one grouped business action.
 */
export function groupCommerceOpportunities(
  opportunities: CommerceOpportunity[],
): CommerceOpportunity[] {
  const withoutDeadInv = opportunities.filter((o) => !isPerProductDeadInventoryOpportunity(o));

  const grouped = opportunities.find(
    (o) => o.id === DEAD_INVENTORY_GROUP_ID || o.groupKey === DEAD_INVENTORY_GROUP_KEY,
  );
  if (grouped) {
    return [...withoutDeadInv, grouped];
  }

  const deadInvMembers = opportunities.filter(isPerProductDeadInventoryOpportunity);
  if (deadInvMembers.length === 0) {
    return opportunities;
  }
  if (deadInvMembers.length === 1) {
    return [...withoutDeadInv, normalizeSingleDeadInventory(deadInvMembers[0])];
  }

  return [...withoutDeadInv, mergeDeadInventoryOpportunities(deadInvMembers)];
}
