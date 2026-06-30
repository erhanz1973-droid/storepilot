import type { ValidationProviderAdapter } from "@/lib/validation/framework/provider";
import { createStubValidationProvider } from "@/lib/validation/providers/stub";

export const shopifyValidationProvider: ValidationProviderAdapter =
  createStubValidationProvider("shopify", "Shopify");
