import type { AttributionEvent, CustomerJourney, Touchpoint } from "./models";
import { eventToTouchpoint } from "./touchpoints";

export function buildCustomerJourneys(events: AttributionEvent[]): CustomerJourney[] {
  const purchaseEvents = events.filter((e) => e.orderId && e.orderValue != null);
  const journeys: CustomerJourney[] = [];

  for (const purchase of purchaseEvents) {
    const sessionEvents = events
      .filter((e) => e.sessionId === purchase.sessionId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const touchpoints = sessionEvents.map((ev, idx) => eventToTouchpoint(ev, idx));
    if (touchpoints.length === 0) continue;

    const firstMs = new Date(touchpoints[0].timestamp).getTime();
    const lastMs = new Date(touchpoints[touchpoints.length - 1].timestamp).getTime();

    journeys.push({
      orderId: purchase.orderId!,
      orderValue: purchase.orderValue!,
      orderTimestamp: purchase.timestamp,
      isNewCustomer: purchase.isNewCustomer ?? true,
      touchpoints,
      journeyLengthDays: Math.max(0, Math.round((lastMs - firstMs) / 86400000 * 10) / 10),
    });
  }

  return journeys.sort(
    (a, b) => new Date(b.orderTimestamp).getTime() - new Date(a.orderTimestamp).getTime(),
  );
}

export function journeyPathLabel(journey: CustomerJourney): string {
  return journey.touchpoints.map((tp) => tp.source || tp.channelLabel).join(" → ");
}
