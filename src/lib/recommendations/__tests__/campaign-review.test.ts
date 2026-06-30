import { describe, expect, it } from "vitest";
import {
  campaignNeedsReview,
  campaignWeeklyRecoveryRange,
  formatCampaignReviewImpact,
  resolveCampaignFromSnapshot,
  resolveHistoryCampaignStatus,
} from "@/lib/recommendations/campaign-review";
import { evaluateCampaignByObjective } from "@/lib/recommendations/campaign-evaluation";
import { classifyCampaignObjective } from "@/lib/meta/campaign-objectives";
import {
  formatMetaEffectiveStatusLabel,
  META_EFFECTIVE_STATUS_LABELS,
} from "@/lib/meta/campaign-status";

const baseCampaign = {
  id: "act_1:1",
  name: "Test",
  effectiveStatus: "ACTIVE" as const,
  metaEffectiveStatus: "ACTIVE",
  spend7d: 100,
  impressions7d: 1000,
  revenue7d: 80,
  roas7d: 0.8,
  frequency7d: 2,
  ctr7d: 1.2,
  platform: "meta_ads" as const,
  adAccountId: "act_1",
  status: "ACTIVE" as const,
};

describe("classifyCampaignObjective", () => {
  it("maps Meta sales objectives", () => {
    expect(classifyCampaignObjective({ ...baseCampaign, objective: "OUTCOME_SALES" })).toBe("sales");
  });

  it("maps brand awareness objectives", () => {
    expect(classifyCampaignObjective({ ...baseCampaign, objective: "BRAND_AWARENESS" })).toBe(
      "brand_awareness",
    );
  });

  it("maps video objectives", () => {
    expect(classifyCampaignObjective({ ...baseCampaign, objective: "VIDEO_VIEWS" })).toBe(
      "video_views",
    );
  });
});

describe("evaluateCampaignByObjective", () => {
  it("flags sales campaigns on low ROAS with an objective-specific why", () => {
    const evaluation = evaluateCampaignByObjective({
      ...baseCampaign,
      objective: "OUTCOME_SALES",
    });
    expect(evaluation.needsReview).toBe(true);
    expect(evaluation.objective).toBe("sales");
    expect(evaluation.why).toContain("Sales");
    expect(evaluation.why).toContain("ROAS");
  });

  it("does not flag brand awareness campaigns solely for low ROAS", () => {
    const evaluation = evaluateCampaignByObjective({
      ...baseCampaign,
      objective: "BRAND_AWARENESS",
      revenue7d: 0,
      roas7d: 0,
      spend7d: 120,
      impressions7d: 25000,
      frequency7d: 2.2,
      reach7d: 11000,
    });
    expect(evaluation.needsReview).toBe(false);
    expect(evaluation.issues.some((i) => i.metric === "ROAS")).toBe(false);
  });

  it("flags brand awareness when CPM and frequency are poor", () => {
    const evaluation = evaluateCampaignByObjective({
      ...baseCampaign,
      objective: "OUTCOME_AWARENESS",
      revenue7d: 0,
      roas7d: 0,
      spend7d: 300,
      impressions7d: 4000,
      frequency7d: 6.2,
      reach7d: 650,
    });
    expect(evaluation.needsReview).toBe(true);
    expect(evaluation.why).toContain("Brand Awareness");
    expect(evaluation.issues.some((i) => i.metric === "CPM" || i.metric === "Frequency")).toBe(
      true,
    );
  });

  it("evaluates video campaigns on views and completion, not ROAS", () => {
    const evaluation = evaluateCampaignByObjective({
      ...baseCampaign,
      objective: "VIDEO_VIEWS",
      revenue7d: 0,
      roas7d: 0,
      spend7d: 150,
      impressions7d: 12000,
      videoViews7d: 800,
      thruPlay7d: 40,
    });
    expect(evaluation.needsReview).toBe(true);
    expect(evaluation.why).toContain("Video Views");
    expect(evaluation.issues.some((i) => i.metric === "Completion Rate")).toBe(true);
  });

  it("evaluates lead campaigns on CPL", () => {
    const evaluation = evaluateCampaignByObjective({
      ...baseCampaign,
      objective: "OUTCOME_LEADS",
      revenue7d: 0,
      roas7d: 0,
      spend7d: 200,
      impressions7d: 15000,
      clicks7d: 120,
      leads7d: 2,
    });
    expect(evaluation.needsReview).toBe(true);
    expect(evaluation.issues.some((i) => i.metric === "CPL")).toBe(true);
  });
});

describe("campaignNeedsReview", () => {
  it("flags low ROAS sales campaigns with enough delivery data", () => {
    expect(campaignNeedsReview({ ...baseCampaign, objective: "OUTCOME_SALES" })).toBe(true);
  });

  it("does not flag healthy engagement campaigns with spend but no revenue", () => {
    expect(
      campaignNeedsReview({
        ...baseCampaign,
        objective: "OUTCOME_ENGAGEMENT",
        revenue7d: 0,
        roas7d: 0,
        spend7d: 80,
        impressions7d: 5000,
        ctr7d: 1.1,
        frequency7d: 1.4,
      }),
    ).toBe(false);
  });

  it("skips campaigns with negligible spend", () => {
    expect(
      campaignNeedsReview({
        ...baseCampaign,
        spend7d: 10,
        revenue7d: 5,
        impressions7d: 100,
      }),
    ).toBe(false);
  });
});

describe("campaignWeeklyRecoveryRange", () => {
  it("returns null when recovery rounds to zero", () => {
    expect(campaignWeeklyRecoveryRange(1)).toBeNull();
  });
});

describe("formatMetaEffectiveStatusLabel", () => {
  it("uses Meta Ads Manager labels", () => {
    expect(formatMetaEffectiveStatusLabel("ACTIVE")).toBe("Active");
    expect(formatMetaEffectiveStatusLabel("CAMPAIGN_PAUSED")).toBe("Campaign paused");
    expect(formatMetaEffectiveStatusLabel("ADSET_PAUSED")).toBe("Ad set paused");
    expect(formatMetaEffectiveStatusLabel("PENDING_REVIEW")).toBe("In review");
  });

  it("documents all known Meta statuses", () => {
    expect(Object.keys(META_EFFECTIVE_STATUS_LABELS).length).toBeGreaterThanOrEqual(10);
  });
});

describe("formatCampaignReviewImpact", () => {
  it("returns objective-specific guidance for awareness campaigns", () => {
    const text = formatCampaignReviewImpact({
      ...baseCampaign,
      objective: "BRAND_AWARENESS",
      revenue7d: 0,
      roas7d: 0,
      spend7d: 300,
      impressions7d: 4000,
      frequency7d: 6.2,
      reach7d: 650,
    });
    expect(text).toContain("reach");
    expect(text.toLowerCase()).not.toContain("recover $");
  });

  it("never returns a zero recovery range", () => {
    const text = formatCampaignReviewImpact({
      ...baseCampaign,
      objective: "OUTCOME_SALES",
      revenue7d: 0,
      roas7d: 0,
      spend7d: 120,
      impressions7d: 8000,
    });
    expect(text).not.toContain("$0–$0");
    expect(text.length).toBeGreaterThan(10);
  });

  it("describes low spend campaigns", () => {
    const text = formatCampaignReviewImpact({
      ...baseCampaign,
      revenue7d: 0,
      roas7d: 0,
      spend7d: 1,
      impressions7d: 500,
    });
    expect(text).toContain("$1");
  });
});

describe("resolveCampaignFromSnapshot", () => {
  const campaigns = [
    {
      ...baseCampaign,
      id: "act_123:999",
      name: "Yeni Etkileşim Kampanyası",
      effectiveStatus: "PAUSED" as const,
      metaEffectiveStatus: "CAMPAIGN_PAUSED",
      status: "PAUSED" as const,
    },
    {
      ...baseCampaign,
      id: "act_123:100",
      name: "Active Promo",
      metaEffectiveStatus: "ACTIVE",
    },
  ];

  it("resolves by entity id before title", () => {
    const campaign = resolveCampaignFromSnapshot(campaigns, {
      entityId: "act_123:999",
      title: "Campaign Needs Review — Active Promo",
    });
    expect(campaign?.metaEffectiveStatus).toBe("CAMPAIGN_PAUSED");
  });

  it("resolves camp- prefixed dedupe keys", () => {
    const campaign = resolveCampaignFromSnapshot(campaigns, {
      entityId: "camp-act_123:100",
    });
    expect(campaign?.name).toBe("Active Promo");
  });

  it("resolves by Turkish campaign name from title", () => {
    const campaign = resolveCampaignFromSnapshot(campaigns, {
      entityId: "wrong-id",
      title: "Campaign Needs Review — Yeni Etkileşim Kampanyası",
    });
    expect(campaign?.metaEffectiveStatus).toBe("CAMPAIGN_PAUSED");
  });
});

describe("resolveHistoryCampaignStatus", () => {
  it("returns Meta label from live snapshot", () => {
    const result = resolveHistoryCampaignStatus(
      [
        {
          ...baseCampaign,
          id: "act_1:55",
          name: "Paused One",
          metaEffectiveStatus: "CAMPAIGN_PAUSED",
          effectiveStatus: "PAUSED",
          status: "PAUSED",
        },
      ],
      { entityId: "act_1:55", title: "Campaign Needs Review — Paused One" },
    );
    expect(result.campaignStatusLabel).toBe("Campaign paused");
  });

  it("falls back to stored evidence when campaign not in sync", () => {
    const result = resolveHistoryCampaignStatus(
      [],
      { entityId: "missing", title: "Campaign Needs Review — Old" },
      {
        id: "r1",
        category: "campaign_review",
        title: "Campaign Needs Review — Old",
        severity: "high",
        reason: "",
        expectedImpact: "",
        confidenceScore: 0.8,
        actionLabel: "Review",
        supportingMetrics: [{ label: "Status", value: "Ad set paused" }],
        createdAt: new Date().toISOString(),
      },
    );
    expect(result.campaignStatusLabel).toBe("Ad set paused");
  });
});
