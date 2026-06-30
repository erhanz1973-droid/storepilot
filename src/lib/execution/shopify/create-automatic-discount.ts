import { discountWindow, resolveExecutionParams } from "@/lib/execution/params";
import type { ActionExecutionContext, ActionExecutionOutcome } from "@/lib/execution/types";
import {
  buildAutomaticDiscountRequest,
  createAutomaticDiscountLive,
} from "@/lib/shopify/mutations/discount";
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
  SHOPIFY_DISCOUNT_SCOPES,
} from "./helpers";

export async function executeCreateAutomaticDiscount(
  ctx: ActionExecutionContext,
): Promise<ActionExecutionOutcome> {
  const loaded = await loadShopifyExecution(ctx);
  if (!loaded.ok) return loaded.outcome;

  const { mode, installation, snapshot, params: rawParams } = loaded.data;
  const scopeError = await requireScopes(ctx, mode, installation, SHOPIFY_DISCOUNT_SCOPES);
  if (scopeError) return scopeError;

  const params = resolveExecutionParams({
    actionType: ctx.actionType,
    entityId: ctx.entityId,
    entityName: ctx.entityName,
    params: rawParams,
    products: snapshot.products,
    collections: snapshot.collections,
  });

  const productIds = (params.productIds ?? [ctx.entityId]).map((id) =>
    ensureShopifyGid("Product", id),
  );
  const localProducts = productIds.map((id) =>
    resolveProductFromSnapshot(snapshot.products, id),
  );
  const missing = productIds.filter((id, i) => snapshot.products.length > 0 && !localProducts[i]);
  const productName =
    productIds.length > 1
      ? `${productIds.length} products`
      : ctx.entityName || localProducts[0]?.title || ctx.entityId;

  if (missing.length > 0 && snapshot.products.length > 0) {
    return failExecution(
      ctx,
      mode,
      missing.map((id) => `Product ${id} was not found in synced store data.`),
      "Product validation failed.",
    );
  }

  const { startsAt, endsAt } = discountWindow(params.durationDays ?? 14);
  const request = buildAutomaticDiscountRequest({
    productIds,
    productName,
    discountPercent: params.discountPercent ?? 15,
    startsAt,
    endsAt,
  });

  const requestRecord = request as unknown as Record<string, unknown>;

  if (isDryRun()) {
    const dryLabel =
      productIds.length > 1
        ? `Create Automatic Discount (${params.discountPercent ?? 15}% off ${productIds.length} products)`
        : `Create Automatic Discount (${params.discountPercent ?? 15}% off ${productName})`;
    return logReady(ctx, mode, requestRecord, dryRunMessage(dryLabel));
  }

  try {
    const result = await createAutomaticDiscountLive(
      installation.shop_domain,
      installation.accessToken,
      request,
    );
    await resyncShopifyStore(ctx.storeId);
    const successLabel =
      productIds.length > 1
        ? `Automatic discount created — ${params.discountPercent ?? 15}% off ${productIds.length} products.`
        : `Automatic discount created successfully — ${params.discountPercent ?? 15}% off ${productName}.`;
    return logSuccess(
      ctx,
      mode,
      requestRecord,
      { discountId: result.id, ...((result.response as object) ?? {}) } as Record<string, unknown>,
      successLabel,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Shopify discount creation failed";
    return logFailure(ctx, mode, requestRecord, message);
  }
}
