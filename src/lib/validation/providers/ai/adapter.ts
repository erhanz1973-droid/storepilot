import type { ValidationProviderAdapter } from "@/lib/validation/framework/provider";
import { createStubValidationProvider } from "@/lib/validation/providers/stub";

export const aiValidationProvider: ValidationProviderAdapter =
  createStubValidationProvider("ai", "AI Recommendation Engine");
