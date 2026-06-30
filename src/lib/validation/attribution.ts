import type { StoreSnapshot } from "@/lib/connectors/types";
import { computeAttributionConfidence } from "@/lib/attribution/confidence";
import { buildCustomerJourneys } from "@/lib/attribution/journeys";
import { synthesizeAttributionEvents } from "@/lib/attribution/touchpoints";
import { ga4ToAttributionEvents } from "@/lib/integrations/ga4-events";
import { demoGA4Snapshot } from "@/lib/integrations/demo-data";
import { DEMO_STORE_SNAPSHOT } from "@/lib/connectors/demo-data";
import type { ValidationCheck } from "./types";

type AttributionScenario = {
  id: string;
  name: string;
  buildSnapshot: () => StoreSnapshot;
  buildEvents: (s: StoreSnapshot) => ReturnType<typeof synthesizeAttributionEvents>;
  hasExplicitEvents: boolean;
  expectedMinLevel: "High" | "Medium" | "Low";
  expectedMaxLevel?: "High" | "Medium" | "Low";
};

const LEVEL_RANK = { Low: 0, Medium: 1, High: 2 };

function levelOk(
  actual: "High" | "Medium" | "Low",
  min: "High" | "Medium" | "Low",
  max?: "High" | "Medium" | "Low",
): boolean {
  const a = LEVEL_RANK[actual];
  if (a < LEVEL_RANK[min]) return false;
  if (max && a > LEVEL_RANK[max]) return false;
  return true;
}

const SCENARIOS: AttributionScenario[] = [
  {
    id: "complete-utm",
    name: "Complete UTM + GA4 tracking",
    buildSnapshot: () => ({
      ...DEMO_STORE_SNAPSHOT,
      ga4Snapshot: demoGA4Snapshot(),
      connectorStates: { shopify: "connected", meta_ads: "connected" },
    }),
    buildEvents: (s) =>
      s.ga4Snapshot
        ? ga4ToAttributionEvents(s.ga4Snapshot)
        : synthesizeAttributionEvents(s.campaigns, s.storeMetrics.revenue30d, s.storeMetrics.orders30d),
    hasExplicitEvents: true,
    expectedMinLevel: "High",
  },
  {
    id: "missing-utm",
    name: "Missing UTM — inferred journeys",
    buildSnapshot: () => ({
      ...DEMO_STORE_SNAPSHOT,
      connectorStates: { shopify: "connected", meta_ads: "connected" },
    }),
    buildEvents: (s) =>
      synthesizeAttributionEvents(s.campaigns, s.storeMetrics.revenue30d, s.storeMetrics.orders30d),
    hasExplicitEvents: false,
    expectedMinLevel: "Medium",
    expectedMaxLevel: "Medium",
  },
  {
    id: "missing-meta",
    name: "Missing Meta data",
    buildSnapshot: () => ({
      ...DEMO_STORE_SNAPSHOT,
      campaigns: [],
      connectorStates: { shopify: "connected", meta_ads: "disconnected" },
    }),
    buildEvents: (s) =>
      synthesizeAttributionEvents(s.campaigns, s.storeMetrics.revenue30d, s.storeMetrics.orders30d),
    hasExplicitEvents: false,
    expectedMinLevel: "Low",
    expectedMaxLevel: "Medium",
  },
  {
    id: "organic-only",
    name: "Organic purchases (no ads)",
    buildSnapshot: () => ({
      ...DEMO_STORE_SNAPSHOT,
      campaigns: [],
      connectorStates: { shopify: "demo", meta_ads: "disconnected" },
    }),
    buildEvents: () => [
      {
        sessionId: "org-1",
        timestamp: new Date().toISOString(),
        channelId: "organic_search" as const,
        channelLabel: "Google Organic",
        source: "Google Organic",
        orderValue: 78,
      },
    ],
    hasExplicitEvents: true,
    expectedMinLevel: "Low",
    expectedMaxLevel: "Low",
  },
  {
    id: "multi-touch",
    name: "Multi-touch journeys",
    buildSnapshot: () => DEMO_STORE_SNAPSHOT,
    buildEvents: (s) =>
      synthesizeAttributionEvents(s.campaigns, s.storeMetrics.revenue30d, s.storeMetrics.orders30d),
    hasExplicitEvents: false,
    expectedMinLevel: "Medium",
  },
];

export function validateAttributionConfidence(): ValidationCheck[] {
  return SCENARIOS.map((scenario) => {
    const snapshot = scenario.buildSnapshot();
    const events = scenario.buildEvents(snapshot);
    const journeys = buildCustomerJourneys(events);
    const confidence = computeAttributionConfidence(
      snapshot,
      journeys,
      scenario.hasExplicitEvents,
    );

    const ok = levelOk(
      confidence.level,
      scenario.expectedMinLevel,
      scenario.expectedMaxLevel,
    );

    const neverHighWhenIncomplete =
      scenario.expectedMaxLevel === "Low" ? confidence.level !== "High" : true;

    const pass = ok && neverHighWhenIncomplete;

    return {
      id: `attribution-${scenario.id}`,
      suite: "attribution",
      name: scenario.name,
      status: pass ? "pass" : "fail",
      expected: scenario.expectedMaxLevel
        ? `${scenario.expectedMinLevel}–${scenario.expectedMaxLevel}`
        : `≥ ${scenario.expectedMinLevel}`,
      actual: `${confidence.level} (${confidence.scorePct}%)`,
      message: pass
        ? `Confidence ${confidence.level} behaves as expected`
        : `Unexpected confidence ${confidence.level} — ${confidence.reason}`,
    };
  });
}
