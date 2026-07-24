import {
  buildEmptyMerchantExecutivePageData,
} from "@/lib/services/analytics";
import { logServerRenderError } from "@/lib/services/server-render-error";
import {
  readEmbeddedBootstrapDiagnostics,
  resolveEmbeddedShopDomain,
} from "@/lib/store/embedded-context";

/**
 * Production-safe fallback when live executive data fails during embedded launch.
 * Never returns Alpine/Peak demo metrics — reviewers must see the merchant shop or empty zeros.
 */
export async function buildEmbeddedSafeExecutiveFallback(error: unknown) {
  logServerRenderError("buildExecutivePageData (embedded fallback)", error);
  const embedded = await readEmbeddedBootstrapDiagnostics();
  const shop = embedded.shopDomain ?? (await resolveEmbeddedShopDomain());
  console.error(
    "[embedded-startup] executive fallback",
    JSON.stringify({
      shop,
      installationFound: embedded.installationFound,
      storeId: embedded.storeId,
      message: error instanceof Error ? error.message : String(error),
    }),
  );

  // Installation exists — surface the real error so we do not mask sync bugs with empty data.
  if (embedded.installationFound && embedded.storeId) {
    throw error;
  }

  return buildEmptyMerchantExecutivePageData(shop);
}
