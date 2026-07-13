import { aggregateStoreSnapshot } from "@/lib/connectors/registry";
import { getInstallationByStoreId, updateShopifySyncResult } from "@/lib/db/shopify";
import {
  auditDryRun,
  auditFailure,
  auditSuccess,
  dryRunMessage as buildDryRunMessage,
} from "@/lib/execution/audit";
import { getExecutionMode, isLiveExecutionEnabled } from "@/lib/execution/config";
import type { ExecutionParams } from "@/lib/execution/params";
import type {
  ActionExecutionContext,
  ActionExecutionOutcome,
  ExecutionLogStatus,
} from "@/lib/execution/types";
import { syncShopifyStore } from "@/lib/shopify/sync";
import { installationHasScopes } from "@/lib/shopify/validation";

export const SHOPIFY_DISCOUNT_SCOPES = ["write_discounts"];
export const SHOPIFY_PRODUCT_SCOPES = ["write_products"];

export type ShopifyExecutionLoadResult = {
  mode: ReturnType<typeof getExecutionMode>;
  installation: NonNullable<Awaited<ReturnType<typeof getInstallationByStoreId>>>;
  snapshot: Awaited<ReturnType<typeof aggregateStoreSnapshot>>;
  params: ExecutionParams;
};

export async function loadShopifyExecution(
  ctx: ActionExecutionContext,
): Promise<
  | { ok: true; data: ShopifyExecutionLoadResult }
  | { ok: false; outcome: ActionExecutionOutcome }
> {
  const mode = getExecutionMode();
  const installation = await getInstallationByStoreId(ctx.storeId);

  if (!installation) {
    return {
      ok: false,
      outcome: await failExecution(ctx, mode, ["Shopify is not connected."], "Shopify is not connected."),
    };
  }

  if (installation.connection_health === "error") {
    return {
      ok: false,
      outcome: await failExecution(
        ctx,
        mode,
        ["Shopify integration is in an error state."],
        "Shopify integration is in an error state.",
      ),
    };
  }

  const snapshot = await aggregateStoreSnapshot(ctx.storeId);
  const params = ctx.params ?? {};

  return {
    ok: true,
    data: { mode, installation, snapshot, params },
  };
}

export async function requireScopes(
  ctx: ActionExecutionContext,
  mode: ReturnType<typeof getExecutionMode>,
  installation: NonNullable<Awaited<ReturnType<typeof getInstallationByStoreId>>>,
  required: string[],
): Promise<ActionExecutionOutcome | null> {
  if (!installationHasScopes(installation, required)) {
    const missing = required.filter((s) => !installation.scopes.includes(s));
    return failExecution(
      ctx,
      mode,
      [`Missing Shopify scopes: ${missing.join(", ")}. Reconnect Shopify to grant write access.`],
      "Missing required Shopify permissions.",
    );
  }
  return null;
}

export async function logReady(
  ctx: ActionExecutionContext,
  mode: ReturnType<typeof getExecutionMode>,
  request: Record<string, unknown>,
  message: string,
): Promise<ActionExecutionOutcome> {
  return auditDryRun(ctx, request, message);
}

export async function logSuccess(
  ctx: ActionExecutionContext,
  mode: ReturnType<typeof getExecutionMode>,
  request: Record<string, unknown>,
  response: Record<string, unknown>,
  message: string,
): Promise<ActionExecutionOutcome> {
  return auditSuccess(ctx, request, response, message);
}

export async function logFailure(
  ctx: ActionExecutionContext,
  mode: ReturnType<typeof getExecutionMode>,
  request: Record<string, unknown> | { validationErrors: string[] },
  message: string,
): Promise<ActionExecutionOutcome> {
  return auditFailure(ctx, request, message);
}

export async function failExecution(
  ctx: ActionExecutionContext,
  mode: ReturnType<typeof getExecutionMode>,
  validationErrors: string[],
  message: string,
): Promise<ActionExecutionOutcome> {
  return logFailure(ctx, mode, { validationErrors }, validationErrors.join(" ") || message);
}

export async function resyncShopifyStore(storeId: string): Promise<void> {
  const installation = await getInstallationByStoreId(storeId);
  if (!installation) return;
  try {
    const result = await syncShopifyStore(installation.shop_domain, installation.accessToken, {
      storedClientId: installation.clientId,
    });
    await updateShopifySyncResult(installation.store_id, result.stats, result.snapshot, {
      shopName: result.shopName,
      shopifyPlan: result.shopifyPlan,
    });
  } catch {
    // Non-fatal after successful mutation
  }
}

export function dryRunMessage(actionLabel: string): string {
  return buildDryRunMessage("Shopify", actionLabel);
}

export function isDryRun(): boolean {
  return !isLiveExecutionEnabled();
}

export async function finalizeShopifyOutcome(
  ctx: ActionExecutionContext,
  mode: ReturnType<typeof getExecutionMode>,
  status: ExecutionLogStatus,
): Promise<void> {
  if (status === "success" && mode === "live") {
    await resyncShopifyStore(ctx.storeId);
  }
}
