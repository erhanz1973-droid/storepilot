import { describe, expect, it } from "vitest";
import {
  buildCampaignMetaDetails,
  formatMetaBudget,
  formatMetaObjectiveLabel,
  formatMetaStatusLabel,
  computeCampaignDurationDays,
  inferScheduledDurationDays,
  formatCampaignDuration,
} from "@/lib/meta/campaign-details";
import type { MetaCampaign } from "@/lib/connectors/types";

const messagingCampaign: MetaCampaign = {
  id: "act_1:99",
  name: "Yeni Etkileşim Kampanyası",
  status: "ACTIVE",
  effectiveStatus: "ACTIVE",
  metaEffectiveStatus: "ACTIVE",
  objective: "OUTCOME_ENGAGEMENT",
  destinationType: "MESSENGER",
  optimizationGoal: "CONVERSATIONS",
  dailyBudgetCents: 200,
  currency: "USD",
  startTime: "2026-06-01T00:00:00.000Z",
  stopTime: "2026-06-17T00:00:00.000Z",
  spend7d: 14,
  revenue7d: 0,
  roas7d: 0,
  ctr7d: 1,
  frequency7d: 1,
  impressions7d: 1000,
};

describe("formatMetaObjectiveLabel", () => {
  it("maps MESSAGES to Turkish Ads Manager label", () => {
    expect(formatMetaObjectiveLabel("MESSAGES", "tr")).toBe("Daha fazla mesaj al");
  });

  it("maps OUTCOME_ENGAGEMENT + Messenger destination to messaging label", () => {
    expect(
      formatMetaObjectiveLabel("OUTCOME_ENGAGEMENT", "tr", {
        destinationType: "MESSENGER",
        optimizationGoal: "CONVERSATIONS",
      }),
    ).toBe("Daha fazla mesaj al");
  });
});

describe("formatMetaBudget", () => {
  it("formats $2.00 for 200 cents in Turkish locale", () => {
    const formatted = formatMetaBudget(200, "USD", "tr");
    expect(formatted).toMatch(/2/);
  });
});

describe("computeCampaignDurationDays", () => {
  it("computes scheduled 16 days between start and stop", () => {
    expect(
      computeCampaignDurationDays(
        "2026-06-01T00:00:00.000Z",
        "2026-06-17T00:00:00.000Z",
      ),
    ).toBe(16);
  });

  it("uses elapsed days when stop is missing", () => {
    const days = computeCampaignDurationDays(
      new Date(Date.now() - 5 * 86400000).toISOString(),
      null,
    );
    expect(days).toBeGreaterThanOrEqual(5);
  });
});

describe("inferScheduledDurationDays", () => {
  it("infers 16 days from lifetime and daily budget when stop is missing", () => {
    expect(
      inferScheduledDurationDays({
        dailyBudgetCents: 200,
        lifetimeBudgetCents: 3200,
      }),
    ).toBe(16);
  });

  it("formats inferred duration in Turkish", () => {
    expect(
      formatCampaignDuration(null, null, "tr", {
        dailyBudgetCents: 200,
        lifetimeBudgetCents: 3200,
      }),
    ).toBe("16 gün");
  });
});

describe("buildCampaignMetaDetails", () => {
  it("builds Facebook-style detail rows in Turkish", () => {
    const details = buildCampaignMetaDetails(messagingCampaign, "tr");
    expect(details.statusLabel).toBe("Aktif");
    expect(details.objectiveLabel).toBe("Daha fazla mesaj al");
    expect(details.dailyBudgetLabel).toContain("2");
    expect(details.durationLabel).toBe("16 gün");
  });

  it("formats active status in Turkish", () => {
    expect(formatMetaStatusLabel("ACTIVE", "tr")).toBe("Aktif");
  });
});
