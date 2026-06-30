import type { ExecutionActionHandler, ExecutionProvider } from "@/lib/execution/provider";
import type { FutureActionType } from "@/lib/insights/actions";
import type {
  ActionExecutionContext,
  ActionExecutionOutcome,
  ExecutionEntityType,
} from "@/lib/execution/types";

function legacyHandler(input: {
  id: string;
  actionType: FutureActionType;
  entityTypes: ExecutionEntityType[];
  label: string;
  run: (ctx: ActionExecutionContext) => Promise<ActionExecutionOutcome>;
}): ExecutionActionHandler {
  return {
    id: input.id,
    platform: "shopify",
    actionType: input.actionType,
    entityTypes: input.entityTypes,
    label: input.label,
    executeLegacy: input.run,
  };
}

const BLOCKED_SHOPIFY_ACTIONS = new Set(["update_product_price", "restock_product"]);

async function loadShopifyHandlers(): Promise<ExecutionActionHandler[]> {
  const [
    { executeCreateAutomaticDiscount },
    { executeCreateDiscountCode },
    { executeCreateBundle },
    { executeAddToCollection },
    { executePublishProduct, executeUnpublishProduct },
  ] = await Promise.all([
    import("@/lib/execution/shopify/create-automatic-discount"),
    import("@/lib/execution/shopify/create-discount-code"),
    import("@/lib/execution/shopify/create-bundle"),
    import("@/lib/execution/shopify/add-to-collection"),
    import("@/lib/execution/shopify/product-visibility"),
  ]);

  return [
    legacyHandler({
      id: "shopify:create_discount",
      actionType: "create_discount",
      entityTypes: ["product"],
      label: "Create Discount",
      run: executeCreateAutomaticDiscount,
    }),
    legacyHandler({
      id: "shopify:create_automatic_discount",
      actionType: "create_automatic_discount",
      entityTypes: ["product"],
      label: "Create Automatic Discount",
      run: executeCreateAutomaticDiscount,
    }),
    legacyHandler({
      id: "shopify:create_discount_code",
      actionType: "create_discount_code",
      entityTypes: ["product"],
      label: "Create Discount Code",
      run: executeCreateDiscountCode,
    }),
    legacyHandler({
      id: "shopify:create_bundle",
      actionType: "create_bundle",
      entityTypes: ["product"],
      label: "Create Bundle",
      run: executeCreateBundle,
    }),
    legacyHandler({
      id: "shopify:create_promotion",
      actionType: "create_promotion",
      entityTypes: ["product"],
      label: "Create Promotion",
      run: executeCreateBundle,
    }),
    legacyHandler({
      id: "shopify:add_to_collection",
      actionType: "add_to_collection",
      entityTypes: ["product"],
      label: "Add to Collection",
      run: executeAddToCollection,
    }),
    legacyHandler({
      id: "shopify:publish_product",
      actionType: "publish_product",
      entityTypes: ["product"],
      label: "Publish Product",
      run: executePublishProduct,
    }),
    legacyHandler({
      id: "shopify:unpublish_product",
      actionType: "unpublish_product",
      entityTypes: ["product"],
      label: "Unpublish Product",
      run: executeUnpublishProduct,
    }),
  ].filter((handler) => !BLOCKED_SHOPIFY_ACTIONS.has(handler.actionType));
}

let cachedHandlers: ExecutionActionHandler[] | null = null;

export async function getShopifyProvider(): Promise<ExecutionProvider> {
  if (!cachedHandlers) {
    cachedHandlers = await loadShopifyHandlers();
  }
  return {
    platform: "shopify",
    label: "Shopify",
    handlers: cachedHandlers,
  };
}

export function clearShopifyProviderCache(): void {
  cachedHandlers = null;
}
