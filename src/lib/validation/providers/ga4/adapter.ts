import type { ValidationProviderAdapter } from "@/lib/validation/framework/provider";
import { createStubValidationProvider } from "@/lib/validation/providers/stub";

export const ga4ValidationProvider: ValidationProviderAdapter =
  createStubValidationProvider("ga4", "Google Analytics 4");
