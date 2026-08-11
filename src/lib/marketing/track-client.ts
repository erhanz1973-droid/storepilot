import { isMetaStandardEvent, type MetaPixelEvent } from "@/lib/marketing/pixel";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** Client-side Meta Pixel track. No-ops when the pixel is not loaded. */
export function trackMetaEvent(
  event: MetaPixelEvent,
  params?: Record<string, unknown>,
): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  if (isMetaStandardEvent(event)) {
    window.fbq("track", event, params);
    return;
  }
  window.fbq("trackCustom", event, params);
}
