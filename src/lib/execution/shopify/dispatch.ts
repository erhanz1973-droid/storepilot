import type { ActionExecutionContext, ActionExecutionOutcome } from "@/lib/execution/types";
import { executeAddToCollection } from "./add-to-collection";
import { executeCreateAutomaticDiscount } from "./create-automatic-discount";
import { executeCreateBundle } from "./create-bundle";
import { executeCreateDiscountCode } from "./create-discount-code";
import { executePublishProduct, executeUnpublishProduct } from "./product-visibility";

const BLOCKED_SHOPIFY_ACTIONS = new Set(["update_product_price", "restock_product"]);

export async function executeShopifyAction(
  ctx: ActionExecutionContext,
): Promise<ActionExecutionOutcome | null> {
  if (ctx.platform !== "shopify") return null;
  if (BLOCKED_SHOPIFY_ACTIONS.has(ctx.actionType)) return null;

  switch (ctx.actionType) {
    case "create_automatic_discount":
    case "create_discount":
      if (ctx.entityType !== "product") return null;
      return executeCreateAutomaticDiscount(ctx);

    case "create_discount_code":
      if (ctx.entityType !== "product") return null;
      return executeCreateDiscountCode(ctx);

    case "create_bundle":
    case "create_promotion":
      if (ctx.entityType !== "product") return null;
      return executeCreateBundle(ctx);

    case "add_to_collection":
      if (ctx.entityType !== "product") return null;
      return executeAddToCollection(ctx);

    case "publish_product":
      if (ctx.entityType !== "product") return null;
      return executePublishProduct(ctx);

    case "unpublish_product":
      if (ctx.entityType !== "product") return null;
      return executeUnpublishProduct(ctx);

    default:
      return null;
  }
}
