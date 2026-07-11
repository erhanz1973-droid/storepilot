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
      touchpointCount: touchpoints.length,
      timeToConversionHours: Math.max(0, Math.round(((lastMs - firstMs) / 3600000) * 10) / 10),
      revenueContributionPct: 0,
      customerType: purchase.isNewCustomer ?? true ? "New" : "Returning",
    });
  }

  return journeys.sort(
    (a, b) => new Date(b.orderTimestamp).getTime() - new Date(a.orderTimestamp).getTime(),
  );
}

export function enrichJourneyMetrics(
  journeys: CustomerJourney[],
): CustomerJourney[] {
  const totalRevenue = journeys.reduce((s, j) => s + j.orderValue, 0) || 1;

  return journeys.map((j) => {
    const firstMs = new Date(j.touchpoints[0]?.timestamp ?? j.orderTimestamp).getTime();
    const lastMs = new Date(j.orderTimestamp).getTime();
    const hours = Math.max(0, Math.round(((lastMs - firstMs) / 3600000) * 10) / 10);

    return {
      ...j,
      touchpointCount: j.touchpoints.length,
      timeToConversionHours: hours,
      revenueContributionPct: Math.round((j.orderValue / totalRevenue) * 1000) / 10,
      customerType: j.isNewCustomer ? "New" : "Returning",
    };
  });
}

export function journeyPathLabel(journey: CustomerJourney): string {
  return journey.touchpoints.map((tp) => tp.source || tp.channelLabel).join(" → ");
}
