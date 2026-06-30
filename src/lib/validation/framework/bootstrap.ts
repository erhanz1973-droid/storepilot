import { registerValidationProvider } from "./registry";
import { metaValidationProvider } from "@/lib/validation/providers/meta/adapter";
import { googleValidationProvider } from "@/lib/validation/providers/google/adapter";
import { shopifyValidationProvider } from "@/lib/validation/providers/shopify/adapter";
import { ga4ValidationProvider } from "@/lib/validation/providers/ga4/adapter";
import { aiValidationProvider } from "@/lib/validation/providers/ai/adapter";

let registered = false;

export function ensureValidationProvidersRegistered(): void {
  if (registered) return;
  registerValidationProvider(metaValidationProvider);
  registerValidationProvider(googleValidationProvider);
  registerValidationProvider(shopifyValidationProvider);
  registerValidationProvider(ga4ValidationProvider);
  registerValidationProvider(aiValidationProvider);
  registered = true;
}
