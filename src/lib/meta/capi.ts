import type { MetaCapiStatus } from "@/lib/integrations/types";

export type MetaCapiConfig = {
  pixelId: string;
  accessToken: string;
};

export function getMetaCapiConfig(): MetaCapiConfig | null {
  const pixelId = process.env.META_CAPI_PIXEL_ID?.trim();
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  if (!pixelId || !accessToken) return null;
  return { pixelId, accessToken };
}

/** Server-side event dispatch stub — wire to Meta Graph API in production */
export async function sendMetaCapiEvent(
  _eventName: "Purchase" | "AddToCart" | "InitiateCheckout" | "ViewContent",
  _payload: Record<string, unknown>,
): Promise<{ ok: boolean; eventId?: string }> {
  const config = getMetaCapiConfig();
  if (!config) return { ok: false };
  return { ok: true, eventId: `capi-${Date.now()}` };
}

export function buildMetaCapiStatusFromEnv(): MetaCapiStatus | null {
  if (!getMetaCapiConfig()) return null;
  return {
    enabled: true,
    eventsReceived30d: 0,
    matchRatePct: 0,
    events: { purchase: 0, addToCart: 0, initiateCheckout: 0, viewContent: 0 },
  };
}
