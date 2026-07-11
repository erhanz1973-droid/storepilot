import type { StoreSnapshot } from "@/lib/connectors/types";

export type Ga4FunnelOnboardingStep = {
  step: number;
  label: string;
  description: string;
  complete: boolean;
};

function hasVerifiedFunnelEvents(snapshot: StoreSnapshot): boolean {
  const events = snapshot.ga4Snapshot?.funnelEvents;
  return Boolean(events?.verified && events.productViews30d > 0);
}

export function buildGa4FunnelOnboardingSteps(snapshot: StoreSnapshot | null): Ga4FunnelOnboardingStep[] {
  const ga4Connected = Boolean(snapshot?.ga4Snapshot?.sessions30d);
  const eventsVerified = snapshot ? hasVerifiedFunnelEvents(snapshot) : false;

  return [
    {
      step: 1,
      label: "Connect GA4",
      description: "Link your Google Analytics 4 property",
      complete: ga4Connected,
    },
    {
      step: 2,
      label: "Verify ecommerce events",
      description: "Confirm view_item, add_to_cart, begin_checkout, and purchase fire correctly",
      complete: eventsVerified,
    },
    {
      step: 3,
      label: "Sync 30 days of history",
      description: "Import funnel event history for step-level drop-off analysis",
      complete: eventsVerified,
    },
    {
      step: 4,
      label: "Step-level funnel unlocked",
      description: "StorePilot maps abandonment at each funnel stage",
      complete: eventsVerified,
    },
  ];
}

export function ga4FunnelOnboardingComplete(snapshot: StoreSnapshot | null): boolean {
  return snapshot ? hasVerifiedFunnelEvents(snapshot) : false;
}
