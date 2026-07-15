import { SHOPIFY_API_VERSION } from "./oauth";
import {
  ShopifyAccessTokenInvalidError,
  ShopifyMerchantReauthorizationRequiredError,
} from "./auth-errors";
import { markAccessTokenInvalidFromHttp } from "./installation-auth";
import {
  emptyShopifyRefreshMetrics,
  logShopifyRefreshMetrics,
  refreshOfflineAccessTokenAfter401,
  type ShopifyRefreshMetrics,
} from "./offline-token-refresh";
import {
  accessTokenFingerprint,
  detectAppMismatch,
  logShopifyTokenDiagnostics,
} from "./token-diagnostics";
import {
  type GraphQLErrorEntry,
  graphQLErrorSummary,
} from "./graphql-errors";

type GraphQLResponse<T> = {
  data?: T;
  errors?: GraphQLErrorEntry[];
};

export type ShopifyGraphQLContext = {
  shopDomain: string;
  storedClientId?: string | null;
  installationId?: string | null;
  /** Offline refresh token — enables one-shot recovery after HTTP 401. */
  refreshToken?: string | null;
  sessionType?: "online" | "offline";
  /** Called after a successful offline refresh so callers can reuse the new token. */
  onAccessTokenRefreshed?: (accessToken: string, refreshToken: string) => void;
  /** Optional shared metrics bag (smoke / sync can inspect). */
  refreshMetrics?: ShopifyRefreshMetrics;
};

export type ShopifyGraphQLResult<T> = {
  data?: T;
  errors: GraphQLErrorEntry[];
};

/**
 * attempt=1: initial request (refresh allowed on 401)
 * attempt=2: single retry after successful refresh (refresh NEVER attempted again)
 */
async function postShopifyGraphQL<T>(
  shop: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown> | undefined,
  context: ShopifyGraphQLContext | undefined,
  attempt: 1 | 2,
  metrics: ShopifyRefreshMetrics,
): Promise<GraphQLResponse<T>> {
  const endpoint = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const mismatch = detectAppMismatch(context?.storedClientId);
  const fingerprint = accessTokenFingerprint(accessToken);

  logShopifyTokenDiagnostics({
    shopDomain: shop,
    currentApiKeyPrefix: mismatch.currentClientIdPrefix,
    storedClientIdPrefix: mismatch.storedClientIdPrefix,
    tokenDecryptSucceeded: true,
    appMatch: mismatch.appMatch,
    reinstallRequired: mismatch.mismatch,
    installationId: context?.installationId ?? null,
    tokenFingerprint: fingerprint,
    sessionType: context?.sessionType ?? "offline",
    graphqlEndpoint: endpoint,
    httpStatus: null,
    reason:
      attempt === 2
        ? "graphql retry after offline token refresh (exactly once)"
        : mismatch.mismatch
          ? "blocked GraphQL — app mismatch"
          : "graphql request (pre-flight local diagnostics only — not Shopify API proof)",
  });

  if (mismatch.mismatch) {
    throw new ShopifyAccessTokenInvalidError(
      shop,
      401,
      `Access token belongs to Shopify app ${mismatch.storedClientIdPrefix}… but this deployment uses ${mismatch.currentClientIdPrefix}…. Reinstall the app from Shopify Admin.`,
    );
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    logShopifyTokenDiagnostics({
      shopDomain: shop,
      currentApiKeyPrefix: mismatch.currentClientIdPrefix,
      storedClientIdPrefix: mismatch.storedClientIdPrefix,
      tokenDecryptSucceeded: true,
      appMatch: mismatch.appMatch,
      reinstallRequired: false,
      installationId: context?.installationId ?? null,
      tokenFingerprint: fingerprint,
      sessionType: context?.sessionType ?? "offline",
      graphqlEndpoint: endpoint,
      httpStatus: response.status,
      reason: `Shopify GraphQL HTTP ${response.status}`,
    });

    // Attempt 2 = already retried once after successful refresh — never refresh again.
    if (response.status === 401 && attempt === 2) {
      metrics.retryFailed = true;
      metrics.retrySucceeded = false;
      logShopifyRefreshMetrics(shop, metrics, {
        merchantReauthorizationRequired: true,
        phase: "retry_failed",
      });
      throw markAccessTokenInvalidFromHttp(
        shop,
        401,
        body.trim()
          ? `Shopify rejected the access token on retry (HTTP 401): ${body.slice(0, 200)}`
          : "Shopify rejected the access token on retry (HTTP 401)",
      );
    }

    if (response.status === 401 && attempt === 1) {
      const recovery = await refreshOfflineAccessTokenAfter401({
        shopDomain: shop,
        installationId: context?.installationId,
        refreshToken: context?.refreshToken,
        tokenFingerprint: fingerprint,
        metrics,
      });

      // Refresh failed (missing / invalid_grant / expired) — return immediately, no GraphQL retry.
      if (recovery.status === "reauthorization_required") {
        throw new ShopifyMerchantReauthorizationRequiredError(
          shop,
          recovery.failureReason,
          recovery.detail,
        );
      }

      context?.onAccessTokenRefreshed?.(
        recovery.tokens.accessToken,
        recovery.tokens.refreshToken,
      );

      // Exactly one GraphQL retry after successful refresh. refreshToken cleared so
      // attempt=2 cannot enter the refresh branch again even if code changes.
      try {
        const retried = await postShopifyGraphQL<T>(
          shop,
          recovery.tokens.accessToken,
          query,
          variables,
          {
            ...context,
            shopDomain: context?.shopDomain ?? shop,
            refreshToken: undefined,
          },
          2,
          metrics,
        );
        metrics.retrySucceeded = true;
        metrics.retryFailed = false;
        logShopifyRefreshMetrics(shop, metrics, {
          merchantReauthorizationRequired: false,
          phase: "retry_succeeded",
        });
        return retried;
      } catch (retryError) {
        if (!(retryError instanceof ShopifyAccessTokenInvalidError)) {
          metrics.retryFailed = true;
          metrics.retrySucceeded = false;
          logShopifyRefreshMetrics(shop, metrics, {
            merchantReauthorizationRequired: true,
            phase: "retry_failed",
          });
        }
        throw retryError;
      }
    }

    throw new Error(`Shopify GraphQL HTTP ${response.status}`);
  }

  if (attempt === 2) {
    metrics.retrySucceeded = true;
    metrics.retryFailed = false;
  }

  logShopifyTokenDiagnostics({
    shopDomain: shop,
    currentApiKeyPrefix: mismatch.currentClientIdPrefix,
    storedClientIdPrefix: mismatch.storedClientIdPrefix,
    tokenDecryptSucceeded: true,
    appMatch: mismatch.appMatch,
    reinstallRequired: false,
    installationId: context?.installationId ?? null,
    tokenFingerprint: fingerprint,
    sessionType: context?.sessionType ?? "offline",
    graphqlEndpoint: endpoint,
    httpStatus: response.status,
    reason: attempt === 2 ? "graphql ok after offline token refresh" : "graphql ok",
  });

  return (await response.json()) as GraphQLResponse<T>;
}

async function fetchShopifyGraphQL<T>(
  shop: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
  context?: ShopifyGraphQLContext,
): Promise<GraphQLResponse<T>> {
  const metrics = context?.refreshMetrics ?? emptyShopifyRefreshMetrics();
  if (context) context.refreshMetrics = metrics;
  return postShopifyGraphQL<T>(shop, accessToken, query, variables, context, 1, metrics);
}

/** Returns data and errors without throwing — for optional resource probes. */
export async function shopifyGraphQLResult<T>(
  shop: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
  context?: ShopifyGraphQLContext,
): Promise<ShopifyGraphQLResult<T>> {
  const json = await fetchShopifyGraphQL<T>(shop, accessToken, query, variables, context);
  return {
    data: json.data,
    errors: json.errors ?? [],
  };
}

export async function shopifyGraphQL<T>(
  shop: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
  context?: ShopifyGraphQLContext,
): Promise<T> {
  const json = await fetchShopifyGraphQL<T>(shop, accessToken, query, variables, context);
  if (json.errors?.length) {
    throw new Error(graphQLErrorSummary(json.errors));
  }
  if (!json.data) {
    throw new Error("Shopify GraphQL returned no data");
  }

  return json.data;
}

export async function paginateGraphQL<TNode, TResult>(
  shop: string,
  accessToken: string | { accessToken: string },
  query: string,
  extract: (data: Record<string, unknown>) => {
    nodes: TNode[];
    hasNextPage: boolean;
    endCursor: string | null;
  },
  merge: (acc: TResult, nodes: TNode[]) => TResult,
  initial: TResult,
  context?: ShopifyGraphQLContext,
): Promise<TResult> {
  let cursor: string | null = null;
  let hasNextPage = true;
  let result = initial;
  const resolveToken = () =>
    typeof accessToken === "string" ? accessToken : accessToken.accessToken;

  while (hasNextPage) {
    const data = await shopifyGraphQL<Record<string, unknown>>(
      shop,
      resolveToken(),
      query,
      { cursor },
      context,
    );
    const page = extract(data);
    result = merge(result, page.nodes);
    hasNextPage = page.hasNextPage;
    cursor = page.endCursor;
    if (!hasNextPage) break;
  }

  return result;
}
