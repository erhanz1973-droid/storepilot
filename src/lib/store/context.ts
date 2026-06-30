import { cookies } from "next/headers";
import { getActiveShopifyInstallation, getInstallationForStore } from "@/lib/db/shopify";
import { getSimulationStoreById } from "@/lib/simulation-stores/db";
import { isSimulationStoreId } from "@/lib/simulation-lab/store-ids";
import { DEMO_STORE_ID } from "@/lib/types";

export const ACTIVE_STORE_COOKIE = "storepilot_active_store_id";

export async function resolveActiveStoreId(): Promise<string> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;

  if (fromCookie) {
    if (isSimulationStoreId(fromCookie)) {
      const sim = await getSimulationStoreById(fromCookie);
      if (sim) return fromCookie;
    }
    const installation = await getInstallationForStore(fromCookie);
    if (installation) return fromCookie;
  }

  const active = await getActiveShopifyInstallation();
  if (active) return active.store_id;

  return DEMO_STORE_ID;
}

export async function hasLiveShopifyConnection(storeId?: string): Promise<boolean> {
  const id = storeId ?? (await resolveActiveStoreId());
  if (id === DEMO_STORE_ID) {
    const active = await getActiveShopifyInstallation();
    return active !== null;
  }
  const installation = await getInstallationForStore(id);
  return installation !== null;
}
