import type { ActionExecutionContext, ActionExecutionOutcome } from "@/lib/execution/types";
import {
  buildProductVisibilityRequest,
  fetchProductStatus,
  updateProductVisibilityLive,
} from "@/lib/shopify/mutations/product-visibility";
import {
  ensureShopifyGid,
  resolveProductFromSnapshot,
} from "@/lib/shopify/validation";
import {
  dryRunMessage,
  failExecution,
  isDryRun,
  loadShopifyExecution,
  logReady,
  logSuccess,
  logFailure,
  requireScopes,
  resyncShopifyStore,
  SHOPIFY_PRODUCT_SCOPES,
} from "./helpers";

export async function executeProductVisibility(
  ctx: ActionExecutionContext,
  visibility: "publish" | "unpublish",
): Promise<ActionExecutionOutcome> {
  const loaded = await loadShopifyExecution(ctx);
  if (!loaded.ok) return loaded.outcome;

  const { mode, installation, snapshot } = loaded.data;
  const scopeError = await requireScopes(ctx, mode, installation, SHOPIFY_PRODUCT_SCOPES);
  if (scopeError) return scopeError;

  const productId = ensureShopifyGid("Product", ctx.entityId);
  const localProduct = resolveProductFromSnapshot(snapshot.products, ctx.entityId);
  const productName = ctx.entityName || localProduct?.title || ctx.entityId;
  const targetStatus = visibility === "publish" ? "ACTIVE" : "DRAFT";
  const actionLabel = visibility === "publish" ? "Publish product" : "Unpublish product";

  try {
    const remote = await fetchProductStatus(
      installation.shop_domain,
      installation.accessToken,
      productId,
    );
    if (remote.status === targetStatus) {
      return failExecution(
        ctx,
        mode,
        [`Product is already ${visibility === "publish" ? "published" : "unpublished"}.`],
        `Product is already ${visibility === "publish" ? "published" : "unpublished"}.`,
      );
    }
  } catch (err) {
    if (!localProduct) {
      const message = err instanceof Error ? err.message : "Unable to verify product with Shopify.";
      return failExecution(ctx, mode, [message], "Product validation failed.");
    }
  }

  const request = buildProductVisibilityRequest({
    productId,
    productName,
    visibility,
  });

  const requestRecord = request as unknown as Record<string, unknown>;

  if (isDryRun()) {
    return logReady(ctx, mode, requestRecord, dryRunMessage(actionLabel));
  }

  try {
    const result = await updateProductVisibilityLive(
      installation.shop_domain,
      installation.accessToken,
      request,
    );
    await resyncShopifyStore(ctx.storeId);
    return logSuccess(
      ctx,
      mode,
      requestRecord,
      (result.response as Record<string, unknown>) ?? {},
      visibility === "publish"
        ? `${productName} was published successfully.`
        : `${productName} was unpublished successfully.`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Product visibility update failed";
    return logFailure(ctx, mode, requestRecord, message);
  }
}

export async function executePublishProduct(
  ctx: ActionExecutionContext,
): Promise<ActionExecutionOutcome> {
  return executeProductVisibility(ctx, "publish");
}

export async function executeUnpublishProduct(
  ctx: ActionExecutionContext,
): Promise<ActionExecutionOutcome> {
  return executeProductVisibility(ctx, "unpublish");
}
