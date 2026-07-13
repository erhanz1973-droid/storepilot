import { isShopifyReinstallRequiredError } from "@/lib/shopify/auth-errors";
import { markShopifyReinstallRequired } from "@/lib/db/shopify";

/** Persist reinstall-required state and rethrow so callers stop retrying GraphQL. */
export async function handleShopifyAuthFailure(
  shopDomain: string,
  error: unknown,
): Promise<never> {
  if (isShopifyReinstallRequiredError(error)) {
    await markShopifyReinstallRequired(shopDomain, error.reason);
  }
  throw error;
}
