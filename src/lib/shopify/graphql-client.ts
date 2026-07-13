import { SHOPIFY_API_VERSION } from "./oauth";
import { ShopifyAccessTokenInvalidError } from "./auth-errors";
import { markAccessTokenInvalidFromHttp } from "./installation-auth";
import { detectAppMismatch, logShopifyTokenDiagnostics } from "./token-diagnostics";

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

export type ShopifyGraphQLContext = {
  shopDomain: string;
  storedClientId?: string | null;
};

export async function shopifyGraphQL<T>(
  shop: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
  context?: ShopifyGraphQLContext,
): Promise<T> {
  const mismatch = detectAppMismatch(context?.storedClientId);
  logShopifyTokenDiagnostics({
    shopDomain: shop,
    currentApiKeyPrefix: mismatch.currentClientIdPrefix,
    storedClientIdPrefix: mismatch.storedClientIdPrefix,
    tokenDecryptSucceeded: true,
    appMatch: mismatch.appMatch,
    reinstallRequired: mismatch.mismatch,
    reason: mismatch.mismatch ? "blocked GraphQL — app mismatch" : "graphql request",
  });

  if (mismatch.mismatch) {
    throw new ShopifyAccessTokenInvalidError(
      shop,
      401,
      `Access token belongs to Shopify app ${mismatch.storedClientIdPrefix}… but this deployment uses ${mismatch.currentClientIdPrefix}…. Reinstall the app from Shopify Admin.`,
    );
  }

  const response = await fetch(
    `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401) {
      throw markAccessTokenInvalidFromHttp(
        shop,
        401,
        body.trim()
          ? `Shopify rejected the access token (HTTP 401): ${body.slice(0, 200)}`
          : undefined,
      );
    }
    throw new Error(`Shopify GraphQL HTTP ${response.status}`);
  }

  const json = (await response.json()) as GraphQLResponse<T>;
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  if (!json.data) {
    throw new Error("Shopify GraphQL returned no data");
  }

  return json.data;
}

export async function paginateGraphQL<TNode, TResult>(
  shop: string,
  accessToken: string,
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

  while (hasNextPage) {
    const data = await shopifyGraphQL<Record<string, unknown>>(
      shop,
      accessToken,
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
