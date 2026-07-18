import { humanizeSyncError } from "@/lib/connections/connection-state";

export type SyncApiResponse = {
  ok?: boolean;
  error?: string;
  reason?: string;
  syncedAt?: string;
  campaigns?: number;
  products?: number;
  orders30d?: number;
  spend30d?: number;
  sessions30d?: number;
  engagementRatePct?: number;
  ecommerceConversionRatePct?: number;
  warnings?: string[];
};

export type SyncFeedback = {
  kind: "success" | "error";
  message: string;
  detail?: string;
};

export function buildSyncFeedback(
  integrationId: string,
  body: SyncApiResponse,
): SyncFeedback {
  const syncedAt = body.syncedAt
    ? new Date(body.syncedAt).toLocaleString()
    : undefined;

  if (integrationId === "meta_ads") {
    const campaigns = body.campaigns ?? 0;
    const detailParts = [
      syncedAt ? `Last sync: ${syncedAt}` : null,
      `${campaigns} campaigns updated`,
      body.spend30d != null ? `30-day spend: $${Math.round(body.spend30d).toLocaleString()}` : null,
      body.warnings?.length ? body.warnings.join(" · ") : null,
    ].filter(Boolean);

    return {
      kind: "success",
      message: "Meta Ads sync completed successfully.",
      detail: detailParts.join(" · "),
    };
  }

  if (integrationId === "shopify") {
    const detailParts = [
      syncedAt ? `Last sync: ${syncedAt}` : null,
      body.products != null ? `${body.products} products` : null,
      body.orders30d != null ? `${body.orders30d} orders (30 days)` : null,
    ].filter(Boolean);

    return {
      kind: "success",
      message: "Shopify sync completed successfully.",
      detail: detailParts.join(" · "),
    };
  }

  if (integrationId === "google_ads") {
    const detailParts = [
      syncedAt ? `Last sync: ${syncedAt}` : null,
      body.campaigns != null ? `${body.campaigns} campaigns` : null,
    ].filter(Boolean);

    return {
      kind: "success",
      message: "Google Ads sync completed successfully.",
      detail: detailParts.join(" · "),
    };
  }

  if (integrationId === "ga4") {
    const detailParts = [
      syncedAt ? `Last sync: ${syncedAt}` : null,
      body.sessions30d != null ? `${body.sessions30d.toLocaleString()} sessions (30d)` : null,
      body.engagementRatePct != null ? `${body.engagementRatePct.toFixed(1)}% engagement` : null,
    ].filter(Boolean);

    return {
      kind: "success",
      message: "GA4 sync completed successfully.",
      detail: detailParts.join(" · "),
    };
  }

  return {
    kind: "success",
    message: "Sync completed successfully.",
    detail: syncedAt ? `Last sync: ${syncedAt}` : undefined,
  };
}

const PROVIDER_LABELS: Record<string, string> = {
  ga4: "Google Analytics",
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  shopify: "Shopify",
};

export async function runIntegrationSync(
  syncEndpoint: string,
  integrationId: string,
): Promise<SyncFeedback> {
  let response: Response;
  try {
    response = await fetch(syncEndpoint, { method: "POST" });
  } catch {
    return {
      kind: "error",
      message: "Sync request could not be sent.",
      detail: "Check your internet connection and try again.",
    };
  }

  let body: SyncApiResponse = {};
  try {
    body = (await response.json()) as SyncApiResponse;
  } catch {
    body = {};
  }

  if (!response.ok) {
    if (response.status === 401 && body.reason === "missing_session_token") {
      return {
        kind: "error",
        message: "Synchronization failed.",
        detail: "Please open StorePilot from your Shopify Admin to perform manual sync.",
      };
    }

    const provider = PROVIDER_LABELS[integrationId] ?? "Integration";
    const friendly = humanizeSyncError(body.error, provider);
    return {
      kind: "error",
      message: "Synchronization failed.",
      detail: friendly ?? body.error ?? `Server error (${response.status}).`,
    };
  }

  return buildSyncFeedback(integrationId, body);
}
