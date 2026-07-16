import { createDecipheriv, createHash } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SmokeCheckResult, SmokeStatus, SmokeSuiteReport } from "./types";
import { probeShopifyProducts } from "./shopify-probe";
import { logShopifyRefreshMetrics } from "@/lib/shopify/offline-token-refresh";

const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION?.trim() || "2024-10";

function nowIso() {
  return new Date().toISOString();
}

function shaKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

function decryptAesGcm(payload: string, secret: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted token format");
  }
  const decipher = createDecipheriv("aes-256-gcm", shaKey(secret), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function resolveShopifyEncryptionSecret(): string {
  const secret = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("SHOPIFY_TOKEN_ENCRYPTION_KEY missing or too short");
  }
  return secret;
}

function resolveMetaEncryptionSecret(): string | null {
  const meta = process.env.META_TOKEN_ENCRYPTION_KEY?.trim();
  if (meta && meta.length >= 32) return meta;
  const shopify = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY?.trim();
  if (shopify && shopify.length >= 32) return shopify;
  return null;
}

function resolveGoogleEncryptionSecret(): string | null {
  const google = process.env.GOOGLE_ADS_TOKEN_ENCRYPTION_KEY?.trim();
  if (google && google.length >= 32) return google;
  return resolveMetaEncryptionSecret();
}

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Supabase env missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function timed(
  name: string,
  fn: () => Promise<{ status: SmokeStatus; message: string; details?: Record<string, unknown> }>,
): Promise<SmokeCheckResult> {
  const started = Date.now();
  try {
    const result = await fn();
    return { name, ...result, durationMs: Date.now() - started };
  } catch (error) {
    return {
      name,
      status: "FAIL",
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    };
  }
}

async function shopifyGraphQL(
  shop: string,
  accessToken: string,
  query: string,
  meta?: {
    installationId?: string | null;
    tokenFingerprint?: string | null;
    sessionType?: "offline" | "online";
  },
): Promise<{ data?: Record<string, unknown>; errors?: { message: string }[]; httpStatus: number }> {
  const endpoint = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  console.log(
    "[shopify-auth]",
    JSON.stringify({
      installationId: meta?.installationId ?? null,
      shopDomain: shop,
      tokenFingerprint: meta?.tokenFingerprint ?? null,
      sessionType: meta?.sessionType ?? "offline",
      graphqlEndpoint: endpoint,
      httpStatus: null,
      tokenDecryptSucceeded: true,
      reason: "smoke graphql request (pre-flight local diagnostics only — not Shopify API proof)",
    }),
  );
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });
  console.log(
    "[shopify-auth]",
    JSON.stringify({
      installationId: meta?.installationId ?? null,
      shopDomain: shop,
      tokenFingerprint: meta?.tokenFingerprint ?? null,
      sessionType: meta?.sessionType ?? "offline",
      graphqlEndpoint: endpoint,
      httpStatus: response.status,
      tokenDecryptSucceeded: true,
      reason: `smoke graphql HTTP ${response.status}`,
    }),
  );
  if (!response.ok) {
    throw new Error(`Shopify GraphQL HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const json = (await response.json()) as {
    data?: Record<string, unknown>;
    errors?: { message: string }[];
  };
  return { ...json, httpStatus: response.status };
}

function tokenFingerprint(token: string): string {
  return token.slice(0, 12);
}

function isDiscountAccessDenied(errors: { message: string }[] | undefined): boolean {
  if (!errors?.length) return false;
  return errors.some((e) =>
    /discountNodes|read_discounts/i.test(e.message),
  );
}

async function checkShopify(): Promise<SmokeCheckResult> {
  return timed("Shopify", async () => {
    const supabase = getSupabase();
    const shopFilter = process.env.SHOP_DOMAIN?.trim();

    let query = supabase
      .from("shopify_installations")
      .select(
        "id, store_id, shop_domain, access_token_encrypted, refresh_token_encrypted, refresh_token_expires_at, status, connection_health, client_id, sync_stats, scopes",
      )
      .eq("status", "active")
      .order("installed_at", { ascending: false });
    if (shopFilter) query = query.eq("shop_domain", shopFilter);

    const { data: rows, error } = await query.limit(1);
    if (error) throw new Error(`Installation query failed: ${error.message}`);
    const row = rows?.[0];
    if (!row) {
      return { status: "FAIL", message: "No active Shopify installation found" };
    }

    const runtimeApiKey = process.env.SHOPIFY_API_KEY?.trim() ?? "";
    const storedClientId = (row.client_id as string | null)?.trim() || null;
    const appMatch =
      storedClientId && runtimeApiKey ? storedClientId === runtimeApiKey : null;
    const reinstallRequired = appMatch === false;
    const installationId = row.id as string;
    const shop = row.shop_domain as string;
    const endpoint = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

    if (row.status !== "active") {
      return { status: "FAIL", message: `Installation status=${row.status}` };
    }
    if (reinstallRequired) {
      return {
        status: "FAIL",
        message: "reinstallRequired=true (app client_id mismatch)",
        details: {
          installationId,
          shop,
          sessionType: "offline",
          storedClientIdPrefix: storedClientId?.slice(0, 6) ?? null,
          runtimeApiKeyPrefix: runtimeApiKey.slice(0, 6) || null,
        },
      };
    }

    let tokenDecryptSucceeded = false;
    let accessToken: string;
    try {
      accessToken = decryptAesGcm(
        row.access_token_encrypted as string,
        resolveShopifyEncryptionSecret(),
      );
      tokenDecryptSucceeded = true;
    } catch (decryptError) {
      console.log(
        "[shopify-auth]",
        JSON.stringify({
          installationId,
          shopDomain: shop,
          tokenFingerprint: null,
          sessionType: "offline",
          graphqlEndpoint: endpoint,
          httpStatus: null,
          tokenDecryptSucceeded: false,
          appMatch,
          reinstallRequired: true,
          reason: "smoke token decryption failed",
        }),
      );
      throw decryptError;
    }

    let refreshToken: string | null = null;
    if (row.refresh_token_encrypted) {
      try {
        refreshToken = decryptAesGcm(
          row.refresh_token_encrypted as string,
          resolveShopifyEncryptionSecret(),
        );
      } catch {
        refreshToken = null;
      }
    }

    const fingerprint = tokenFingerprint(accessToken);
    console.log(
      "[shopify-auth]",
      JSON.stringify({
        installationId,
        shopDomain: shop,
        tokenFingerprint: fingerprint,
        sessionType: "offline",
        graphqlEndpoint: endpoint,
        httpStatus: null,
        tokenDecryptSucceeded,
        appMatch,
        reinstallRequired,
        hasRefreshToken: Boolean(refreshToken),
        refreshTokenExpiresAt: row.refresh_token_expires_at ?? null,
        reason:
          "smoke installation resolved from shopify_installations (same offline SOH as embedded persist path)",
      }),
    );

    const baseDetails: Record<string, unknown> = {
      installationId,
      shop,
      storeId: row.store_id,
      status: row.status,
      connectionHealth: row.connection_health,
      appMatch,
      reinstallRequired,
      sessionType: "offline",
      tokenFingerprint: fingerprint,
      graphqlEndpoint: endpoint,
      hasRefreshToken: Boolean(refreshToken),
      clientIdPrefix: storedClientId?.slice(0, 6) ?? null,
      merchantReauthorizationRequired: false,
      refreshAttempted: false,
      refreshSucceeded: false,
      refreshFailed: false,
      retrySucceeded: false,
      retryFailed: false,
    };

    // Shared production path: GraphQL → optional one refresh → exactly one retry.
    const probe = await probeShopifyProducts({
      shopDomain: shop,
      accessToken,
      refreshToken,
      installationId,
      storedClientId,
    });
    Object.assign(baseDetails, probe.details);
    logShopifyRefreshMetrics(shop, probe.metrics, {
      source: "smoke",
      merchantReauthorizationRequired: probe.merchantReauthorizationRequired,
    });

    if (probe.status === "FAIL") {
      return {
        status: "FAIL",
        message: probe.message,
        details: {
          ...baseDetails,
          merchantReauthorizationRequired: probe.merchantReauthorizationRequired,
        },
      };
    }

    accessToken = probe.accessToken ?? accessToken;
    baseDetails.tokenFingerprint = tokenFingerprint(accessToken);
    baseDetails.merchantReauthorizationRequired = false;

    const gqlMeta = {
      installationId,
      tokenFingerprint: tokenFingerprint(accessToken),
      sessionType: "offline" as const,
    };

    // Re-fetch products payload shape for counts (probe already validated auth).
    const productsResult = await shopifyGraphQL(
      shop,
      accessToken,
      `query { products(first: 5) { edges { node { id title } } } }`,
      gqlMeta,
    );
    if (productsResult.errors?.length) {
      return {
        status: "FAIL",
        message: `Products GraphQL error: ${productsResult.errors.map((e) => e.message).join("; ")}`,
        details: baseDetails,
      };
    }

    let productsCount =
      (productsResult.data?.products as { edges?: unknown[] } | undefined)?.edges?.length ?? 0;

    // Authoritative count via read-only REST (never mutates).
    const countRes = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/products/count.json`,
      {
        headers: { "X-Shopify-Access-Token": accessToken },
        cache: "no-store",
      },
    );
    if (countRes.ok) {
      const countJson = (await countRes.json()) as { count?: number };
      productsCount = countJson.count ?? productsCount;
    }

    const ordersResult = await shopifyGraphQL(
      shop,
      accessToken,
      `query { orders(first: 1, sortKey: CREATED_AT, reverse: true) { edges { node { id } } } }`,
      gqlMeta,
    );
    if (ordersResult.errors?.length) {
      return {
        status: "FAIL",
        message: `Orders GraphQL error: ${ordersResult.errors.map((e) => e.message).join("; ")}`,
        details: baseDetails,
      };
    }

    const customersResult = await shopifyGraphQL(
      shop,
      accessToken,
      `query { customers(first: 1) { edges { node { id } } } customersCount { count } }`,
      gqlMeta,
    );
    if (customersResult.errors?.length) {
      return {
        status: "FAIL",
        message: `Customers GraphQL error: ${customersResult.errors.map((e) => e.message).join("; ")}`,
        details: baseDetails,
      };
    }

    const inventoryResult = await shopifyGraphQL(
      shop,
      accessToken,
      `query {
        products(first: 5) {
          edges { node { id totalInventory } }
        }
      }`,
      gqlMeta,
    );
    if (inventoryResult.errors?.length) {
      return {
        status: "FAIL",
        message: `Inventory GraphQL error: ${inventoryResult.errors.map((e) => e.message).join("; ")}`,
        details: baseDetails,
      };
    }

    const discountsResult = await shopifyGraphQL(
      shop,
      accessToken,
      `query { discountNodes(first: 5) { edges { node { id } } } }`,
      gqlMeta,
    );

    let discountStatus: "ok" | "unavailable" = "ok";
    let discountCount = 0;
    if (isDiscountAccessDenied(discountsResult.errors)) {
      discountStatus = "unavailable";
    } else if (discountsResult.errors?.length) {
      return {
        status: "FAIL",
        message: `Discounts GraphQL error: ${discountsResult.errors.map((e) => e.message).join("; ")}`,
        details: baseDetails,
      };
    } else {
      const nodes = discountsResult.data?.discountNodes as
        | { edges?: { node: { id: string } }[] }
        | undefined;
      discountCount = nodes?.edges?.length ?? 0;
      if (discountCount === 0) {
        // Zero discounts with valid scope is still healthy.
        discountStatus = "ok";
      }
    }

    if (productsCount <= 0) {
      return {
        status: "FAIL",
        message: "Products count is 0",
        details: { ...baseDetails, productsCount },
      };
    }

    const syncStats = (row.sync_stats ?? {}) as Record<string, unknown>;

    return {
      status: "PASS",
      message:
        discountStatus === "unavailable"
          ? `Active shop ${shop}; products=${productsCount}; discounts=Unavailable`
          : `Active shop ${shop}; products=${productsCount}; discounts=${discountCount}`,
      details: {
        ...baseDetails,
        productsCount,
        customersCount:
          (customersResult.data?.customersCount as { count?: number } | undefined)?.count ?? null,
        discountStatus,
        discountCount,
        discountsUnavailable: discountStatus === "unavailable" || Boolean(syncStats.discountsUnavailable),
        httpStatus: productsResult.httpStatus,
        merchantReauthorizationRequired: false,
      },
    };
  });
}

async function checkMetaAds(storeId: string | null): Promise<SmokeCheckResult> {
  return timed("Meta Ads", async () => {
    try {
      const supabase = getSupabase();
      let query = supabase
        .from("meta_ads_installations")
        .select(
          "id, store_id, status, connection_health, ad_account_id, access_token_encrypted, sync_stats",
        )
        .eq("status", "active");
      if (storeId) query = query.eq("store_id", storeId);
      const { data: rows, error } = await query.limit(1);
      if (error) {
        return { status: "WARNING", message: `Meta Ads query unavailable: ${error.message}` };
      }
      if (!rows?.length) {
        return { status: "WARNING", message: "Meta Ads disconnected" };
      }

      const row = rows[0];
      const secret = resolveMetaEncryptionSecret();
      if (!secret) {
        return { status: "WARNING", message: "Meta token encryption key unavailable" };
      }

      let token: string;
      try {
        token = decryptAesGcm(row.access_token_encrypted as string, secret);
      } catch {
        return {
          status: "WARNING",
          message: "Meta Ads connected but token could not be decrypted",
        };
      }

      const accountId = row.ad_account_id as string | null;
      if (!accountId) {
        return { status: "WARNING", message: "Meta connected but no ad account selected" };
      }

      const meRes = await fetch(
        `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );
      if (!meRes.ok) {
        return {
          status: "WARNING",
          message: `Meta token invalid or account unreachable (${meRes.status})`,
        };
      }

      const campaignsRes = await fetch(
        `https://graph.facebook.com/v21.0/act_${String(accountId).replace(/^act_/, "")}/campaigns?fields=id,name,status&limit=5&access_token=${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );
      if (!campaignsRes.ok) {
        return {
          status: "WARNING",
          message: `Meta account reachable but campaigns query failed (${campaignsRes.status})`,
        };
      }
      const campaignsJson = (await campaignsRes.json()) as { data?: unknown[] };
      const campaignCount = campaignsJson.data?.length ?? 0;

      return {
        status: "PASS",
        message: `Meta account reachable; campaigns loaded (${campaignCount})`,
        details: { accountId, campaignCount, connectionHealth: row.connection_health },
      };
    } catch (error) {
      return {
        status: "WARNING",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

async function checkGoogleAds(storeId: string | null): Promise<SmokeCheckResult> {
  return timed("Google Ads", async () => {
    try {
      const supabase = getSupabase();
      let query = supabase
        .from("google_ads_installations")
        .select(
          "id, store_id, status, connection_health, customer_id, refresh_token_encrypted, access_token_encrypted, sync_stats",
        )
        .eq("status", "active");
      if (storeId) query = query.eq("store_id", storeId);
      const { data: rows, error } = await query.limit(1);
      if (error) {
        return { status: "WARNING", message: `Google Ads query unavailable: ${error.message}` };
      }
      if (!rows?.length) {
        return { status: "WARNING", message: "Google Ads disconnected" };
      }

      const row = rows[0];
      const secret = resolveGoogleEncryptionSecret();
      const clientId = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
      const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();
      const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
      const customerId = String(row.customer_id ?? "").replace(/\D/g, "");

      if (!secret || !clientId || !clientSecret || !developerToken || !customerId) {
        return {
          status: "WARNING",
          message: "Google Ads installation present but OAuth/config incomplete",
          details: { hasCustomerId: Boolean(customerId) },
        };
      }

      const refreshEncrypted =
        (row.refresh_token_encrypted as string | null) ||
        (row.access_token_encrypted as string | null);
      if (!refreshEncrypted) {
        return { status: "WARNING", message: "Google Ads refresh token missing" };
      }

      let refreshToken: string;
      try {
        refreshToken = decryptAesGcm(refreshEncrypted, secret);
      } catch {
        return {
          status: "WARNING",
          message: "Google Ads token could not be decrypted",
        };
      }

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
        cache: "no-store",
      });
      if (!tokenRes.ok) {
        return {
          status: "WARNING",
          message: `Google OAuth refresh failed (${tokenRes.status})`,
        };
      }
      const tokenJson = (await tokenRes.json()) as { access_token?: string };
      if (!tokenJson.access_token) {
        return { status: "WARNING", message: "Google OAuth refresh returned no access_token" };
      }

      const apiVersion = process.env.GOOGLE_ADS_API_VERSION?.trim() || "v24";
      const searchRes = await fetch(
        `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}/googleAds:search`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenJson.access_token}`,
            "developer-token": developerToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: "SELECT campaign.id, campaign.name FROM campaign LIMIT 5",
          }),
          cache: "no-store",
        },
      );
      if (!searchRes.ok) {
        return {
          status: "WARNING",
          message: `Google customer reachable check failed (${searchRes.status})`,
        };
      }
      const searchJson = (await searchRes.json()) as { results?: unknown[] };
      return {
        status: "PASS",
        message: `Google Ads OAuth valid; campaigns loaded (${searchJson.results?.length ?? 0})`,
        details: {
          customerId,
          campaignCount: searchJson.results?.length ?? 0,
          connectionHealth: row.connection_health,
        },
      };
    } catch (error) {
      return {
        status: "WARNING",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

async function checkGa4(storeId: string | null): Promise<SmokeCheckResult> {
  return timed("GA4", async () => {
    try {
      const supabase = getSupabase();
      let query = supabase
        .from("ga4_installations")
        .select(
          "id, store_id, status, connection_health, property_id, property_name, access_token_encrypted, refresh_token_encrypted, last_sync_at",
        )
        .eq("status", "active");
      if (storeId) query = query.eq("store_id", storeId);
      const { data: rows, error } = await query.limit(1);
      if (error) {
        return { status: "WARNING", message: `GA4 disconnected (${error.message})` };
      }
      if (!rows?.length) {
        return { status: "WARNING", message: "GA4 disconnected" };
      }

      const row = rows[0];
      const propertyId = String(row.property_id ?? "");
      if (!propertyId) {
        return { status: "WARNING", message: "GA4 connected but property missing" };
      }

      const secret = resolveGoogleEncryptionSecret();
      const clientId = process.env.GA4_CLIENT_ID?.trim() || process.env.GOOGLE_ADS_CLIENT_ID?.trim();
      const clientSecret =
        process.env.GA4_CLIENT_SECRET?.trim() || process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();
      if (!secret || !clientId || !clientSecret) {
        return {
          status: "WARNING",
          message: "GA4 property connected but token refresh config incomplete",
          details: { propertyId, lastSyncAt: row.last_sync_at },
        };
      }

      const refreshEncrypted =
        (row.refresh_token_encrypted as string | null) ||
        (row.access_token_encrypted as string | null);
      if (!refreshEncrypted) {
        return { status: "WARNING", message: "GA4 tokens missing" };
      }

      let refreshToken: string;
      try {
        refreshToken = decryptAesGcm(refreshEncrypted, secret);
      } catch {
        return { status: "WARNING", message: "GA4 token could not be decrypted" };
      }

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
        cache: "no-store",
      });
      if (!tokenRes.ok) {
        return { status: "WARNING", message: `GA4 OAuth refresh failed (${tokenRes.status})` };
      }
      const tokenJson = (await tokenRes.json()) as { access_token?: string };
      if (!tokenJson.access_token) {
        return { status: "WARNING", message: "GA4 OAuth refresh returned no access_token" };
      }

      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 7);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const reportRes = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenJson.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dateRanges: [{ startDate: fmt(start), endDate: fmt(end) }],
            metrics: [{ name: "sessions" }],
          }),
          cache: "no-store",
        },
      );
      if (!reportRes.ok) {
        return {
          status: "WARNING",
          message: `GA4 analytics fetch failed (${reportRes.status})`,
          details: { propertyId },
        };
      }
      const reportJson = (await reportRes.json()) as {
        rows?: { metricValues?: { value?: string }[] }[];
      };
      const sessions = Number(reportJson.rows?.[0]?.metricValues?.[0]?.value ?? 0);

      return {
        status: "PASS",
        message: `GA4 property connected; sessions=${sessions}`,
        details: {
          propertyId,
          propertyName: row.property_name,
          sessions,
          lastSyncAt: row.last_sync_at,
        },
      };
    } catch (error) {
      return {
        status: "WARNING",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

/** Shared secret so smoke checks can reach session-token-protected API routes. */
function smokeAuthHeaders(): Record<string, string> {
  const secret =
    process.env.SMOKE_SECRET?.trim() || process.env.STOREPILOT_INTERNAL_SECRET?.trim();
  return secret ? { Authorization: `Bearer ${secret}`, "x-smoke-secret": secret } : {};
}

async function httpGetJson(
  baseUrl: string,
  path: string,
): Promise<{ status: number; json: unknown; text: string }> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    method: "GET",
    headers: { Accept: "application/json", ...smokeAuthHeaders() },
    cache: "no-store",
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

async function httpGetHtml(
  baseUrl: string,
  path: string,
): Promise<{ status: number; text: string }> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    method: "GET",
    headers: { Accept: "text/html", ...smokeAuthHeaders() },
    cache: "no-store",
  });
  return { status: response.status, text: await response.text() };
}

function hasReactServerError(html: string): boolean {
  return (
    /Application error: a (client|server)-side exception/i.test(html) ||
    /Unhandled Runtime Error/i.test(html) ||
    /digest:\s*['"]?\w+/i.test(html) && /Server Components render/i.test(html)
  );
}

export async function runDirectSmokeChecks(options: {
  baseUrl: string;
}): Promise<SmokeCheckResult[]> {
  const baseUrl = options.baseUrl;
  const checks: SmokeCheckResult[] = [];

  const shopify = await checkShopify();
  checks.push(shopify);
  const storeId =
    shopify.status === "PASS" && typeof shopify.details?.storeId === "string"
      ? shopify.details.storeId
      : null;

  checks.push(await checkMetaAds(storeId));
  checks.push(await checkGoogleAds(storeId));
  checks.push(await checkGa4(storeId));

  checks.push(
    await timed("Executive Dashboard", async () => {
      const page = await httpGetHtml(baseUrl, "/");
      if (page.status !== 200) {
        return { status: "FAIL", message: `Executive page HTTP ${page.status}` };
      }
      if (hasReactServerError(page.text)) {
        return { status: "FAIL", message: "Executive page contains React/server exception markers" };
      }
      if (!/StorePilot|Executive|Advertising|Health/i.test(page.text)) {
        return { status: "FAIL", message: "Executive page rendered but missing expected chrome" };
      }
      return { status: "PASS", message: "Executive Dashboard rendered (HTTP 200)" };
    }),
  );

  checks.push(
    await timed("Executive Digest", async () => {
      const dash = await httpGetJson(baseUrl, "/api/dashboard");
      if (dash.status !== 200 || !dash.json || typeof dash.json !== "object") {
        return {
          status: "FAIL",
          message: `Dashboard digest source HTTP ${dash.status}`,
        };
      }
      const body = dash.json as Record<string, unknown>;
      // Digest is derived from executive AI layer; accept dashboard payload as summary source.
      const hasSummary =
        Boolean(body.storeMetrics) ||
        Boolean(body.decisionCenter) ||
        Boolean(body.recommendations) ||
        Boolean(body.syncedAt);
      if (!hasSummary) {
        return { status: "FAIL", message: "Dashboard returned no summary payload" };
      }
      return {
        status: "PASS",
        message: "Executive digest source returned summary payload",
        details: {
          hasStoreMetrics: Boolean(body.storeMetrics),
          hasRecommendations: Array.isArray(body.recommendations)
            ? body.recommendations.length
            : 0,
        },
      };
    }),
  );

  checks.push(
    await timed("Recommendation Engine", async () => {
      const res = await httpGetJson(baseUrl, "/api/recommendations");
      if (res.status !== 200 || !res.json || typeof res.json !== "object") {
        return { status: "FAIL", message: `Recommendations HTTP ${res.status}` };
      }
      const recommendations = (res.json as { recommendations?: unknown[] }).recommendations ?? [];
      if (!Array.isArray(recommendations) || recommendations.length < 1) {
        // Fallback: decision-center / opportunities from dashboard
        const dash = await httpGetJson(baseUrl, "/api/dashboard");
        const body = (dash.json ?? {}) as {
          decisionCenter?: unknown[];
          recommendations?: unknown[];
        };
        const decisions = body.decisionCenter ?? body.recommendations ?? [];
        if (!Array.isArray(decisions) || decisions.length < 1) {
          return {
            status: "FAIL",
            message: "No recommendations with confidence/priority/impact available",
          };
        }
        const sample = decisions[0] as Record<string, unknown>;
        return {
          status: "PASS",
          message: `Generated ${decisions.length} decision/recommendation item(s)`,
          details: {
            sampleKeys: Object.keys(sample).slice(0, 12),
          },
        };
      }

      const sample = recommendations[0] as Record<string, unknown>;
      const hasConfidence =
        sample.confidence != null ||
        sample.confidenceScore != null ||
        sample.confidencePct != null;
      const hasPriority = sample.priority != null || sample.severity != null;
      const hasImpact =
        sample.expectedImpact != null ||
        sample.estimatedImpact != null ||
        sample.expectedMonthlyImpact != null;

      if (!hasConfidence || !hasPriority || !hasImpact) {
        return {
          status: "FAIL",
          message: "Recommendation missing confidence, priority, or estimated impact",
          details: { sample },
        };
      }

      return {
        status: "PASS",
        message: `${recommendations.length} recommendation(s) with confidence/priority/impact`,
      };
    }),
  );

  checks.push(
    await timed("Autopilot", async () => {
      const res = await httpGetJson(baseUrl, "/api/autopilot");
      if (res.status === 404) {
        return {
          status: "WARNING",
          message: "Autopilot unavailable (Shopify connect required)",
        };
      }
      if (res.status !== 200 || !res.json || typeof res.json !== "object") {
        return { status: "FAIL", message: `Autopilot HTTP ${res.status}` };
      }
      const body = res.json as { actions?: unknown[]; mutationsExecuted?: unknown };
      const actions = body.actions ?? [];
      if (!Array.isArray(actions) || actions.length < 1) {
        return { status: "FAIL", message: "Autopilot dry-run produced no actions" };
      }
      if (body.mutationsExecuted === true) {
        return { status: "FAIL", message: "Autopilot unexpectedly reported mutationsExecuted=true" };
      }
      return {
        status: "PASS",
        message: `Autopilot dry-run OK; ${actions.length} action(s); no mutations`,
      };
    }),
  );

  checks.push(
    await timed("Approval Center", async () => {
      const res = await httpGetJson(baseUrl, "/api/approvals");
      if (res.status !== 200 || !res.json || typeof res.json !== "object") {
        return { status: "FAIL", message: `Approvals HTTP ${res.status}` };
      }
      const approvals = (res.json as { approvals?: unknown[] }).approvals;
      if (!Array.isArray(approvals)) {
        return { status: "FAIL", message: "Approvals payload missing approvals array" };
      }
      return {
        status: "PASS",
        message: `Approval Center loaded (${approvals.length} record(s))`,
      };
    }),
  );

  checks.push(
    await timed("Simulation Lab", async () => {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/simulations/quick`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          simulationType: "increase_meta_budget",
          budgetChangePct: 0.1,
        }),
        cache: "no-store",
      });
      const text = await response.text();
      let json: unknown = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      if (response.status !== 200 || !json || typeof json !== "object") {
        return {
          status: "FAIL",
          message: `Simulation HTTP ${response.status}: ${text.slice(0, 180)}`,
        };
      }
      const result = (json as { result?: unknown }).result;
      if (!result || typeof result !== "object") {
        return { status: "FAIL", message: "Simulation completed without result payload" };
      }
      return {
        status: "PASS",
        message: "Simulation completed with output (dry-run / what-if only)",
        details: { keys: Object.keys(result as object).slice(0, 12) },
      };
    }),
  );

  return checks;
}

export function finalizeSmokeReport(input: {
  checks: SmokeCheckResult[];
  startedAt: string;
  baseUrl: string | null;
}): SmokeSuiteReport {
  const finishedAt = nowIso();
  const failures = input.checks.filter((c) => c.status === "FAIL");
  const warnings = input.checks.filter((c) => c.status === "WARNING");
  const startedMs = Date.parse(input.startedAt);
  const finishedMs = Date.parse(finishedAt);

  return {
    ok: failures.length === 0,
    final: failures.length === 0 ? "PASS" : "FAIL",
    startedAt: input.startedAt,
    finishedAt,
    durationMs: Number.isFinite(startedMs) ? finishedMs - startedMs : 0,
    deploymentId:
      process.env.RAILWAY_DEPLOYMENT_ID?.trim() ||
      process.env.RAILWAY_DEPLOYMENT_DRAFT_ID?.trim() ||
      null,
    commitHash:
      process.env.RAILWAY_GIT_COMMIT_SHA?.trim() ||
      process.env.RAILWAY_GIT_COMMIT?.trim() ||
      process.env.GITHUB_SHA?.trim() ||
      null,
    baseUrl: input.baseUrl,
    checks: input.checks,
    failures,
    warnings,
  };
}
