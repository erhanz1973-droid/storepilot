import { describe, expect, it } from "vitest";
import { buildDeepAiExecutiveBrief } from "@/lib/analytics/deep-ai-brief";
import { resolveExecutiveMode } from "@/lib/analytics/build-executive-ceo-os";
import {
  EXECUTIVE_ACTION_THRESHOLD_PCT,
  executiveReadinessPct,
  peekExecutiveActionThreshold,
  type ExecutiveCandidate,
} from "@/lib/analytics/executive-decision-ranking";

describe("Executive Mode × Deep AI consistency", () => {
  it("NO_ACTION when nothing to observe — Deep AI reports no material issues", () => {
    const mode = resolveExecutiveMode({
      hasDecision: false,
      materialThreatMonthly: 0,
      opportunityCount: 0,
    });
    expect(mode).toBe("NO_ACTION");

    const brief = buildDeepAiExecutiveBrief({
      mode,
      campaignsScanned: 17,
      potentialOpportunities: 0,
      executiveCandidates: 0,
    });
    expect(brief.headline).toMatch(/no material issues/i);
    expect(brief.summary).toMatch(/17 campaigns scanned/i);
    expect(brief.summary).not.toMatch(/deep ai active/i);
    expect(brief.whyNoAction).toMatch(/no executive action required/i);
  });

  it("OBSERVE when opportunities exist but none are executive candidates", () => {
    const mode = resolveExecutiveMode({
      hasDecision: false,
      materialThreatMonthly: 0,
      opportunityCount: 5,
    });
    expect(mode).toBe("OBSERVE");

    const brief = buildDeepAiExecutiveBrief({
      mode,
      campaignsScanned: 17,
      potentialOpportunities: 5,
      executiveCandidates: 0,
      observingCampaignName: "Summer Hiking",
      thresholdPeek: {
        title: "Summer Hiking",
        readinessPct: 61,
        requiredPct: EXECUTIVE_ACTION_THRESHOLD_PCT,
        eligible: false,
        clearsThreshold: false,
      },
    });

    expect(brief.headline).toMatch(/building evidence/i);
    expect(brief.potentialOpportunities).toBe(5);
    expect(brief.executiveCandidates).toBe(0);
    expect(brief.whyNoAction).toMatch(/Executive Action Threshold/i);
    expect(brief.whyNoAction).toMatch(/61\/75/);
    expect(brief.threshold?.message).toMatch(/not yet strong enough/i);
    expect(brief.observingCampaignName).toBe("Summer Hiking");
  });

  it("ACTION_REQUIRED Deep AI says confidence threshold exceeded", () => {
    const brief = buildDeepAiExecutiveBrief({
      mode: "ACTION_REQUIRED",
      campaignsScanned: 17,
      potentialOpportunities: 5,
      executiveCandidates: 1,
      hasDecisionAction: "Reduce Prospecting Broad",
    });
    expect(brief.headline).toMatch(/executive action recommended/i);
    expect(brief.summary).toMatch(/Reduce Prospecting Broad/);
    expect(brief.whyNoAction).toBeNull();
  });

  it("peek threshold surfaces readiness below bar for weak candidates", () => {
    const weak: ExecutiveCandidate = {
      id: "1",
      title: "Summer Hiking tweak",
      description: "Minor",
      impactLabel: "Review campaign",
      confidencePct: 55,
      priority: "low",
      risk: "medium",
    };
    const peek = peekExecutiveActionThreshold([weak]);
    expect(peek).not.toBeNull();
    expect(peek!.clearsThreshold).toBe(false);
    expect(peek!.readinessPct).toBeLessThan(EXECUTIVE_ACTION_THRESHOLD_PCT);

    const impact = {
      businessRecovery: 0,
      recoverableWaste: null,
      recoverableRevenue: null,
      revenueRecovered: null,
      advertisingSavings: null,
      advertisingSavingsLow: null,
      advertisingSavingsHigh: null,
      grossProfitImpact: 0,
      netProfitImpact: 0,
      cashFlowImpact: 0,
      monthlyProfitRecovery: 0,
      expectedProfit: 0,
      expectedROAS: null,
      paybackDays: null,
      confidence: 55,
      campaignCount: null,
      observationPeriodDays: null,
      sourceAmount: 0,
      alreadyProfitLabeled: false,
      sourceLabel: "",
    };
    expect(executiveReadinessPct(impact, weak)).toBeLessThan(EXECUTIVE_ACTION_THRESHOLD_PCT);
  });
});
