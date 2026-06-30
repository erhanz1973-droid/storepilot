import { resolveExecutionParams } from "@/lib/execution/params";
import type { ActionExecutionContext, ActionExecutionOutcome } from "@/lib/execution/types";
import { buildAddToCollectionRequest, addProductToCollectionLive } from "@/lib/shopify/mutations/collection";
import {
  ensureShopifyGid,
  findCollectionByName,
  resolveCollectionFromSnapshot,
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

export async function executeAddToCollection(
  ctx: ActionExecutionContext,
): Promise<ActionExecutionOutcome> {
  const loaded = await loadShopifyExecution(ctx);
  if (!loaded.ok) return loaded.outcome;

  const { mode, installation, snapshot, params: rawParams } = loaded.data;
  const scopeError = await requireScopes(ctx, mode, installation, SHOPIFY_PRODUCT_SCOPES);
  if (scopeError) return scopeError;

  const params = resolveExecutionParams({
    actionType: "add_to_collection",
    entityId: ctx.entityId,
    entityName: ctx.entityName,
    params: rawParams,
    products: snapshot.products,
    collections: snapshot.collections,
  });

  const productId = ensureShopifyGid("Product", ctx.entityId);
  const localProduct = resolveProductFromSnapshot(snapshot.products, ctx.entityId);
  const productName = ctx.entityName || localProduct?.title || ctx.entityId;

  let collectionId = params.collectionId;
  let collectionName = params.collectionName ?? "Clearance";

  if (collectionId) {
    collectionId = ensureShopifyGid("Collection", collectionId);
    const collection = resolveCollectionFromSnapshot(snapshot.collections, collectionId);
    collectionName = collection?.title ?? collectionName;
  } else {
    const collection = findCollectionByName(snapshot.collections, collectionName);
    if (!collection) {
      return failExecution(
        ctx,
        mode,
        [
          `Collection "${collectionName}" was not found. Create it in Shopify or specify collectionId.`,
        ],
        "Collection validation failed.",
      );
    }
    collectionId = collection.id;
    collectionName = collection.title;
  }

  if (localProduct?.collectionIds.includes(collectionId)) {
    return failExecution(
      ctx,
      mode,
      [`${productName} is already in ${collectionName}.`],
      "Product is already in the target collection.",
    );
  }

  const request = buildAddToCollectionRequest({
    collectionId,
    collectionName,
    productId,
    productName,
  });

  const requestRecord = request as unknown as Record<string, unknown>;

  if (isDryRun()) {
    return logReady(
      ctx,
      mode,
      requestRecord,
      dryRunMessage(`Add ${productName} to ${collectionName}`),
    );
  }

  try {
    const result = await addProductToCollectionLive(
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
      `${productName} was added to ${collectionName}.`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Add to collection failed";
    return logFailure(ctx, mode, requestRecord, message);
  }
}
