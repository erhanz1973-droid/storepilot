import { getMetaPixelId } from "@/lib/marketing/pixel";
import { MARKETING_SITE_URL } from "@/lib/marketing/site";
import { META_GRAPH_VERSION } from "@/lib/meta/oauth";

/**
 * Server-side Meta Conversions API. No-ops unless both pixel ID and
 * META_CAPI_ACCESS_TOKEN are configured. Does not invent credentials.
 */
export async function trackMetaCapiEvent(
  eventName: string,
  options?: { eventId?: string; eventSourceUrl?: string },
): Promise<void> {
  const pixelId = getMetaPixelId();
  const token = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  if (!pixelId || !token) return;

  try {
    const url = new URL(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${pixelId}/events`,
    );
    url.searchParams.set("access_token", token);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          {
            event_name: eventName,
            event_time: Math.floor(Date.now() / 1000),
            action_source: "website",
            event_source_url: options?.eventSourceUrl ?? MARKETING_SITE_URL,
            event_id: options?.eventId,
          },
        ],
      }),
    });
    if (!response.ok) {
      console.warn("[meta-capi] event rejected", eventName, response.status);
    }
  } catch (error) {
    console.warn(
      "[meta-capi] event failed",
      eventName,
      error instanceof Error ? error.message : String(error),
    );
  }
}
