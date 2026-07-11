import { buildDemoExecutivePageData } from "@/lib/services/analytics";
import { logServerRenderError } from "@/lib/services/server-render-error";
import { resolveEmbeddedShopDomain } from "@/lib/store/embedded-context";

/** Production-safe fallback when live executive data fails during embedded launch. */
export async function buildEmbeddedSafeExecutiveFallback(error: unknown) {
  logServerRenderError("buildExecutivePageData (embedded fallback)", error);
  const shop = await resolveEmbeddedShopDomain();
  console.error(
    "[embedded-startup] executive fallback",
    JSON.stringify({
      shop,
      message: error instanceof Error ? error.message : String(error),
    }),
  );
  if (!shop) {
    throw error;
  }
  return buildDemoExecutivePageData();
}
