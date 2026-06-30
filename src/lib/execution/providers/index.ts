import { clearHandlersForTests, registerProvider } from "@/lib/execution/registry";
import { googleAdsProvider } from "./google-ads";
import { metaProvider } from "./meta";
import { getShopifyProvider } from "./shopify";

let bootstrapped = false;

/** Register all execution provider adapters (idempotent). */
export async function bootstrapExecutionProviders(): Promise<void> {
  if (bootstrapped) return;
  registerProvider(metaProvider);
  registerProvider(googleAdsProvider);
  registerProvider(await getShopifyProvider());
  bootstrapped = true;
}

export function resetExecutionProvidersForTests(): void {
  bootstrapped = false;
  clearHandlersForTests();
}

export { metaProvider } from "./meta";
export { googleAdsProvider } from "./google-ads";
export { getShopifyProvider } from "./shopify";
export { metaPauseCampaignHandler } from "./meta/pause-campaign";
