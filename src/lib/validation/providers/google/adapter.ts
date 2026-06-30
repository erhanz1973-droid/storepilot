import type { ValidationProviderAdapter } from "@/lib/validation/framework/provider";
import { createStubValidationProvider } from "@/lib/validation/providers/stub";

export const googleValidationProvider: ValidationProviderAdapter =
  createStubValidationProvider("google", "Google Ads");
