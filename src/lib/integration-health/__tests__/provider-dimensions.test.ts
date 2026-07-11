import { describe, expect, it } from "vitest";
import type { IntegrationHealthCard } from "@/lib/integrations/health";
import {
  buildAiReadinessDimension,
  buildAuthenticationDimension,
  buildDataAvailabilityDimension,
} from "../provider-dimensions";

function card(overrides: Partial<IntegrationHealthCard>): IntegrationHealthCard {
  return {
    id: "shopify",
    label: "Shopify",
    status: "connected",
    dataMode: "live",
    syncFailed: false,
    metrics: [],
    ...overrides,
  };
}

describe("provider health dimensions", () => {
  it("authentication only reflects platform access", () => {
    expect(buildAuthenticationDimension(card({ status: "disconnected" }), false).label).toBe(
      "Not authorized",
    );
    expect(buildAuthenticationDimension(card({ status: "demo" }), true).label).toBe("Demo access");
    expect(
      buildAuthenticationDimension(card({ status: "connected" }), false).label,
    ).toBe("Token expired");
    expect(
      buildAuthenticationDimension(card({ status: "connected" }), true).label,
    ).toBe("Authorized");
  });

  it("data availability is separate from authentication", () => {
    const auth = buildAuthenticationDimension(card({ status: "connected" }), true);
    const data = buildDataAvailabilityDimension({
      card: card({ status: "connected", syncFailed: true }),
      entityChecks: [{ label: "Orders", value: "10", status: "synced" }],
      entityScore: 80,
      dataFreshness: "fresh",
      dataQualityPct: 80,
    });
    expect(auth.label).toBe("Authorized");
    expect(data.label).toBe("Sync interrupted");
  });

  it("ai readiness depends on auth and data but uses its own label", () => {
    const auth = buildAuthenticationDimension(card({ status: "disconnected" }), false);
    const data = buildDataAvailabilityDimension({
      card: card({ status: "disconnected" }),
      entityChecks: [],
      entityScore: 0,
      dataFreshness: "unknown",
      dataQualityPct: 0,
    });
    const ai = buildAiReadinessDimension({
      card: card({ status: "disconnected" }),
      validation: undefined,
      entityScore: 0,
      dataDimension: data,
      authenticationDimension: auth,
    });
    expect(ai.label).toBe("Not ready");
    expect(ai.label).not.toBe(auth.label);
    expect(ai.label).not.toBe(data.label);
  });
});
