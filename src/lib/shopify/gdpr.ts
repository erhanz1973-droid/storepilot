/**
 * Shopify mandatory compliance (GDPR) webhook handlers.
 *
 * Topics: customers/data_request, customers/redact, shop/redact
 * @see https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance
 */

import {
  findStoreByShopDomain,
  getCachedShopifySnapshot,
  getInstallationByShopDomain,
  purgeShopifyInstallationData,
  updateShopifySyncResult,
} from "@/lib/db/shopify";
import { deleteAuthSessionsForShop } from "@/lib/shopify/supabase-session-storage";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { StoreSnapshot } from "@/lib/connectors/types";

export type GdprCustomerRef = {
  id?: number | string | null;
  email?: string | null;
  phone?: string | null;
};

export type GdprDataRequestPayload = {
  shop_id: number;
  shop_domain: string;
  orders_requested?: number[];
  customer?: GdprCustomerRef;
  data_request?: { id: number };
};

export type GdprCustomersRedactPayload = {
  shop_id: number;
  shop_domain: string;
  customer?: GdprCustomerRef;
  orders_to_redact?: number[];
};

export type GdprShopRedactPayload = {
  shop_id: number;
  shop_domain: string;
};

export type GdprHandlerResult = {
  topic: string;
  shopDomain: string;
  action: string;
  details: Record<string, unknown>;
};

function normalizeEmail(email: string | null | undefined): string | null {
  const value = email?.trim().toLowerCase();
  return value ? value : null;
}

/** Mask email for logs/audit — never store raw PII in structured logs. */
function maskEmail(email: string | null | undefined): string | null {
  const value = normalizeEmail(email);
  if (!value) return null;
  const [local, domain] = value.split("@");
  if (!domain) return "***";
  const prefix = local.slice(0, 1) || "*";
  return `${prefix}***@${domain}`;
}

function customerIdMatches(
  storedId: string | number | null | undefined,
  requestedId: string | number | null | undefined,
): boolean {
  if (storedId == null || requestedId == null) return false;
  const a = String(storedId);
  const b = String(requestedId);
  if (a === b) return true;
  // Shopify Admin IDs vs GraphQL GIDs
  return a.endsWith(`/${b}`) || b.endsWith(`/${a}`) || a.includes(b) || b.includes(a);
}

function logGdpr(event: string, payload: Record<string, unknown>): void {
  console.log(
    "[shopify-gdpr]",
    JSON.stringify({
      event,
      at: new Date().toISOString(),
      ...payload,
    }),
  );
}

async function resolveStoreId(shopDomain: string): Promise<string | null> {
  const installation = await getInstallationByShopDomain(shopDomain);
  if (installation?.store_id) return installation.store_id;
  return findStoreByShopDomain(shopDomain);
}

function collectCustomerDataFromSnapshot(
  snapshot: Partial<StoreSnapshot> | null,
  customer: GdprCustomerRef | undefined,
  orderIds: number[] | undefined,
): {
  orders: Array<Record<string, unknown>>;
  emails: string[];
} {
  const orders: Array<Record<string, unknown>> = [];
  const emails = new Set<string>();
  const targetEmail = normalizeEmail(customer?.email ?? null);
  const commerceOrders = snapshot?.commerceOrders ?? [];

  for (const order of commerceOrders) {
    const orderEmail = normalizeEmail(order.customerEmail ?? null);
    const matchesCustomer =
      customerIdMatches(order.customerId, customer?.id) ||
      (targetEmail != null && orderEmail === targetEmail);

    const numericExternal = Number(
      String(order.externalId ?? order.id ?? "").replace(/\D/g, ""),
    );
    const matchesOrder =
      orderIds != null &&
      orderIds.length > 0 &&
      Number.isFinite(numericExternal) &&
      orderIds.includes(numericExternal);

    if (!matchesCustomer && !matchesOrder) continue;

    if (orderEmail) emails.add(orderEmail);
    orders.push({
      id: order.id,
      externalId: order.externalId,
      createdAt: order.createdAt,
      customerId: order.customerId ?? null,
      customerEmail: order.customerEmail ?? null,
      revenue: order.revenue,
    });
  }

  if (targetEmail) emails.add(targetEmail);

  return { orders, emails: [...emails] };
}

function redactCustomerFromSnapshot(
  snapshot: Partial<StoreSnapshot>,
  customer: GdprCustomerRef | undefined,
  orderIds: number[] | undefined,
): { snapshot: Partial<StoreSnapshot>; redactedOrderCount: number } {
  const targetEmail = normalizeEmail(customer?.email ?? null);
  const commerceOrders = snapshot.commerceOrders ?? [];
  let redactedOrderCount = 0;

  const nextOrders = commerceOrders.map((order) => {
    const orderEmail = normalizeEmail(order.customerEmail ?? null);
    const matchesCustomer =
      customerIdMatches(order.customerId, customer?.id) ||
      (targetEmail != null && orderEmail === targetEmail);

    const numericExternal = Number(
      String(order.externalId ?? order.id ?? "").replace(/\D/g, ""),
    );
    const matchesOrder =
      orderIds != null &&
      orderIds.length > 0 &&
      Number.isFinite(numericExternal) &&
      orderIds.includes(numericExternal);

    if (!matchesCustomer && !matchesOrder) return order;

    redactedOrderCount += 1;
    return {
      ...order,
      customerId: undefined,
      customerEmail: undefined,
    };
  });

  const nextCustomers = (snapshot.customerSnapshot?.customers ?? []).filter((c) => {
    const email = normalizeEmail(c.email);
    const keep =
      !customerIdMatches(c.id, customer?.id) &&
      !(targetEmail != null && email === targetEmail);
    return keep;
  });

  return {
    redactedOrderCount,
    snapshot: {
      ...snapshot,
      commerceOrders: nextOrders,
      customerSnapshot: snapshot.customerSnapshot
        ? {
            ...snapshot.customerSnapshot,
            customers: nextCustomers,
            totalCustomers: nextCustomers.length,
          }
        : snapshot.customerSnapshot,
    },
  };
}

/**
 * customers/data_request — gather any stored customer PII for the merchant to fulfill.
 * Shopify expects confirmation (200); data is provided to the store owner directly.
 */
export async function handleCustomersDataRequest(
  payload: GdprDataRequestPayload,
): Promise<GdprHandlerResult> {
  const shopDomain = payload.shop_domain;
  const storeId = await resolveStoreId(shopDomain);
  const snapshot = storeId ? await getCachedShopifySnapshot(storeId) : null;
  const collected = collectCustomerDataFromSnapshot(
    snapshot,
    payload.customer,
    payload.orders_requested,
  );

  // Audit/logs store counts + masked identifiers only — never raw emails or order PII.
  const result: GdprHandlerResult = {
    topic: "customers/data_request",
    shopDomain,
    action: "data_export_prepared",
    details: {
      shopId: payload.shop_id,
      dataRequestId: payload.data_request?.id ?? null,
      storeId,
      customerId: payload.customer?.id ?? null,
      customerEmailMasked: maskEmail(payload.customer?.email ?? null),
      orderCount: collected.orders.length,
      emailCount: collected.emails.length,
      orderIds: collected.orders.map((o) => o.id ?? o.externalId).filter(Boolean),
    },
  };

  logGdpr("customers_data_request", {
    shopDomain,
    shopId: payload.shop_id,
    dataRequestId: payload.data_request?.id ?? null,
    storeId,
    orderCount: collected.orders.length,
    emailCount: collected.emails.length,
  });

  await persistGdprAudit(result);
  return result;
}

/**
 * customers/redact — delete or anonymize stored customer personal data.
 * Idempotent: re-running on already-redacted data is a no-op success.
 */
export async function handleCustomersRedact(
  payload: GdprCustomersRedactPayload,
): Promise<GdprHandlerResult> {
  const shopDomain = payload.shop_domain;
  const storeId = await resolveStoreId(shopDomain);
  let redactedOrderCount = 0;

  if (storeId) {
    const snapshot = await getCachedShopifySnapshot(storeId);
    if (snapshot) {
      const { snapshot: next, redactedOrderCount: count } = redactCustomerFromSnapshot(
        snapshot,
        payload.customer,
        payload.orders_to_redact,
      );
      redactedOrderCount = count;
      if (count > 0) {
        const installation = await getInstallationByShopDomain(shopDomain);
        await updateShopifySyncResult(
          storeId,
          installation?.sync_stats ?? {
            productCount: 0,
            inventoryCount: 0,
            orderCount: next.commerceOrders?.length ?? 0,
            customerCount: next.customerSnapshot?.totalCustomers ?? 0,
            collectionCount: 0,
            discountCount: 0,
          },
          next,
        );
      }
    }
  }

  const result: GdprHandlerResult = {
    topic: "customers/redact",
    shopDomain,
    action: "customer_data_redacted",
    details: {
      shopId: payload.shop_id,
      storeId,
      customerId: payload.customer?.id ?? null,
      customerEmailMasked: maskEmail(payload.customer?.email ?? null),
      redactedOrderCount,
      ordersRequested: payload.orders_to_redact?.length ?? 0,
    },
  };

  logGdpr("customers_redact", {
    shopDomain,
    shopId: payload.shop_id,
    storeId,
    redactedOrderCount,
  });

  await persistGdprAudit(result);
  return result;
}

/**
 * shop/redact — 48h after uninstall; erase all shop data for this app.
 * Idempotent: purge is safe to repeat.
 */
export async function handleShopRedact(
  payload: GdprShopRedactPayload,
): Promise<GdprHandlerResult> {
  const shopDomain = payload.shop_domain;

  await deleteAuthSessionsForShop(shopDomain);
  const purged = await purgeShopifyInstallationData({ shopDomain });

  // Best-effort: remove store row keyed by shopify_domain if present.
  const supabase = getSupabaseAdmin();
  let storeDeleted = false;
  if (supabase) {
    const { error } = await supabase.from("stores").delete().eq("shopify_domain", shopDomain);
    storeDeleted = !error;
    if (error) {
      logGdpr("shop_redact_store_delete_skipped", {
        shopDomain,
        message: error.message,
      });
    }
  }

  const result: GdprHandlerResult = {
    topic: "shop/redact",
    shopDomain,
    action: "shop_data_purged",
    details: {
      shopId: payload.shop_id,
      purgedInstallations: purged.purged,
      storeDeleted,
    },
  };

  logGdpr("shop_redact", {
    shopDomain,
    shopId: payload.shop_id,
    purgedCount: purged.purged.length,
    storeDeleted,
  });

  await persistGdprAudit(result);
  return result;
}

async function persistGdprAudit(result: GdprHandlerResult): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  // Optional audit table — ignore if migration not applied yet.
  const { error } = await supabase.from("shopify_gdpr_requests").insert({
    topic: result.topic,
    shop_domain: result.shopDomain,
    action: result.action,
    details: result.details,
  } as Record<string, unknown>);

  if (error) {
    logGdpr("audit_persist_skipped", {
      shopDomain: result.shopDomain,
      topic: result.topic,
      message: error.message,
    });
  }
}
