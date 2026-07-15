import { describe, expect, it } from "vitest";
import { buildExecutiveBrief, type ExecutiveCeoDailyDecision } from "@/lib/analytics/build-executive-ceo-os";
import { DECISION_IMPACT_COPY } from "@/lib/impact/decision-impact";

const emptyDecision: ExecutiveCeoDailyDecision = {
  hasDecision: false,
  emptyMessage: "No executive decision required today.",
  emptyDetail: "Operating normally.",
  title: "No executive decision required today",
  action: "No action",
  narrative: "Operating normally.",
  ceoOpinion: "Continue monitoring.",
  impactPresentation: {
    heroLabel: DECISION_IMPACT_COPY.heroLabel,
    heroAmount: 0,
    heroValueFormatted: "$0",
    heroTooltip: DECISION_IMPACT_COPY.heroTooltip,
    netProfitLabel: DECISION_IMPACT_COPY.netProfitImprovement,
    netProfitAmount: 0,
    netProfitFormatted: "$0/month",
    confidencePct: 0,
    showNetProfitSecondary: false,
    waterfall: [],
    waterfallNarrative: "",
  },
  estimatedMinutes: 0,
  risk: "Low Risk",
  evidence: null,
  evidencePoints: [],
  approvalHref: "/approvals",
};

describe("Executive Brief", () => {
  it("builds a brief with greeting, sources, and findings for NO_ACTION mode", () => {
    const brief = buildExecutiveBrief({
      mode: "NO_ACTION",
      domains: [
        { label: "Profit", status: "watching" },
        { label: "Advertising", status: "watching" },
      ],
      connectedSources: { shopify: true, metaAds: true, googleAds: false, ga4: false },
      campaignsScanned: 17,
      potentialOpportunities: 0,
      biggestThreat: { label: "", amountMonthly: 0 },
      bestOpportunity: { label: "", amountMonthly: 0 },
      estimatedProfit: 0,
      priorityAction: null,
      dailyDecision: emptyDecision,
      businessHealthLabel: "Healthy",
    });

    expect(brief.greeting).toMatch(/^Good (morning|afternoon|evening)\.$/);
    expect(brief.introLine).toMatch(/Shopify/);
    expect(brief.introLine).toMatch(/Meta Ads/);
    expect(brief.introLine).not.toMatch(/Google Ads/);
    expect(brief.analyzedSources.find((s) => s.label === "Shopify")?.connected).toBe(true);
    expect(brief.analyzedSources.find((s) => s.label === "Google Ads")?.connected).toBe(false);
    expect(brief.findings.length).toBeGreaterThanOrEqual(2);
    expect(brief.findings.some((f) => /17 campaigns/i.test(f))).toBe(true);
    expect(brief.primaryConcern.actionRequired).toBe(false);
    expect(brief.primaryConcern.headline).toMatch(/no material concerns/i);
    expect(brief.expectedOutcome.amountFormatted).toBeNull();
  });

  it("builds a brief with action-required concern when mode is ACTION_REQUIRED", () => {
    const actionDecision: ExecutiveCeoDailyDecision = {
      ...emptyDecision,
      hasDecision: true,
      action: "Reduce Prospecting Broad",
      impactPresentation: {
        ...emptyDecision.impactPresentation,
        heroAmount: 10473,
        heroValueFormatted: "$10,473",
      },
    };

    const brief = buildExecutiveBrief({
      mode: "ACTION_REQUIRED",
      domains: [{ label: "Advertising", status: "analyzing" }],
      connectedSources: { shopify: true, metaAds: true, googleAds: true, ga4: true },
      campaignsScanned: 17,
      potentialOpportunities: 5,
      biggestThreat: { label: "Prospecting Broad", amountMonthly: 10473 },
      bestOpportunity: { label: "Reduce Prospecting Broad", amountMonthly: 10473 },
      estimatedProfit: 10473,
      priorityAction: {
        title: "Reduce Prospecting Broad spend",
        description: "Reduce spend on Prospecting Broad campaign.",
        impactLabel: "+$10,473/mo",
        confidencePct: 92,
        risk: { label: "Low Risk", score: 1 },
        impactMonthly: 10473,
        netProfitMonthly: 5000,
        suggestedAction: "reduce Prospecting Broad spend by 40% and redirect toward Google Shopping",
        whyThisMatters: {
          currentSituation: "Prospecting Broad leaking $10k/month.",
          businessImpact: "Redirect budget toward high-ROAS channels.",
        },
      } as any,
      dailyDecision: actionDecision,
      businessHealthLabel: "Healthy",
    });

    expect(brief.primaryConcern.actionRequired).toBe(true);
    expect(brief.primaryConcern.headline).toMatch(/Prospecting Broad/i);
    expect(brief.primaryConcern.body).toMatch(/10,473/);
    expect(brief.aiRecommendation).toMatch(/reduce Prospecting Broad/i);
    expect(brief.expectedOutcome.amountFormatted).toBe("$10,473");
    expect(brief.expectedOutcome.label).toMatch(/profit opportunity/i);
  });

  it("builds a brief with observing concern when mode is OBSERVE", () => {
    const brief = buildExecutiveBrief({
      mode: "OBSERVE",
      domains: [],
      connectedSources: { shopify: true, metaAds: true },
      campaignsScanned: 17,
      potentialOpportunities: 5,
      biggestThreat: { label: "", amountMonthly: 0 },
      bestOpportunity: { label: "Summer Hiking", amountMonthly: 800 },
      estimatedProfit: 800,
      priorityAction: null,
      dailyDecision: emptyDecision,
      businessHealthLabel: "Good",
      observingCampaignName: "Summer Hiking",
    });

    expect(brief.primaryConcern.actionRequired).toBe(false);
    expect(brief.primaryConcern.headline).toBe("Summer Hiking");
    expect(brief.primaryConcern.body).toMatch(/underperforming/i);
    expect(brief.aiRecommendation).toMatch(/continue monitoring/i);
    expect(brief.expectedOutcome.amountFormatted).toBeNull();
    expect(brief.expectedOutcome.detail).toMatch(/below the Executive Decision Threshold/i);
  });

  it("includes all analyzed sources in intro when all connected", () => {
    const brief = buildExecutiveBrief({
      mode: "NO_ACTION",
      domains: [],
      connectedSources: {
        shopify: true,
        metaAds: true,
        googleAds: true,
        ga4: true,
        inventory: true,
        customers: true,
      },
      campaignsScanned: 10,
      potentialOpportunities: 0,
      biggestThreat: { label: "", amountMonthly: 0 },
      bestOpportunity: { label: "", amountMonthly: 0 },
      estimatedProfit: 0,
      priorityAction: null,
      dailyDecision: emptyDecision,
      businessHealthLabel: "Healthy",
    });

    expect(brief.introLine).toMatch(/Shopify/);
    expect(brief.introLine).toMatch(/Meta Ads/);
    expect(brief.introLine).toMatch(/Google Ads/);
    expect(brief.introLine).toMatch(/GA4/);
    expect(brief.introLine).toMatch(/Inventory/);
    expect(brief.introLine).toMatch(/Customers/);
  });
});
