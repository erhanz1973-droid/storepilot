import { cookies } from "next/headers";
import { getInstallationForStore } from "@/lib/db/shopify";
import { getSimulationStoreById } from "@/lib/simulation-stores/db";
import { isSimulationStoreId } from "@/lib/simulation-lab/store-ids";
import { DEMO_STORE_ID } from "@/lib/types";
import { allowDemoData } from "@/lib/env/runtime";
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

export class UnresolvedStoreContextError extends Error {
  constructor(message = "No authenticated Shopify merchant in context") {
    super(message);
    this.name = "UnresolvedStoreContextError";
  }
}

export type StoreResolutionDiagnostics = {
  chosenStoreId: string;
  source:
    | "embedded_installation"
    | "cookie_live"
    | "cookie_simulation"
    | "cookie_demo"
    | "demo_fallback"
    | "unresolved";
  embedded: Awaited<ReturnType<typeof readEmbeddedBootstrapDiagnostics>>;
  cookieValue: string | null;
};

function logStoreResolution(diagnostics: StoreResolutionDiagnostics): void {
  console.log("[store-bootstrap]", JSON.stringify(diagnostics));
}

/**
 * Resolve the merchant workspace for this request.
 * OAuth / embedded shop is the source of truth — never a hardcoded demo store
 * unless Demo Mode is explicitly enabled for local development.
 */
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
      if (allowDemoData()) {
        logStoreResolution({
          chosenStoreId: DEMO_STORE_ID,
          source: "cookie_demo",
          embedded,
          cookieValue: fromCookie,
        });
        return DEMO_STORE_ID;
      }
      // Stale demo cookie from a prior visit — ignore in production / review.
    } else if (isSimulationStoreId(fromCookie)) {
      if (allowDemoData()) {
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
    } else {
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
  }

  // Never select another tenant's installation. Unresolved = connect Shopify, not demo.
  if (allowDemoData()) {
    logEmbeddedBootstrap("dev synthetic store context", embedded);
    logStoreResolution({
      chosenStoreId: DEMO_STORE_ID,
      source: "demo_fallback",
      embedded,
      cookieValue: fromCookie ?? null,
    });
    return DEMO_STORE_ID;
  }

  logEmbeddedBootstrap("unresolved store context", embedded);
  logStoreResolution({
    chosenStoreId: "",
    source: "unresolved",
    embedded,
    cookieValue: fromCookie ?? null,
  });
  throw new UnresolvedStoreContextError();
}

/** Safe resolver for UI shells that should render a connect state instead of crashing. */
export async function tryResolveActiveStoreId(): Promise<string | null> {
  try {
    return await resolveActiveStoreId();
  } catch (error) {
    if (error instanceof UnresolvedStoreContextError) return null;
    throw error;
  }
}

export async function hasLiveShopifyConnection(storeId?: string): Promise<boolean> {
  const id = storeId ?? (await tryResolveActiveStoreId());
  if (!id || id === DEMO_STORE_ID) return false;
  const installation = await getInstallationForStore(id);
  return installation !== null;
}
