import { cookies } from "next/headers";
import { getInstallationForStore } from "@/lib/db/shopify";
import { getSimulationStoreById } from "@/lib/simulation-stores/db";
import { isSimulationStoreId } from "@/lib/simulation-lab/store-ids";
import { DEMO_STORE_ID } from "@/lib/types";
import { allowDemoData } from "@/lib/env/runtime";
import {
  assertStoreMatchesVerifiedShop,
  readVerifiedTenantContext,
  resolveStoreIdFromVerifiedTenant,
  TenantIsolationError,
} from "@/lib/store/verified-tenant";

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
    | "verified_session"
    | "tenant_binding"
    | "service_binding"
    | "cookie_demo"
    | "cookie_simulation"
    | "demo_fallback"
    | "unresolved"
    | "tenant_mismatch";
  authenticatedShop: string | null;
  authFlag: string | null;
  cookieValue: string | null;
};

function logStoreResolution(diagnostics: StoreResolutionDiagnostics): void {
  console.log("[store-bootstrap]", JSON.stringify(diagnostics));
}

/**
 * Resolve the merchant workspace for this request.
 *
 * B1 — Tenant identity comes ONLY from:
 *   1) A current verified Shopify session token (middleware-stamped shop).
 *
 * A signed tenant binding may be checked for consistency, but never authorizes
 * a request by itself. Never resolve from ?shop=, host, or forwarded headers.
 */
export async function resolveActiveStoreId(): Promise<string> {
  const tenant = await readVerifiedTenantContext();
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(ACTIVE_STORE_COOKIE)?.value ?? null;

  try {
    const verified = await resolveStoreIdFromVerifiedTenant(tenant);
    if (verified) {
      // If an active-store cookie is also present, it must match — prevent cookie swap.
      if (fromCookie && fromCookie !== verified.storeId && fromCookie !== DEMO_STORE_ID) {
        if (!isSimulationStoreId(fromCookie)) {
          throw new TenantIsolationError(
            "Active store cookie does not match authenticated tenant",
          );
        }
      }

      logStoreResolution({
        chosenStoreId: verified.storeId,
        source:
          verified.source === "session"
            ? "verified_session"
            : verified.source === "service_binding"
              ? "service_binding"
              : "tenant_binding",
        authenticatedShop: tenant.authenticatedShop,
        authFlag: tenant.authFlag,
        cookieValue: fromCookie,
      });
      return verified.storeId;
    }
  } catch (error) {
    if (error instanceof TenantIsolationError) {
      logStoreResolution({
        chosenStoreId: "",
        source: "tenant_mismatch",
        authenticatedShop: tenant.authenticatedShop,
        authFlag: tenant.authFlag,
        cookieValue: fromCookie,
      });
      throw error;
    }
    throw error;
  }

  // Demo / simulation only when explicitly allowed — never a live merchant fallback.
  if (fromCookie && allowDemoData()) {
    if (fromCookie === DEMO_STORE_ID) {
      logStoreResolution({
        chosenStoreId: DEMO_STORE_ID,
        source: "cookie_demo",
        authenticatedShop: tenant.authenticatedShop,
        authFlag: tenant.authFlag,
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
          authenticatedShop: tenant.authenticatedShop,
          authFlag: tenant.authFlag,
          cookieValue: fromCookie,
        });
        return fromCookie;
      }
    }
  }

  if (allowDemoData()) {
    logStoreResolution({
      chosenStoreId: DEMO_STORE_ID,
      source: "demo_fallback",
      authenticatedShop: tenant.authenticatedShop,
      authFlag: tenant.authFlag,
      cookieValue: fromCookie,
    });
    return DEMO_STORE_ID;
  }

  logStoreResolution({
    chosenStoreId: "",
    source: "unresolved",
    authenticatedShop: tenant.authenticatedShop,
    authFlag: tenant.authFlag,
    cookieValue: fromCookie,
  });
  throw new UnresolvedStoreContextError();
}

/** Safe resolver for UI shells that should render a connect state instead of crashing. */
export async function tryResolveActiveStoreId(): Promise<string | null> {
  try {
    return await resolveActiveStoreId();
  } catch (error) {
    if (error instanceof UnresolvedStoreContextError) return null;
    if (error instanceof TenantIsolationError) return null;
    throw error;
  }
}

export async function hasLiveShopifyConnection(storeId?: string): Promise<boolean> {
  const id = storeId ?? (await tryResolveActiveStoreId());
  if (!id || id === DEMO_STORE_ID) return false;
  const installation = await getInstallationForStore(id);
  return installation !== null;
}

/**
 * Guard for handlers that accept an explicit storeId — must match verified tenant.
 */
export async function requireStoreAccess(storeId: string): Promise<void> {
  const tenant = await readVerifiedTenantContext();
  if (tenant.authenticatedShop) {
    await assertStoreMatchesVerifiedShop(storeId, tenant.authenticatedShop);
    return;
  }
  throw new UnresolvedStoreContextError();
}

export { TenantIsolationError };
