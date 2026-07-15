import { cookies } from "next/headers";
import { hasAlphaEvent } from "@/lib/analytics/alpha-funnel";
import { hasLiveShopifyConnection, resolveActiveStoreId } from "@/lib/store/context";
import { isSimulationStoreId } from "@/lib/simulation-lab/store-ids";
import { DEMO_STORE_ID } from "@/lib/types";

export const FIRST_RUN_DONE_COOKIE = "storepilot_first_run_done";

export async function isFirstRunComplete(storeId?: string): Promise<boolean> {
  const id = storeId ?? (await resolveActiveStoreId());
  const cookieStore = await cookies();
  if (cookieStore.get(FIRST_RUN_DONE_COOKIE)?.value === id) return true;
  if (cookieStore.get(FIRST_RUN_DONE_COOKIE)?.value === "1") return true;
  return hasAlphaEvent(id, "first_run_completed");
}

/**
 * Soft-gate: live Shopify stores that have not finished first-run
 * should land on /first-run instead of the Executive dashboard.
 */
export async function shouldRedirectToFirstRun(): Promise<boolean> {
  const storeId = await resolveActiveStoreId();
  if (storeId === DEMO_STORE_ID || isSimulationStoreId(storeId)) return false;
  const live = await hasLiveShopifyConnection(storeId);
  if (!live) return false;
  return !(await isFirstRunComplete(storeId));
}
