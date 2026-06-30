import type { ShopifyProduct } from "@/lib/connectors/types";
import type { ProductCostRecord } from "@/lib/db/product-costs";

export type CostSource = "shopify" | "manual" | "estimated";

export function resolveCostSource(
  product: ShopifyProduct,
  costs: Map<string, ProductCostRecord>,
): CostSource {
  if (product.unitCost != null && product.unitCost > 0) return "shopify";
  if (costs.has(product.id)) return "manual";
  return "estimated";
}
