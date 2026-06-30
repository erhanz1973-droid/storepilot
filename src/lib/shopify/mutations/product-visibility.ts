import { shopifyGraphQL } from "@/lib/shopify/graphql-client";

type UserError = { field: string[]; message: string };

function assertUserErrors(userErrors: UserError[] | undefined, fallback: string) {
  if (userErrors?.length) {
    throw new Error(userErrors.map((e) => e.message).join("; "));
  }
}

export type ShopifyProductVisibilityRequest = {
  mutation: "productUpdate";
  variables: {
    input: {
      id: string;
      status: "ACTIVE" | "DRAFT";
    };
  };
  productId: string;
  productName: string;
  visibility: "publish" | "unpublish";
};

const PRODUCT_UPDATE_MUTATION = `
  mutation productUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product { id title status }
      userErrors { field message }
    }
  }
`;

const PRODUCT_QUERY = `
  query ProductStatus($id: ID!) {
    product(id: $id) {
      id
      title
      status
    }
  }
`;

export function buildProductVisibilityRequest(input: {
  productId: string;
  productName: string;
  visibility: "publish" | "unpublish";
}): ShopifyProductVisibilityRequest {
  return {
    mutation: "productUpdate",
    productId: input.productId,
    productName: input.productName,
    visibility: input.visibility,
    variables: {
      input: {
        id: input.productId,
        status: input.visibility === "publish" ? "ACTIVE" : "DRAFT",
      },
    },
  };
}

export async function fetchProductStatus(
  shop: string,
  accessToken: string,
  productId: string,
): Promise<{ id: string; title: string; status: string }> {
  const data = await shopifyGraphQL<{
    product: { id: string; title: string; status: string } | null;
  }>(shop, accessToken, PRODUCT_QUERY, { id: productId });

  if (!data.product) throw new Error(`Product ${productId} was not found in Shopify.`);
  return data.product;
}

export async function updateProductVisibilityLive(
  shop: string,
  accessToken: string,
  request: ShopifyProductVisibilityRequest,
): Promise<{ response: unknown }> {
  const data = await shopifyGraphQL<{
    productUpdate: {
      product: { id: string; title: string; status: string } | null;
      userErrors: UserError[];
    };
  }>(shop, accessToken, PRODUCT_UPDATE_MUTATION, request.variables);

  assertUserErrors(data.productUpdate.userErrors, "Product visibility update failed");

  return { response: data.productUpdate };
}
