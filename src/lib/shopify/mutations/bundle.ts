import type { ShopifyAutomaticDiscountRequest } from "./discount";
import { buildAutomaticDiscountRequest } from "./discount";

export type ShopifyBundleRequest = {
  type: "bundle_configuration";
  title: string;
  productIds: string[];
  productNames: string[];
  discountPercent: number;
  startsAt: string;
  endsAt: string;
  /** When live, StorePilot creates a reversible automatic discount on bundle SKUs */
  discountRequest: ShopifyAutomaticDiscountRequest;
  note: string;
};

export function buildBundleConfigurationRequest(input: {
  primaryProductId: string;
  primaryProductName: string;
  partnerProductId: string;
  partnerProductName: string;
  discountPercent: number;
  startsAt: string;
  endsAt: string;
}): ShopifyBundleRequest {
  const title = `Bundle: ${input.primaryProductName} + ${input.partnerProductName}`;
  const discountRequest = buildAutomaticDiscountRequest({
    productId: input.primaryProductId,
    productName: title,
    discountPercent: input.discountPercent,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  });

  discountRequest.variables.automaticBasicDiscount.title = `StorePilot — ${title}`;
  discountRequest.variables.automaticBasicDiscount.customerGets.items.products.productsToAdd = [
    input.primaryProductId,
    input.partnerProductId,
  ];

  return {
    type: "bundle_configuration",
    title,
    productIds: [input.primaryProductId, input.partnerProductId],
    productNames: [input.primaryProductName, input.partnerProductName],
    discountPercent: input.discountPercent,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    discountRequest,
    note:
      "Bundle apps may be required for true bundle SKUs. StorePilot applies a reversible automatic discount on both products.",
  };
}
