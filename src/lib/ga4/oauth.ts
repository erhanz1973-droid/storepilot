/** GA4 OAuth — reuses Google Cloud OAuth app with analytics.readonly scope */

export const DEFAULT_GA4_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "openid",
  "email",
  "profile",
].join(" ");

export function getGa4OAuthConfig() {
  const clientId = process.env.GA4_CLIENT_ID ?? process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GA4_CLIENT_SECRET ?? process.env.GOOGLE_ADS_CLIENT_SECRET;
  const appUrl = process.env.GA4_APP_URL ?? process.env.GOOGLE_ADS_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  if (!clientId || !clientSecret || !appUrl) return null;

  return {
    clientId,
    clientSecret,
    appUrl: appUrl.replace(/\/$/, ""),
    scopes: process.env.GA4_SCOPES ?? DEFAULT_GA4_SCOPES,
  };
}

export function isGa4OAuthConfigured(): boolean {
  return getGa4OAuthConfig() !== null;
}

export function buildGa4OAuthUrl(state: string, appUrlOverride?: string): string {
  const config = getGa4OAuthConfig();
  if (!config) throw new Error("GA4 OAuth is not configured");

  const base = (appUrlOverride ?? config.appUrl).replace(/\/$/, "");
  const redirectUri = `${base}/api/ga4/callback`;
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

export async function exchangeGa4CodeForTokens(
  code: string,
  appUrlOverride?: string,
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}> {
  const config = getGa4OAuthConfig();
  if (!config) throw new Error("GA4 OAuth is not configured");

  const base = (appUrlOverride ?? config.appUrl).replace(/\/$/, "");
  const redirectUri = `${base}/api/ga4/callback`;
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
    throw new Error(`GA4 token exchange failed: ${text}`);
  }

  return response.json();
}

export async function refreshGa4AccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in?: number;
}> {
  const config = getGa4OAuthConfig();
  if (!config) throw new Error("GA4 OAuth is not configured");

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
    throw new Error(`GA4 token refresh failed: ${text}`);
  }

  return response.json();
}
