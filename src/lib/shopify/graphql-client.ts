import { SHOPIFY_API_VERSION } from "./oauth";

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

export async function shopifyGraphQL<T>(
  shop: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
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
): Promise<TResult> {
  let cursor: string | null = null;
  let hasNextPage = true;
  let result = initial;

  while (hasNextPage) {
    const data = await shopifyGraphQL<Record<string, unknown>>(shop, accessToken, query, {
      cursor,
    });
    const page = extract(data);
    result = merge(result, page.nodes);
    hasNextPage = page.hasNextPage;
    cursor = page.endCursor;
    if (!hasNextPage) break;
  }

  return result;
}
