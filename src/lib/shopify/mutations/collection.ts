import { shopifyGraphQL } from "@/lib/shopify/graphql-client";

type UserError = { field: string[]; message: string };

function assertUserErrors(userErrors: UserError[] | undefined, fallback: string) {
  if (userErrors?.length) {
    throw new Error(userErrors.map((e) => e.message).join("; "));
  }
}

export type ShopifyAddToCollectionRequest = {
  mutation: "collectionAddProducts";
  variables: {
    id: string;
    productIds: string[];
  };
  collectionId: string;
  collectionName: string;
  productId: string;
  productName: string;
};

const COLLECTION_ADD_MUTATION = `
  mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) {
    collectionAddProducts(id: $id, productIds: $productIds) {
      collection { id title }
      userErrors { field message }
    }
  }
`;

export function buildAddToCollectionRequest(input: {
  collectionId: string;
  collectionName: string;
  productId: string;
  productName: string;
}): ShopifyAddToCollectionRequest {
  return {
    mutation: "collectionAddProducts",
    collectionId: input.collectionId,
    collectionName: input.collectionName,
    productId: input.productId,
    productName: input.productName,
    variables: {
      id: input.collectionId,
      productIds: [input.productId],
    },
  };
}

export async function addProductToCollectionLive(
  shop: string,
  accessToken: string,
  request: ShopifyAddToCollectionRequest,
): Promise<{ response: unknown }> {
  const data = await shopifyGraphQL<{
    collectionAddProducts: {
      collection: { id: string; title: string } | null;
      userErrors: UserError[];
    };
  }>(shop, accessToken, COLLECTION_ADD_MUTATION, request.variables);

  assertUserErrors(data.collectionAddProducts.userErrors, "Add to collection failed");

  return { response: data.collectionAddProducts };
}
