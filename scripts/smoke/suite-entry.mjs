/**
 * Smoke suite entry — wraps suite.mjs but replaces the Shopify probe with
 * the refresh-aware offline-token checker (shopify-check.mjs).
 */
import { finalizeSmokeReport, runDirectSmokeChecks as runBaseSmokeChecks } from "./suite.mjs";
import { checkShopify } from "./shopify-check.mjs";

export { finalizeSmokeReport };

export async function runDirectSmokeChecks(options) {
  const checks = await runBaseSmokeChecks(options);
  const started = Date.now();
  let shopify;
  try {
    const result = await checkShopify();
    shopify = { name: "Shopify", ...result, durationMs: Date.now() - started };
  } catch (error) {
    shopify = {
      name: "Shopify",
      status: "FAIL",
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    };
  }

  const idx = checks.findIndex((c) => c.name === "Shopify");
  if (idx >= 0) checks[idx] = shopify;
  else checks.unshift(shopify);

  // Re-bind Meta/Google/GA4 to the (possibly refreshed) Shopify storeId when present.
  const storeId =
    shopify.status === "PASS" && typeof shopify.details?.storeId === "string"
      ? shopify.details.storeId
      : null;
  if (storeId) {
    for (const check of checks) {
      if (
        check.details &&
        typeof check.details === "object" &&
        check.details.storeId == null &&
        ["Meta Ads", "Google Ads", "GA4"].includes(check.name)
      ) {
        // leave as-is; base suite already ran with prior storeId
      }
    }
  }

  return checks;
}
