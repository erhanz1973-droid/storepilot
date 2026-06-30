import type { AttributionEvent } from "@/lib/attribution/models";
import { PEAK_OUTFITTERS } from "./constants";

const AOV = PEAK_OUTFITTERS.aov;

function daysAgo(d: number, hour = 12): string {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, 0, 0, 0);
  return t.toISOString();
}

type JourneyTouch = Omit<
  AttributionEvent,
  "sessionId" | "orderId" | "orderValue" | "isNewCustomer"
>;

type Journey = {
  orderId: string;
  value: number;
  newCustomer: boolean;
  touches: JourneyTouch[];
};

const BASE_JOURNEYS: Journey[] = [
  {
    orderId: "PO-10001",
    value: AOV * 1.4,
    newCustomer: true,
    touches: [
      { timestamp: daysAgo(5, 9), channelId: "meta_ads", channelLabel: "Meta Ads", source: "Facebook", campaign: "Summer Hiking", device: "mobile", landingPage: "/collections/backpacks" },
      { timestamp: daysAgo(4, 14), channelId: "google_ads", channelLabel: "Google Ads", source: "Google", campaign: "Camping Equipment Search", device: "desktop", landingPage: "/products/mountain-pro-backpack" },
      { timestamp: daysAgo(3, 19), channelId: "direct", channelLabel: "Direct", source: "Direct", device: "mobile", landingPage: "/cart" },
    ],
  },
  {
    orderId: "PO-10002",
    value: AOV,
    newCustomer: false,
    touches: [
      { timestamp: daysAgo(8, 10), channelId: "google_ads", channelLabel: "Google Ads", source: "Google", campaign: "Camping Equipment Search", device: "desktop", landingPage: "/" },
      { timestamp: daysAgo(6, 16), channelId: "email", channelLabel: "Email", source: "Klaviyo", campaign: "Spring Sale", device: "mobile", landingPage: "/collections/boots" },
    ],
  },
  {
    orderId: "PO-10003",
    value: AOV * 0.85,
    newCustomer: true,
    touches: [
      { timestamp: daysAgo(2, 11), channelId: "meta_ads", channelLabel: "Meta Ads", source: "Instagram", campaign: "Brand — Trail Community", device: "mobile", landingPage: "/collections/accessories" },
      { timestamp: daysAgo(1, 20), channelId: "direct", channelLabel: "Direct", source: "Direct", device: "mobile", landingPage: "/checkout" },
    ],
  },
  {
    orderId: "PO-10004",
    value: AOV * 1.2,
    newCustomer: false,
    touches: [
      { timestamp: daysAgo(12, 8), channelId: "meta_ads", channelLabel: "Meta Ads", source: "Facebook", campaign: "Retargeting — Cart Abandoners", device: "mobile", landingPage: "/cart" },
    ],
  },
  {
    orderId: "PO-10005",
    value: AOV * 2.1,
    newCustomer: true,
    touches: [
      { timestamp: daysAgo(7, 13), channelId: "organic_search", channelLabel: "Organic Search", source: "Google Organic", device: "desktop", landingPage: "/collections/tents" },
      { timestamp: daysAgo(5, 18), channelId: "meta_ads", channelLabel: "Meta Ads", source: "Facebook", campaign: "Summer Hiking", device: "desktop", landingPage: "/products/alpine-tent" },
      { timestamp: daysAgo(4, 21), channelId: "direct", channelLabel: "Direct", source: "Direct", device: "desktop", landingPage: "/checkout" },
    ],
  },
  {
    orderId: "PO-10006",
    value: AOV * 0.9,
    newCustomer: true,
    touches: [
      { timestamp: daysAgo(14, 11), channelId: "google_ads", channelLabel: "Google Ads", source: "Google", campaign: "Generic Outdoor Keywords", device: "mobile", landingPage: "/collections/clearance-gear" },
    ],
  },
  {
    orderId: "PO-10007",
    value: AOV * 1.6,
    newCustomer: false,
    touches: [
      { timestamp: daysAgo(9, 15), channelId: "meta_ads", channelLabel: "Meta Ads", source: "Facebook", campaign: "Spring Collection Launch", device: "mobile", landingPage: "/collections/backpacks" },
      { timestamp: daysAgo(7, 10), channelId: "google_ads", channelLabel: "Google Ads", source: "Google", campaign: "Shopping — Best Sellers", device: "desktop", landingPage: "/products/trailmaster-hiking-boots" },
    ],
  },
  {
    orderId: "PO-10008",
    value: AOV * 1.1,
    newCustomer: true,
    touches: [
      { timestamp: daysAgo(3, 8), channelId: "tiktok", channelLabel: "TikTok Ads", source: "TikTok", campaign: "Spark Ads — Trail UGC", device: "mobile", landingPage: "/products/mountain-pro-backpack" },
      { timestamp: daysAgo(2, 19), channelId: "direct", channelLabel: "Direct", source: "Direct", device: "mobile", landingPage: "/checkout" },
    ],
  },
  {
    orderId: "PO-10009",
    value: AOV * 0.75,
    newCustomer: false,
    touches: [
      { timestamp: daysAgo(18, 12), channelId: "email", channelLabel: "Email", source: "Klaviyo", campaign: "Winback Flow", device: "desktop", landingPage: "/collections/water-bottles" },
    ],
  },
  {
    orderId: "PO-10010",
    value: AOV * 1.3,
    newCustomer: true,
    touches: [
      { timestamp: daysAgo(6, 9), channelId: "google_ads", channelLabel: "Google Ads", source: "Google", campaign: "Hiking Boots Search", device: "mobile", landingPage: "/collections/hiking-boots" },
      { timestamp: daysAgo(5, 17), channelId: "meta_ads", channelLabel: "Meta Ads", source: "Instagram", campaign: "Instagram Stories — Gear Tips", device: "mobile", landingPage: "/products/all-weather-hiking-boots" },
    ],
  },
  {
    orderId: "PO-10011",
    value: AOV * 2.4,
    newCustomer: false,
    touches: [
      { timestamp: daysAgo(11, 14), channelId: "direct", channelLabel: "Direct", source: "Direct", device: "desktop", landingPage: "/" },
      { timestamp: daysAgo(10, 16), channelId: "google_ads", channelLabel: "Google Ads", source: "Google", campaign: "Brand — Peak Outfitters", device: "desktop", landingPage: "/collections/backpacks" },
    ],
  },
  {
    orderId: "PO-10012",
    value: AOV * 0.95,
    newCustomer: true,
    touches: [
      { timestamp: daysAgo(4, 13), channelId: "meta_ads", channelLabel: "Meta Ads", source: "Facebook", campaign: "Broad — Outdoor Interests", device: "mobile", landingPage: "/collections/clearance-gear" },
    ],
  },
  {
    orderId: "PO-10013",
    value: AOV * 1.8,
    newCustomer: true,
    touches: [
      { timestamp: daysAgo(15, 10), channelId: "organic_search", channelLabel: "Organic Search", source: "Google Organic", device: "mobile", landingPage: "/products/summit-down-sleeping-bag" },
      { timestamp: daysAgo(13, 18), channelId: "meta_ads", channelLabel: "Meta Ads", source: "Facebook", campaign: "Retargeting — Cart Abandoners", device: "mobile", landingPage: "/cart" },
    ],
  },
  {
    orderId: "PO-10014",
    value: AOV,
    newCustomer: false,
    touches: [
      { timestamp: daysAgo(20, 11), channelId: "google_ads", channelLabel: "Google Ads", source: "Google", campaign: "Performance Max — Outdoor", device: "mobile", landingPage: "/collections/accessories" },
    ],
  },
  {
    orderId: "PO-10015",
    value: AOV * 1.15,
    newCustomer: true,
    touches: [
      { timestamp: daysAgo(1, 9), channelId: "tiktok", channelLabel: "TikTok Ads", source: "TikTok", campaign: "Prospecting — Day Hike Gear", device: "mobile", landingPage: "/products/insulated-water-bottle-pro-32oz" },
      { timestamp: daysAgo(0, 20), channelId: "direct", channelLabel: "Direct", source: "Direct", device: "mobile", landingPage: "/checkout" },
    ],
  },
];

function expandJourneys(base: Journey[]): Journey[] {
  const expanded = [...base];
  const templates = base.slice(0, 8);
  for (let i = 16; i <= 35; i++) {
    const template = templates[i % templates.length]!;
    expanded.push({
      orderId: `PO-${10000 + i}`,
      value: Math.round(template.value * (0.85 + (i % 5) * 0.06) * 100) / 100,
      newCustomer: i % 10 < 7,
      touches: template.touches.map((touch, idx) => ({
        ...touch,
        timestamp: daysAgo(i % 26, 8 + idx * 3),
      })),
    });
  }
  return expanded;
}

/** Multi-touch journeys aligned with Peak Outfitters campaigns and landing pages. */
export function peakOutfittersAttributionEvents(): AttributionEvent[] {
  const events: AttributionEvent[] = [];
  const journeys = expandJourneys(BASE_JOURNEYS);

  for (const j of journeys) {
    const sessionId = `po-session-${j.orderId}`;
    j.touches.forEach((touch, i) => {
      events.push({
        sessionId,
        orderId: i === j.touches.length - 1 ? j.orderId : undefined,
        orderValue: i === j.touches.length - 1 ? j.value : undefined,
        isNewCustomer: i === j.touches.length - 1 ? j.newCustomer : undefined,
        sessionDurationSec: 120 + i * 45,
        ...touch,
      });
    });
  }

  return events;
}
