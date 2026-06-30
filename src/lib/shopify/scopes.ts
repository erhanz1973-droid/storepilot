import type { FutureActionType } from "@/lib/insights/actions";
import { getActionCapability } from "@/lib/insights/actions";

/** Scopes needed for StorePilot Shopify one-click actions */
export const SHOPIFY_WRITE_SCOPES = ["write_products", "write_discounts"] as const;

export function missingShopifyScopes(
  grantedScopes: string[] | undefined,
  requiredScopes: string[],
): string[] {
  const granted = new Set(grantedScopes ?? []);
  return requiredScopes.filter((scope) => !granted.has(scope));
}

export function missingScopesForShopifyAction(
  grantedScopes: string[] | undefined,
  actionType?: FutureActionType,
): string[] {
  if (!actionType) return [];
  const cap = getActionCapability(actionType);
  if (!cap || !cap.platforms.includes("shopify")) return [];
  return missingShopifyScopes(grantedScopes, cap.requiredScopes);
}

export function shopifyInstallationMissingWriteScopes(grantedScopes: string[] | undefined): string[] {
  return missingShopifyScopes(grantedScopes, [...SHOPIFY_WRITE_SCOPES]);
}

export function buildShopifyScopeBlockerMessage(missing: string[]): string {
  if (missing.length === 0) return "";
  return `Missing Shopify scopes: ${missing.join(", ")}. Reconnect Shopify to grant write access.`;
}

export function buildShopifyReconnectUrl(shopDomain: string): string {
  return `/api/shopify/auth?shop=${encodeURIComponent(shopDomain)}`;
}
