import { describe, expect, it } from "vitest";
import {
  formatMetaEffectiveStatusLabel,
  isMetaCampaignActive,
  isMetaCampaignPaused,
  META_CAMPAIGN_EFFECTIVE_STATUSES,
} from "@/lib/meta/campaign-status";

describe("meta campaign status", () => {
  it("lists Meta effective_status values", () => {
    expect(META_CAMPAIGN_EFFECTIVE_STATUSES).toContain("ACTIVE");
    expect(META_CAMPAIGN_EFFECTIVE_STATUSES).toContain("CAMPAIGN_PAUSED");
    expect(META_CAMPAIGN_EFFECTIVE_STATUSES).toContain("ADSET_PAUSED");
    expect(META_CAMPAIGN_EFFECTIVE_STATUSES).toContain("PENDING_REVIEW");
  });

  it("detects only ACTIVE as delivering", () => {
    expect(isMetaCampaignActive("ACTIVE")).toBe(true);
    expect(isMetaCampaignActive("CAMPAIGN_PAUSED")).toBe(false);
    expect(isMetaCampaignPaused("CAMPAIGN_PAUSED")).toBe(true);
    expect(isMetaCampaignPaused("ADSET_PAUSED")).toBe(true);
    expect(isMetaCampaignPaused("PAUSED")).toBe(true);
  });

  it("maps Facebook labels", () => {
    expect(formatMetaEffectiveStatusLabel("WITH_ISSUES")).toBe("With issues");
  });
});
