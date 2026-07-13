import { buildDemoExecutivePageData } from "@/lib/services/analytics";
import { logServerRenderError } from "@/lib/services/server-render-error";
import {
  readEmbeddedBootstrapDiagnostics,
  resolveEmbeddedShopDomain,
} from "@/lib/store/embedded-context";

/** Production-safe fallback when live executive data fails during embedded launch. */
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

  if (embedded.installationFound && embedded.storeId) {
    throw error;
  }

  if (!shop) {
    throw error;
  }

  return buildDemoExecutivePageData();
}
