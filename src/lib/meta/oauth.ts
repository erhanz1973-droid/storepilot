import { createHmac, timingSafeEqual } from "crypto";

export const META_GRAPH_VERSION = "v21.0";

export const DEFAULT_META_SCOPES = ["ads_read", "business_management"].join(",");

export function getMetaConfig() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const appUrl = process.env.META_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  const encryptionKey =
    process.env.META_TOKEN_ENCRYPTION_KEY ?? process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY;

  if (!appId || !appSecret || !appUrl) {
    return null;
  }

  return {
    appId,
    appSecret,
    appUrl: appUrl.replace(/\/$/, ""),
    scopes: process.env.META_SCOPES ?? DEFAULT_META_SCOPES,
    encryptionKey: encryptionKey ?? null,
  };
}

export function isMetaOAuthConfigured(): boolean {
  return getMetaConfig() !== null;
}

/** Dev-only override when OAuth app credentials are not set */
export function getMetaDevOverride(): { accessToken: string; accountId: string } | null {
  const accessToken = process.env.META_ADS_ACCESS_TOKEN;
  const accountId = process.env.META_ADS_ACCOUNT_ID;
  if (!accessToken || !accountId) return null;
  return { accessToken, accountId };
}

export function isMetaAdsAvailable(): boolean {
  return isMetaOAuthConfigured() || getMetaDevOverride() !== null;
}

export function buildMetaOAuthUrl(state: string): string {
  const config = getMetaConfig();
  if (!config) throw new Error("Meta OAuth is not configured");

  const redirectUri = `${config.appUrl}/api/meta/callback`;
  const params = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: redirectUri,
    state,
    scope: config.scopes,
    response_type: "code",
  });

  return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

export function verifyMetaSignedRequest(
  signedRequest: string,
  appSecret: string,
): Record<string, unknown> | null {
  const [encodedSig, payload] = signedRequest.split(".", 2);
  if (!encodedSig || !payload) return null;

  const sig = Buffer.from(encodedSig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const expected = createHmac("sha256", appSecret).update(payload).digest();

  try {
    if (!timingSafeEqual(sig, expected)) return null;
  } catch {
    return null;
  }

  const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf8",
  );
  return JSON.parse(json) as Record<string, unknown>;
}

export async function exchangeCodeForMetaToken(
  code: string,
): Promise<{ access_token: string; token_type: string; expires_in?: number }> {
  const config = getMetaConfig();
  if (!config) throw new Error("Meta OAuth is not configured");

  const redirectUri = `${config.appUrl}/api/meta/callback`;
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("client_secret", config.appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meta token exchange failed: ${text}`);
  }

  return response.json() as Promise<{
    access_token: string;
    token_type: string;
    expires_in?: number;
  }>;
}

export async function exchangeForLongLivedMetaToken(
  shortLivedToken: string,
): Promise<{ access_token: string; token_type: string; expires_in?: number }> {
  const config = getMetaConfig();
  if (!config) throw new Error("Meta OAuth is not configured");

  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("client_secret", config.appSecret);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meta long-lived token exchange failed: ${text}`);
  }

  return response.json() as Promise<{
    access_token: string;
    token_type: string;
    expires_in?: number;
  }>;
}

export async function fetchMetaUserProfile(
  accessToken: string,
): Promise<{ id: string; name?: string }> {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/me`);
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meta profile fetch failed: ${text}`);
  }

  return response.json() as Promise<{ id: string; name?: string }>;
}
