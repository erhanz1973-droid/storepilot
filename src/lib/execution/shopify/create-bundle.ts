import { discountWindow, resolveExecutionParams } from "@/lib/execution/params";
import type { ActionExecutionContext, ActionExecutionOutcome } from "@/lib/execution/types";
import { buildBundleConfigurationRequest } from "@/lib/shopify/mutations/bundle";
import { createAutomaticDiscountLive } from "@/lib/shopify/mutations/discount";
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

export async function executeCreateBundle(
  ctx: ActionExecutionContext,
): Promise<ActionExecutionOutcome> {
  const loaded = await loadShopifyExecution(ctx);
  if (!loaded.ok) return loaded.outcome;

  const { mode, installation, snapshot, params: rawParams } = loaded.data;
  const scopeError = await requireScopes(ctx, mode, installation, SHOPIFY_DISCOUNT_SCOPES);
  if (scopeError) return scopeError;

  const params = resolveExecutionParams({
    actionType: "create_bundle",
    entityId: ctx.entityId,
    entityName: ctx.entityName,
    params: rawParams,
    products: snapshot.products,
  });

  const primaryProductId = ensureShopifyGid("Product", ctx.entityId);
  const primaryProduct = resolveProductFromSnapshot(snapshot.products, ctx.entityId);
  const primaryProductName = ctx.entityName || primaryProduct?.title || ctx.entityId;

  if (!params.partnerProductId) {
    return failExecution(
      ctx,
      mode,
      ["Bundle requires a partner product. None was specified in the recommendation."],
      "Bundle validation failed.",
    );
  }

  const partnerProductId = ensureShopifyGid("Product", params.partnerProductId);
  const partnerProduct = resolveProductFromSnapshot(snapshot.products, params.partnerProductId);
  const partnerProductName =
    params.partnerProductName || partnerProduct?.title || params.partnerProductId;

  const { startsAt, endsAt } = discountWindow(params.durationDays ?? 30);
  const request = buildBundleConfigurationRequest({
    primaryProductId,
    primaryProductName,
    partnerProductId,
    partnerProductName,
    discountPercent: params.discountPercent ?? 10,
    startsAt,
    endsAt,
  });

  const requestRecord = request as unknown as Record<string, unknown>;

  if (isDryRun()) {
    return logReady(
      ctx,
      mode,
      requestRecord,
      dryRunMessage(`Bundle: ${primaryProductName} + ${partnerProductName}`),
    );
  }

  try {
    const result = await createAutomaticDiscountLive(
      installation.shop_domain,
      installation.accessToken,
      request.discountRequest,
    );
    await resyncShopifyStore(ctx.storeId);
    return logSuccess(
      ctx,
      mode,
      requestRecord,
      { discountId: result.id, bundleTitle: request.title } as Record<string, unknown>,
      `Bundle offer created — ${request.title} (${params.discountPercent ?? 10}% off both products).`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bundle creation failed";
    return logFailure(ctx, mode, requestRecord, message);
  }
}
