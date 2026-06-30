import type { MetaCampaign } from "@/lib/connectors/types";
import type { AttributionChannelId, AttributionEvent, Touchpoint } from "./models";
import { CHANNEL_LABELS } from "./models";

const PAID_CHANNELS: AttributionChannelId[] = [
  "meta_ads",
  "google_ads",
  "tiktok",
  "pinterest",
  "influencer",
];

export function isPaidChannel(channelId: AttributionChannelId): boolean {
  return PAID_CHANNELS.includes(channelId);
}

export function eventToTouchpoint(event: AttributionEvent, index: number): Touchpoint {
  return {
    id: `${event.sessionId}-${index}`,
    timestamp: event.timestamp,
    channelId: event.channelId,
    channelLabel: event.channelLabel || CHANNEL_LABELS[event.channelId],
    source: event.source,
    campaign: event.campaign,
    campaignId: event.campaignId,
    adSet: event.adSet,
    ad: event.ad,
    creativeId: event.creativeId,
    device: event.device ?? "unknown",
    landingPage: event.landingPage ?? "/",
    sessionDurationSec: event.sessionDurationSec ?? 0,
  };
}

/** Synthesize attribution events from campaigns + store metrics when journey data unavailable */
export function synthesizeAttributionEvents(
  campaigns: MetaCampaign[],
  storeRevenue30d: number,
  storeOrders30d: number,
  now = new Date(),
): AttributionEvent[] {
  const events: AttributionEvent[] = [];
  const aov = storeOrders30d > 0 ? storeRevenue30d / storeOrders30d : 78;

  const journeyTemplates: {
    channels: { channelId: AttributionChannelId; source: string; campaignIdx?: number }[];
    weight: number;
  }[] = [
    {
      channels: [
        { channelId: "meta_ads", source: "Facebook", campaignIdx: 0 },
        { channelId: "meta_ads", source: "Instagram", campaignIdx: 1 },
        { channelId: "direct", source: "Direct" },
      ],
      weight: 0.22,
    },
    {
      channels: [
        { channelId: "meta_ads", source: "Facebook", campaignIdx: 0 },
        { channelId: "organic_search", source: "Google Organic" },
        { channelId: "direct", source: "Direct" },
      ],
      weight: 0.18,
    },
    {
      channels: [
        { channelId: "google_ads", source: "Google Ads" },
        { channelId: "meta_ads", source: "Instagram Remarketing", campaignIdx: 1 },
        { channelId: "direct", source: "Direct" },
      ],
      weight: 0.12,
    },
    {
      channels: [{ channelId: "meta_ads", source: "Facebook", campaignIdx: 0 }],
      weight: 0.2,
    },
    {
      channels: [{ channelId: "email", source: "Klaviyo" }],
      weight: 0.08,
    },
    {
      channels: [{ channelId: "organic_search", source: "Google Organic" }],
      weight: 0.1,
    },
    {
      channels: [{ channelId: "direct", source: "Direct" }],
      weight: 0.1,
    },
  ];

  let orderIdx = 0;
  const totalOrders = Math.min(storeOrders30d, 120);

  for (const template of journeyTemplates) {
    const count = Math.max(1, Math.round(totalOrders * template.weight));
    for (let i = 0; i < count && orderIdx < totalOrders; i++, orderIdx++) {
      const orderId = `syn-order-${orderIdx}`;
      const orderValue = Math.round(aov * (0.85 + (orderIdx % 5) * 0.06) * 100) / 100;
      const purchaseTime = new Date(now.getTime() - (orderIdx % 28) * 86400000 - (orderIdx % 12) * 3600000);
      const sessionId = `sess-${orderIdx}`;
      const isNew = orderIdx % 3 !== 0;

      template.channels.forEach((ch, tpIdx) => {
        const tpTime = new Date(
          purchaseTime.getTime() - (template.channels.length - tpIdx) * 86400000 * (1 + (tpIdx % 2)),
        );
        const camp = ch.campaignIdx != null ? campaigns[ch.campaignIdx] : undefined;
        events.push({
          sessionId,
          orderId: tpIdx === template.channels.length - 1 ? orderId : undefined,
          timestamp: tpTime.toISOString(),
          channelId: ch.channelId,
          channelLabel: CHANNEL_LABELS[ch.channelId],
          source: ch.source,
          campaign: camp?.name,
          campaignId: camp?.id,
          adSet: camp ? `${camp.name} — Ad Set ${(tpIdx % 2) + 1}` : undefined,
          ad: camp ? `Ad ${(orderIdx % 3) + 1}` : undefined,
          creativeId: camp ? `cr-${camp.id}-${(orderIdx % 3) + 1}` : undefined,
          device: orderIdx % 2 === 0 ? "mobile" : "desktop",
          landingPage: tpIdx === 0 ? "/collections/skincare" : "/products",
          sessionDurationSec: 60 + (orderIdx % 8) * 45,
          orderValue: tpIdx === template.channels.length - 1 ? orderValue : undefined,
          isNewCustomer: tpIdx === template.channels.length - 1 ? isNew : undefined,
        });
      });
    }
  }

  return events;
}
