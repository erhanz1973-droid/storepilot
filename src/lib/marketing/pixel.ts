/** Meta Pixel ID from env. Never invent a fallback ID. */
export function getMetaPixelId(): string | null {
  const raw = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";
  if (!/^\d{5,20}$/.test(raw)) return null;
  return raw;
}

export const META_STANDARD_EVENTS = ["PageView", "ViewContent"] as const;
export const META_CUSTOM_EVENTS = ["SignUp", "ConnectShopify"] as const;

export type MetaStandardEvent = (typeof META_STANDARD_EVENTS)[number];
export type MetaCustomEvent = (typeof META_CUSTOM_EVENTS)[number];
export type MetaPixelEvent = MetaStandardEvent | MetaCustomEvent;

export function isMetaStandardEvent(event: string): event is MetaStandardEvent {
  return (META_STANDARD_EVENTS as readonly string[]).includes(event);
}
