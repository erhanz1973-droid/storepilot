import { shopifyGraphQL } from "@/lib/shopify/graphql-client";

type UserError = { field: string[]; message: string };

function assertUserErrors(userErrors: UserError[] | undefined, fallback: string) {
  if (userErrors?.length) {
    throw new Error(userErrors.map((e) => e.message).join("; "));
  }
}

export type ShopifyAutomaticDiscountRequest = {
  mutation: "discountAutomaticBasicCreate";
  variables: {
    automaticBasicDiscount: {
      title: string;
      startsAt: string;
      endsAt: string;
      combinesWith: {
        orderDiscounts: boolean;
        productDiscounts: boolean;
        shippingDiscounts: boolean;
      };
      customerGets: {
        value: { percentage: number };
        items: { products: { productsToAdd: string[] } };
      };
    };
  };
  productIds: string[];
  productName: string;
  discountPercent: number;
};

export type ShopifyDiscountCodeRequest = {
  mutation: "discountCodeBasicCreate";
  variables: {
    basicCodeDiscount: {
      title: string;
      code: string;
      startsAt: string;
      endsAt: string;
      customerSelection: { all: boolean };
      combinesWith: {
        orderDiscounts: boolean;
        productDiscounts: boolean;
        shippingDiscounts: boolean;
      };
      customerGets: {
        value: { percentage: number };
        items: { products: { productsToAdd: string[] } };
      };
    };
  };
  productId: string;
  productName: string;
  discountCode: string;
  discountPercent: number;
};

const AUTOMATIC_DISCOUNT_MUTATION = `
  mutation discountAutomaticBasicCreate($automaticBasicDiscount: DiscountAutomaticBasicInput!) {
    discountAutomaticBasicCreate(automaticBasicDiscount: $automaticBasicDiscount) {
      automaticDiscountNode {
        id
        automaticDiscount {
          ... on DiscountAutomaticBasic {
            title
            status
          }
        }
      }
      userErrors { field message }
    }
  }
`;

const DISCOUNT_CODE_MUTATION = `
  mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
      codeDiscountNode {
        id
        codeDiscount {
          ... on DiscountCodeBasic {
            title
            codes(first: 1) { nodes { code } }
          }
        }
      }
      userErrors { field message }
    }
  }
`;

export function buildAutomaticDiscountRequest(input: {
  productId?: string;
  productIds?: string[];
  productName: string;
  discountPercent: number;
  startsAt: string;
  endsAt: string;
}): ShopifyAutomaticDiscountRequest {
  const pct = input.discountPercent / 100;
  const productIds =
    input.productIds && input.productIds.length > 0
      ? input.productIds
      : input.productId
        ? [input.productId]
        : [];
  const title =
    productIds.length > 1
      ? `StorePilot — ${input.discountPercent}% clearance (${productIds.length} products)`
      : `StorePilot — ${input.discountPercent}% off ${input.productName}`;

  return {
    mutation: "discountAutomaticBasicCreate",
    productIds,
    productName: input.productName,
    discountPercent: input.discountPercent,
    variables: {
      automaticBasicDiscount: {
        title,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        combinesWith: {
          orderDiscounts: false,
          productDiscounts: false,
          shippingDiscounts: false,
        },
        customerGets: {
          value: { percentage: pct },
          items: { products: { productsToAdd: productIds } },
        },
      },
    },
  };
}

export function buildDiscountCodeRequest(input: {
  productId: string;
  productName: string;
  discountCode: string;
  discountPercent: number;
  startsAt: string;
  endsAt: string;
}): ShopifyDiscountCodeRequest {
  const pct = input.discountPercent / 100;
  return {
    mutation: "discountCodeBasicCreate",
    productId: input.productId,
    productName: input.productName,
    discountCode: input.discountCode,
    discountPercent: input.discountPercent,
    variables: {
      basicCodeDiscount: {
        title: `StorePilot — ${input.discountCode}`,
        code: input.discountCode,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        customerSelection: { all: true },
        combinesWith: {
          orderDiscounts: false,
          productDiscounts: false,
          shippingDiscounts: false,
        },
        customerGets: {
          value: { percentage: pct },
          items: { products: { productsToAdd: [input.productId] } },
        },
      },
    },
  };
}

export async function createAutomaticDiscountLive(
  shop: string,
  accessToken: string,
  request: ShopifyAutomaticDiscountRequest,
): Promise<{ id: string; response: unknown }> {
  const data = await shopifyGraphQL<{
    discountAutomaticBasicCreate: {
      automaticDiscountNode: { id: string } | null;
      userErrors: UserError[];
    };
  }>(shop, accessToken, AUTOMATIC_DISCOUNT_MUTATION, request.variables);

  assertUserErrors(
    data.discountAutomaticBasicCreate.userErrors,
    "Automatic discount creation failed",
  );

  const id = data.discountAutomaticBasicCreate.automaticDiscountNode?.id;
  if (!id) throw new Error("Automatic discount creation returned no ID");

  return { id, response: data.discountAutomaticBasicCreate };
}

export async function createDiscountCodeLive(
  shop: string,
  accessToken: string,
  request: ShopifyDiscountCodeRequest,
): Promise<{ id: string; response: unknown }> {
  const data = await shopifyGraphQL<{
    discountCodeBasicCreate: {
      codeDiscountNode: { id: string } | null;
      userErrors: UserError[];
    };
  }>(shop, accessToken, DISCOUNT_CODE_MUTATION, request.variables);

  assertUserErrors(data.discountCodeBasicCreate.userErrors, "Discount code creation failed");

  const id = data.discountCodeBasicCreate.codeDiscountNode?.id;
  if (!id) throw new Error("Discount code creation returned no ID");

  return { id, response: data.discountCodeBasicCreate };
}
