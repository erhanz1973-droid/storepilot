import type { GA4Snapshot } from "./types";
import type { AttributionEvent } from "@/lib/attribution/models";
import type { TouchpointDevice } from "@/lib/attribution/models";

/** Convert GA4 source/medium rows into attribution events for journey building */
export function ga4ToAttributionEvents(ga4: GA4Snapshot, now = new Date()): AttributionEvent[] {
  const events: AttributionEvent[] = [];
  let orderSeq = 0;
  const device = (ga4.devices[0]?.device ?? "unknown") as TouchpointDevice;
  const landing = ga4.landingPages[0]?.path ?? "/";

  for (const row of ga4.sourceMedium) {
    const conversions = Math.max(0, Math.floor(row.conversions));
    const orderValue =
      conversions > 0
        ? Math.round((row.revenue / conversions) * 100) / 100
        : 0;

    for (let c = 0; c < Math.min(conversions, 20); c += 1) {
      const sessionId = `ga4-${row.source}-${row.medium}-order-${c}`;
      const baseTs = now.getTime() - (orderSeq % 28) * 86400000;

      events.push({
        sessionId,
        timestamp: new Date(baseTs - 7200000).toISOString(),
        channelId: resolveChannelId(row.source, row.medium),
        channelLabel: `${row.source} / ${row.medium}`,
        source: row.source,
        campaign: row.campaign,
        device,
        landingPage: landing,
      });

      const assistRow = ga4.sourceMedium[(orderSeq + 1) % ga4.sourceMedium.length];
      if (assistRow && assistRow !== row) {
        events.push({
          sessionId,
          timestamp: new Date(baseTs - 3600000).toISOString(),
          channelId: resolveChannelId(assistRow.source, assistRow.medium),
          channelLabel: `${assistRow.source} / ${assistRow.medium}`,
          source: assistRow.source,
          campaign: assistRow.campaign,
          device,
          landingPage: landing,
        });
      }

      events.push({
        sessionId,
        orderId: `ga4-order-${orderSeq}`,
        timestamp: new Date(baseTs).toISOString(),
        channelId: resolveChannelId(row.source, row.medium),
        channelLabel: `${row.source} / ${row.medium}`,
        source: row.source,
        campaign: row.campaign,
        orderValue,
        device,
        landingPage: landing,
      });

      orderSeq += 1;
    }

    const browseSessions = Math.min(Math.max(0, row.sessions - conversions), 10);
    for (let s = 0; s < browseSessions; s += 1) {
      events.push({
        sessionId: `ga4-${row.source}-${row.medium}-browse-${s}`,
        timestamp: new Date(now.getTime() - s * 3600000).toISOString(),
        channelId: resolveChannelId(row.source, row.medium),
        channelLabel: `${row.source} / ${row.medium}`,
        source: row.source,
        campaign: row.campaign,
        device,
        landingPage: landing,
      });
    }
  }

  return events;
}

function resolveChannelId(
  source: string,
  medium: string,
): AttributionEvent["channelId"] {
  const s = source.toLowerCase();
  const m = medium.toLowerCase();
  if (s.includes("facebook") || s.includes("instagram") || m === "paid") return "meta_ads";
  if (s.includes("google") && m === "cpc") return "google_ads";
  if (s.includes("tiktok")) return "tiktok";
  if (s.includes("klaviyo") || m === "email") return "email";
  if (s === "(direct)" || m === "(none)") return "direct";
  if (m === "organic") return "organic_search";
  return "referral";
}
