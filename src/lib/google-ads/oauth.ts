/** Default REST version — see https://developers.google.com/google-ads/api/docs/sunset-dates */
export const GOOGLE_ADS_API_VERSION =
  process.env.GOOGLE_ADS_API_VERSION?.trim() || "v24";

export const DEFAULT_GOOGLE_ADS_SCOPES = [
  "https://www.googleapis.com/auth/adwords",
  "openid",
  "email",
  "profile",
].join(" ");

export function getGoogleAdsConfig() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const appUrl = process.env.GOOGLE_ADS_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  if (!clientId || !clientSecret || !appUrl || !developerToken) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    appUrl: appUrl.replace(/\/$/, ""),
    developerToken,
    scopes: process.env.GOOGLE_ADS_SCOPES ?? DEFAULT_GOOGLE_ADS_SCOPES,
  };
}

export function isGoogleAdsOAuthConfigured(): boolean {
  return getGoogleAdsConfig() !== null;
}

/** Dev-only override when OAuth app credentials are not set */
export function getGoogleAdsDevOverride(): {
  accessToken: string;
  refreshToken: string;
  customerId: string;
} | null {
  const accessToken = process.env.GOOGLE_ADS_ACCESS_TOKEN;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN ?? accessToken;
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!accessToken || !customerId || !developerToken) return null;
  return { accessToken, refreshToken: refreshToken!, customerId };
}

export function isGoogleAdsAvailable(): boolean {
  return isGoogleAdsOAuthConfigured() || getGoogleAdsDevOverride() !== null;
}

export function buildGoogleAdsOAuthUrl(state: string, appUrlOverride?: string): string {
  const config = getGoogleAdsConfig();
  if (!config) throw new Error("Google Ads OAuth is not configured");

  const base = (appUrlOverride ?? config.appUrl).replace(/\/$/, "");
  const redirectUri = `${base}/api/google/callback`;
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: config.scopes,
    state,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForGoogleTokens(
  code: string,
  appUrlOverride?: string,
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}> {
  const config = getGoogleAdsConfig();
  if (!config) throw new Error("Google Ads OAuth is not configured");

  const base = (appUrlOverride ?? config.appUrl).replace(/\/$/, "");
  const redirectUri = `${base}/api/google/callback`;
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token exchange failed: ${text}`);
  }

  return response.json();
}

export async function refreshGoogleAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in?: number; refresh_token?: string }> {
  const config = getGoogleAdsConfig();
  if (!config) throw new Error("Google Ads OAuth is not configured");

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token refresh failed: ${text}`);
  }

  return response.json();
}

export async function fetchGoogleUserProfile(
  accessToken: string,
): Promise<{ sub: string; email?: string; name?: string }> {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google profile fetch failed: ${text}`);
  }

  return response.json() as Promise<{ sub: string; email?: string; name?: string }>;
}

export function normalizeGoogleCustomerId(customerId: string): string {
  return customerId.replace(/^customers\//, "").replace(/-/g, "");
}

export function formatGoogleCustomerId(customerId: string): string {
  const digits = normalizeGoogleCustomerId(customerId);
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
}
