/**
 * OAuth redirect/cookie base URL must match the browser origin that started the flow.
 * In local dev, GOOGLE_ADS_APP_URL often points to :3000 while Next runs on :3002.
 */
export function resolveOAuthBaseUrl(request: Request, configuredAppUrl: string): string {
  const configured = configuredAppUrl.replace(/\/$/, "");
  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    return configured;
  }

  const requestHost = new URL(requestOrigin).hostname;

  if (
    process.env.NODE_ENV !== "production" &&
    (requestHost === "localhost" || requestHost === "127.0.0.1")
  ) {
    return requestOrigin;
  }

  return configured;
}

export const OAUTH_BASE_URL_COOKIE = {
  google: "google_oauth_base_url",
  meta: "meta_oauth_base_url",
  ga4: "ga4_oauth_base_url",
} as const;
