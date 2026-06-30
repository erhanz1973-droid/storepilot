import { discountWindow, resolveExecutionParams } from "@/lib/execution/params";
import type { ActionExecutionContext, ActionExecutionOutcome } from "@/lib/execution/types";
import {
  buildDiscountCodeRequest,
  createDiscountCodeLive,
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

export async function executeCreateDiscountCode(
  ctx: ActionExecutionContext,
): Promise<ActionExecutionOutcome> {
  const loaded = await loadShopifyExecution(ctx);
  if (!loaded.ok) return loaded.outcome;

  const { mode, installation, snapshot, params: rawParams } = loaded.data;
  const scopeError = await requireScopes(ctx, mode, installation, SHOPIFY_DISCOUNT_SCOPES);
  if (scopeError) return scopeError;

  const params = resolveExecutionParams({
    actionType: "create_discount_code",
    entityId: ctx.entityId,
    entityName: ctx.entityName,
    params: rawParams,
    products: snapshot.products,
  });

  const productId = ensureShopifyGid("Product", ctx.entityId);
  const localProduct = resolveProductFromSnapshot(snapshot.products, ctx.entityId);
  const productName = ctx.entityName || localProduct?.title || ctx.entityId;
  const discountCode = params.discountCode ?? "CLEAR20";

  if (!localProduct && snapshot.products.length > 0) {
    return failExecution(
      ctx,
      mode,
      [`Product ${ctx.entityId} was not found in synced store data.`],
      "Product validation failed.",
    );
  }

  const { startsAt, endsAt } = discountWindow(params.durationDays ?? 7);
  const request = buildDiscountCodeRequest({
    productId,
    productName,
    discountCode,
    discountPercent: params.discountPercent ?? 20,
    startsAt,
    endsAt,
  });

  const requestRecord = request as unknown as Record<string, unknown>;

  if (isDryRun()) {
    return logReady(
      ctx,
      mode,
      requestRecord,
      dryRunMessage(`Create Discount Code ${discountCode} (${params.discountPercent ?? 20}% off)`),
    );
  }

  try {
    const result = await createDiscountCodeLive(
      installation.shop_domain,
      installation.accessToken,
      request,
    );
    await resyncShopifyStore(ctx.storeId);
    return logSuccess(
      ctx,
      mode,
      requestRecord,
      { discountId: result.id, code: discountCode } as Record<string, unknown>,
      `Discount code "${discountCode}" created successfully — ${params.discountPercent ?? 20}% off selected products.`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Shopify discount code creation failed";
    return logFailure(ctx, mode, requestRecord, message);
  }
}
