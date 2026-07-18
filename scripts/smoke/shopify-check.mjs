/**
 * Shopify smoke probe with offline token refresh.
 * Used by scripts/smoke/run.mjs (and can replace inline suite.mjs checkShopify).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";

const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION?.trim() || "2025-10";

function shaKey(secret) {
  return createHash("sha256").update(secret).digest();
}

function decryptAesGcm(payload, secret) {
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

function encryptAesGcm(plaintext, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", shaKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function resolveShopifyEncryptionSecret() {
  const secret = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("SHOPIFY_TOKEN_ENCRYPTION_KEY missing or too short");
  }
  return secret;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Supabase env missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function tokenFingerprint(token) {
  return token.slice(0, 12);
}

async function shopifyGraphQL(shop, accessToken, query, meta = {}) {
  const endpoint = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  console.log(
    "[shopify-auth]",
    JSON.stringify({
      installationId: meta.installationId ?? null,
      shopDomain: shop,
      tokenFingerprint: meta.tokenFingerprint ?? null,
      sessionType: meta.sessionType ?? "offline",
      graphqlEndpoint: endpoint,
      httpStatus: null,
      tokenDecryptSucceeded: true,
      reason:
        "smoke graphql request (pre-flight local diagnostics only — not Shopify API proof)",
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
      installationId: meta.installationId ?? null,
      shopDomain: shop,
      tokenFingerprint: meta.tokenFingerprint ?? null,
      sessionType: meta.sessionType ?? "offline",
      graphqlEndpoint: endpoint,
      httpStatus: response.status,
      tokenDecryptSucceeded: true,
      reason: `smoke graphql HTTP ${response.status}`,
    }),
  );
  if (!response.ok) {
    throw new Error(
      `Shopify GraphQL HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`,
    );
  }
  const json = await response.json();
  return { ...json, httpStatus: response.status };
}

async function refreshOfflineAccessToken(shop, refreshToken) {
  const clientId = process.env.SHOPIFY_API_KEY?.trim();
  const clientSecret = process.env.SHOPIFY_API_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("SHOPIFY_API_KEY / SHOPIFY_API_SECRET required to refresh offline token");
  }
  const endpoint = `https://${shop}/admin/oauth/access_token`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });
  const text = await response.text();
  console.log(
    "[shopify-auth]",
    JSON.stringify({
      shopDomain: shop,
      sessionType: "offline",
      graphqlEndpoint: endpoint,
      httpStatus: response.status,
      tokenDecryptSucceeded: true,
      reason: response.ok
        ? "smoke offline refresh_token grant succeeded"
        : `smoke offline refresh_token grant failed: ${text.slice(0, 180)}`,
    }),
  );
  if (!response.ok) {
    throw new Error(`Shopify offline token refresh HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  const json = JSON.parse(text);
  if (!json.access_token || !json.refresh_token) {
    throw new Error("Shopify offline token refresh returned incomplete token pair");
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    refreshTokenExpiresIn:
      typeof json.refresh_token_expires_in === "number" ? json.refresh_token_expires_in : null,
  };
}

async function persistRefreshedTokens(
  supabase,
  installationId,
  accessToken,
  refreshToken,
  refreshTokenExpiresIn,
) {
  const secret = resolveShopifyEncryptionSecret();
  const refreshExpiresAt =
    refreshTokenExpiresIn != null
      ? new Date(Date.now() + refreshTokenExpiresIn * 1000).toISOString()
      : null;
  const { error } = await supabase
    .from("shopify_installations")
    .update({
      access_token_encrypted: encryptAesGcm(accessToken, secret),
      refresh_token_encrypted: encryptAesGcm(refreshToken, secret),
      refresh_token_expires_at: refreshExpiresAt,
      connection_health: "healthy",
      error_message: null,
      status: "active",
    })
    .eq("id", installationId);
  if (error) {
    throw new Error(`Failed to persist refreshed Shopify tokens: ${error.message}`);
  }
}

function isDiscountAccessDenied(errors) {
  if (!errors?.length) return false;
  return errors.some((e) => /discountNodes|read_discounts/i.test(e.message));
}

/**
 * @returns {Promise<{ status: string, message: string, details?: Record<string, unknown> }>}
 */
export async function checkShopify() {
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
  const storedClientId = row.client_id?.trim() || null;
  const appMatch = storedClientId && runtimeApiKey ? storedClientId === runtimeApiKey : null;
  const reinstallRequired = appMatch === false;
  const installationId = row.id;
  const shop = row.shop_domain;
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

  let accessToken = decryptAesGcm(row.access_token_encrypted, resolveShopifyEncryptionSecret());
  let refreshToken = null;
  if (row.refresh_token_encrypted) {
    try {
      refreshToken = decryptAesGcm(row.refresh_token_encrypted, resolveShopifyEncryptionSecret());
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
      tokenDecryptSucceeded: true,
      appMatch,
      reinstallRequired,
      hasRefreshToken: Boolean(refreshToken),
      refreshTokenExpiresAt: row.refresh_token_expires_at ?? null,
      reason:
        "smoke installation resolved from shopify_installations (same offline SOH as embedded persist path)",
    }),
  );

  const gqlMeta = { installationId, tokenFingerprint: fingerprint, sessionType: "offline" };
  const metrics = {
    refreshAttempted: false,
    refreshSucceeded: false,
    refreshFailed: false,
    retrySucceeded: false,
    retryFailed: false,
  };
  const baseDetails = {
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
    ...metrics,
  };

  function logMetrics(extra = {}) {
    console.log(
      "[shopify-refresh-metrics]",
      JSON.stringify({ shopDomain: shop, ...metrics, ...extra }),
    );
  }

  let productsResult;
  try {
    productsResult = await shopifyGraphQL(
      shop,
      accessToken,
      `query { products(first: 5) { edges { node { id title } } } }`,
      gqlMeta,
    );
  } catch (firstError) {
    const message = firstError instanceof Error ? firstError.message : String(firstError);
    const is401 = /GraphQL HTTP 401/.test(message);
    if (!is401) {
      return { status: "FAIL", message, details: baseDetails };
    }

    metrics.refreshAttempted = true;
    if (!refreshToken) {
      metrics.refreshFailed = true;
      logMetrics({
        failureReason: "missing_refresh_token",
        merchantReauthorizationRequired: true,
      });
      return {
        status: "FAIL",
        message: `${message} (missing refresh_token — merchantReauthorizationRequired)`,
        details: {
          ...baseDetails,
          ...metrics,
          httpStatus: 401,
          merchantReauthorizationRequired: true,
          failureReason: "missing_refresh_token",
        },
      };
    }

    try {
      const refreshed = await refreshOfflineAccessToken(shop, refreshToken);
      await persistRefreshedTokens(
        supabase,
        installationId,
        refreshed.accessToken,
        refreshed.refreshToken,
        refreshed.refreshTokenExpiresIn,
      );
      metrics.refreshSucceeded = true;
      accessToken = refreshed.accessToken;
      refreshToken = refreshed.refreshToken;
      gqlMeta.tokenFingerprint = tokenFingerprint(accessToken);
      baseDetails.tokenFingerprint = gqlMeta.tokenFingerprint;

      try {
        productsResult = await shopifyGraphQL(
          shop,
          accessToken,
          `query { products(first: 5) { edges { node { id title } } } }`,
          gqlMeta,
        );
        metrics.retrySucceeded = true;
        logMetrics({ merchantReauthorizationRequired: false, phase: "retry_succeeded" });
      } catch (retryError) {
        metrics.retryFailed = true;
        logMetrics({ merchantReauthorizationRequired: true, phase: "retry_failed" });
        return {
          status: "FAIL",
          message: retryError instanceof Error ? retryError.message : String(retryError),
          details: {
            ...baseDetails,
            ...metrics,
            merchantReauthorizationRequired: true,
          },
        };
      }
    } catch (refreshError) {
      metrics.refreshFailed = true;
      const detail = refreshError instanceof Error ? refreshError.message : String(refreshError);
      const failureReason = /invalid_grant/i.test(detail)
        ? "invalid_grant"
        : /expired/i.test(detail)
          ? "expired_refresh_token"
          : "refresh_http_error";
      logMetrics({ failureReason, merchantReauthorizationRequired: true });
      return {
        status: "FAIL",
        message: `Shopify GraphQL HTTP 401; offline refresh failed: ${detail}`,
        details: {
          ...baseDetails,
          ...metrics,
          httpStatus: 401,
          merchantReauthorizationRequired: true,
          failureReason,
        },
      };
    }
  }

  if (productsResult.errors?.length) {
    return {
      status: "FAIL",
      message: `Products GraphQL error: ${productsResult.errors.map((e) => e.message).join("; ")}`,
      details: baseDetails,
    };
  }

  let productsCount = productsResult.data?.products?.edges?.length ?? 0;
  const countRes = await fetch(
    `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/products/count.json`,
    {
      headers: { "X-Shopify-Access-Token": accessToken },
      cache: "no-store",
    },
  );
  if (countRes.ok) {
    const countJson = await countRes.json();
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

  let discountStatus = "ok";
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
    const nodes = discountsResult.data?.discountNodes;
    discountCount = nodes?.edges?.length ?? 0;
  }

  if (productsCount <= 0) {
    return {
      status: "FAIL",
      message: "Products count is 0",
      details: { ...baseDetails, productsCount },
    };
  }

  const syncStats = row.sync_stats ?? {};
  return {
    status: "PASS",
    message:
      discountStatus === "unavailable"
        ? `Active shop ${shop}; products=${productsCount}; discounts=Unavailable`
        : `Active shop ${shop}; products=${productsCount}; discounts=${discountCount}`,
    details: {
      ...baseDetails,
      productsCount,
      customersCount: customersResult.data?.customersCount?.count ?? null,
      discountStatus,
      discountCount,
      discountsUnavailable:
        discountStatus === "unavailable" || Boolean(syncStats.discountsUnavailable),
      httpStatus: productsResult.httpStatus,
    },
  };
}
