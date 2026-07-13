import { cookies } from "next/headers";
import { getActiveShopifyInstallation, getInstallationForStore } from "@/lib/db/shopify";
import { getSimulationStoreById } from "@/lib/simulation-stores/db";
import { isSimulationStoreId } from "@/lib/simulation-lab/store-ids";
import { DEMO_STORE_ID } from "@/lib/types";
import {
  logEmbeddedBootstrap,
  readEmbeddedBootstrapDiagnostics,
} from "@/lib/store/embedded-context";

export const ACTIVE_STORE_COOKIE = "storepilot_active_store_id";

const ACTIVE_STORE_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 90,
};

/** Cookie options for embedded iframe context (third-party). */
export const EMBEDDED_ACTIVE_STORE_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "none" as const,
  secure: true,
  maxAge: 60 * 60 * 24 * 90,
};

export function activeStoreCookieValue(storeId: string) {
  return {
    name: ACTIVE_STORE_COOKIE,
    value: storeId,
    options: ACTIVE_STORE_COOKIE_OPTIONS,
  };
}

export function embeddedActiveStoreCookieValue(storeId: string) {
  return {
    name: ACTIVE_STORE_COOKIE,
    value: storeId,
    options: EMBEDDED_ACTIVE_STORE_COOKIE_OPTIONS,
  };
}

export type StoreResolutionDiagnostics = {
  chosenStoreId: string;
  source:
    | "embedded_installation"
    | "cookie_live"
    | "cookie_simulation"
    | "cookie_demo"
    | "active_installation"
    | "demo_fallback";
  embedded: Awaited<ReturnType<typeof readEmbeddedBootstrapDiagnostics>>;
  cookieValue: string | null;
};

function logStoreResolution(diagnostics: StoreResolutionDiagnostics): void {
  console.log("[store-bootstrap]", JSON.stringify(diagnostics));
}

export async function resolveActiveStoreId(): Promise<string> {
  const embedded = await readEmbeddedBootstrapDiagnostics();

  // Embedded Shopify Admin must win over a stale demo cookie from a prior direct visit.
  if (embedded.storeId) {
    const diagnostics: StoreResolutionDiagnostics = {
      chosenStoreId: embedded.storeId,
      source: "embedded_installation",
      embedded,
      cookieValue: (await cookies()).get(ACTIVE_STORE_COOKIE)?.value ?? null,
    };
    logStoreResolution(diagnostics);
    return embedded.storeId;
  }

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;

  if (fromCookie) {
    if (fromCookie === DEMO_STORE_ID) {
      logStoreResolution({
        chosenStoreId: DEMO_STORE_ID,
        source: "cookie_demo",
        embedded,
        cookieValue: fromCookie,
      });
      return DEMO_STORE_ID;
    }
    if (isSimulationStoreId(fromCookie)) {
      const sim = await getSimulationStoreById(fromCookie);
      if (sim) {
        logStoreResolution({
          chosenStoreId: fromCookie,
          source: "cookie_simulation",
          embedded,
          cookieValue: fromCookie,
        });
        return fromCookie;
      }
    }
    const installation = await getInstallationForStore(fromCookie);
    if (installation) {
      logStoreResolution({
        chosenStoreId: fromCookie,
        source: "cookie_live",
        embedded,
        cookieValue: fromCookie,
      });
      return fromCookie;
    }
  }

  const active = await getActiveShopifyInstallation();
  if (active) {
    logStoreResolution({
      chosenStoreId: active.store_id,
      source: "active_installation",
      embedded,
      cookieValue: fromCookie ?? null,
    });
    return active.store_id;
  }

  logEmbeddedBootstrap("falling back to demo", embedded);
  logStoreResolution({
    chosenStoreId: DEMO_STORE_ID,
    source: "demo_fallback",
    embedded,
    cookieValue: fromCookie ?? null,
  });
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
