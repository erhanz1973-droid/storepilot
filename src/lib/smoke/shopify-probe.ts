/**
 * Smoke-oriented helper that exercises the same offline refresh + single-retry
 * contract used by production GraphQL (exactly one retry after successful refresh).
 */
import { shopifyGraphQL, type ShopifyGraphQLContext } from "@/lib/shopify/graphql-client";
import {
  emptyShopifyRefreshMetrics,
  type ShopifyRefreshMetrics,
} from "@/lib/shopify/offline-token-refresh";
import {
  isShopifyReinstallRequiredError,
  ShopifyMerchantReauthorizationRequiredError,
} from "@/lib/shopify/auth-errors";

export type ShopifySmokeProbeInput = {
  shopDomain: string;
  accessToken: string;
  refreshToken?: string | null;
  installationId?: string | null;
  storedClientId?: string | null;
};

export type ShopifySmokeProbeResult = {
  status: "PASS" | "FAIL";
  message: string;
  merchantReauthorizationRequired: boolean;
  /** Access token that succeeded (may be refreshed). */
  accessToken: string | null;
  metrics: ShopifyRefreshMetrics;
  details: Record<string, unknown>;
};

/**
 * Probe products GraphQL once (with refresh recovery on 401).
 * Used by smoke suite + unit tests for the four token scenarios.
 */
export async function probeShopifyProducts(
  input: ShopifySmokeProbeInput,
): Promise<ShopifySmokeProbeResult> {
  const metrics = emptyShopifyRefreshMetrics();
  let workingToken = input.accessToken;
  const context: ShopifyGraphQLContext = {
    shopDomain: input.shopDomain,
    installationId: input.installationId,
    refreshToken: input.refreshToken,
    storedClientId: input.storedClientId,
    sessionType: "offline",
    refreshMetrics: metrics,
    onAccessTokenRefreshed: (accessToken) => {
      workingToken = accessToken;
    },
  };

  try {
    const data = await shopifyGraphQL<{
      products: { edges: { node: { id: string } }[] };
    }>(
      input.shopDomain,
      input.accessToken,
      `query { products(first: 5) { edges { node { id } } } }`,
      undefined,
      context,
    );

    const count = data.products?.edges?.length ?? 0;
    return {
      status: "PASS",
      message: `products=${count}`,
      merchantReauthorizationRequired: false,
      accessToken: workingToken,
      metrics,
      details: {
        shop: input.shopDomain,
        productsCount: count,
        merchantReauthorizationRequired: false,
        refreshAttempted: metrics.refreshAttempted,
        refreshSucceeded: metrics.refreshSucceeded,
        refreshFailed: metrics.refreshFailed,
        retrySucceeded: metrics.retrySucceeded,
        retryFailed: metrics.retryFailed,
      },
    };
  } catch (error) {
    const merchantReauthorizationRequired =
      error instanceof ShopifyMerchantReauthorizationRequiredError
        ? true
        : isShopifyReinstallRequiredError(error)
          ? error.merchantReauthorizationRequired
          : false;

    return {
      status: "FAIL",
      message: error instanceof Error ? error.message : String(error),
      merchantReauthorizationRequired,
      accessToken: null,
      metrics,
      details: {
        shop: input.shopDomain,
        merchantReauthorizationRequired,
        failureReason:
          error instanceof ShopifyMerchantReauthorizationRequiredError
            ? error.failureReason
            : null,
        refreshAttempted: metrics.refreshAttempted,
        refreshSucceeded: metrics.refreshSucceeded,
        refreshFailed: metrics.refreshFailed,
        retrySucceeded: metrics.retrySucceeded,
        retryFailed: metrics.retryFailed,
      },
    };
  }
}
