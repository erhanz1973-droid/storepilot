import { cookies } from "next/headers";
import { getActiveShopifyInstallation, getInstallationForStore } from "@/lib/db/shopify";
import { getSimulationStoreById } from "@/lib/simulation-stores/db";
import { isSimulationStoreId } from "@/lib/simulation-lab/store-ids";
import { DEMO_STORE_ID } from "@/lib/types";
import { resolveStoreIdForEmbeddedShop } from "@/lib/store/embedded-context";

export const ACTIVE_STORE_COOKIE = "storepilot_active_store_id";

const ACTIVE_STORE_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 90,
};

export function activeStoreCookieValue(storeId: string) {
  return {
    name: ACTIVE_STORE_COOKIE,
    value: storeId,
    options: ACTIVE_STORE_COOKIE_OPTIONS,
  };
}

export async function resolveActiveStoreId(): Promise<string> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;

  if (fromCookie) {
    if (fromCookie === DEMO_STORE_ID) return DEMO_STORE_ID;
    if (isSimulationStoreId(fromCookie)) {
      const sim = await getSimulationStoreById(fromCookie);
      if (sim) return fromCookie;
    }
    const installation = await getInstallationForStore(fromCookie);
    if (installation) return fromCookie;
  }

  const embeddedStoreId = await resolveStoreIdForEmbeddedShop();
  if (embeddedStoreId) return embeddedStoreId;

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
