import { describe, expect, it } from "vitest";
import {
  buildExecutiveNotes,
  buildExecutivePlannedDecisions,
  buildExecutivePlannedSection,
  buildExecutiveRiskStory,
  resolveExecutiveMode,
  type ExecutiveCeoDailyDecision,
} from "@/lib/analytics/build-executive-ceo-os";
import { DECISION_IMPACT_COPY } from "@/lib/impact/decision-impact";
import type { DailyAiPlaybook } from "@/lib/analytics/ai-daily-playbook";

function emptyDecision(overrides?: Partial<ExecutiveCeoDailyDecision>): ExecutiveCeoDailyDecision {
  return {
    hasDecision: false,
    emptyMessage: "No executive decision required today.",
    emptyDetail: "Business operating normally.",
    title: "No executive decision required today",
    action: "No executive decision required today.",
    narrative: "Business operating normally.",
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
    ...overrides,
  };
}

function actionDecision(): ExecutiveCeoDailyDecision {
  return emptyDecision({
    hasDecision: true,
    title: "Today's #1 executive decision",
    action: "Reduce Prospecting Broad",
    narrative: "Prospecting Broad is leaking spend.",
    ceoOpinion: "Act on Prospecting Broad first.",
    impactPresentation: {
      heroLabel: DECISION_IMPACT_COPY.heroLabel,
      heroAmount: 5899,
      heroValueFormatted: "$5,899",
      heroTooltip: DECISION_IMPACT_COPY.heroTooltip,
      netProfitLabel: DECISION_IMPACT_COPY.netProfitImprovement,
      netProfitAmount: 636,
      netProfitFormatted: "+$636/month",
      confidencePct: 92,
      showNetProfitSecondary: true,
      waterfall: [],
      waterfallNarrative: "",
    },
    estimatedMinutes: 10,
    risk: "Low Risk",
  });
}

const playbook: DailyAiPlaybook = {
  title: "Daily playbook",
  subtitle: "Test",
  totalRecoverableMonthly: 9988,
  items: [
    {
      rank: 1,
      id: "a",
      module: "marketing",
      roleLabel: "Ads",
      moduleHref: "/marketing",
      title: "Reduce Prospecting Broad",
      impactLabel: "+$5,899/mo",
      impactMonthly: 5899,
      confidence: "High",
      approvalHref: "/approvals",
      dedupKey: "a",
    },
    {
      rank: 2,
      id: "b",
      module: "marketing",
      roleLabel: "Ads",
      moduleHref: "/marketing",
      title: "Reallocate Retargeting",
      impactLabel: "+$2,154/mo",
      impactMonthly: 2154,
      confidence: "Med",
      approvalHref: "/approvals",
      dedupKey: "b",
    },
    {
      rank: 3,
      id: "c",
      module: "profit",
      roleLabel: "Profit",
      moduleHref: "/profit",
      title: "Margin review",
      impactLabel: "+$1,935/mo",
      impactMonthly: 1935,
      confidence: "Med",
      approvalHref: "/approvals",
      dedupKey: "c",
    },
  ],
};

describe("executive mode consistency", () => {
  it("NO_ACTION: story has no leakage dollars; notes deny intervention; planned is optional", () => {
    const mode = resolveExecutiveMode({
      hasDecision: false,
      materialThreatMonthly: 7274,
      opportunityCount: 0,
    });
    // Threat exists but does not clear eligibility → OBSERVE
    expect(mode).toBe("OBSERVE");

    const modeFromOpps = resolveExecutiveMode({
      hasDecision: false,
      materialThreatMonthly: 0,
      opportunityCount: 5,
    });
    expect(modeFromOpps).toBe("OBSERVE");

    const trueNoAction = resolveExecutiveMode({
      hasDecision: false,
      materialThreatMonthly: 0,
      opportunityCount: 0,
    });
    expect(trueNoAction).toBe("NO_ACTION");

    const decision = emptyDecision();
    const story = buildExecutiveRiskStory({
      mode: trueNoAction,
      decision,
      threatLabel: "Wasted ad spend",
      threatAmountMonthly: 7274,
    });
    const notes = buildExecutiveNotes(trueNoAction, decision);
    const plannedSection = buildExecutivePlannedSection(trueNoAction);
    const planned = buildExecutivePlannedDecisions(playbook, trueNoAction);

    expect(story.showFinancialLeakage).toBe(false);
    expect(story.story).not.toMatch(/\$7,?274/);
    expect(story.story).not.toMatch(/leaking/i);
    expect(notes.headline).toMatch(/does not require executive intervention/i);
    expect(notes.body).not.toMatch(/one decision/i);
    expect(plannedSection.title).toBe("Future Optimization Opportunities");
    expect(plannedSection.kind).toBe("optimization");
    expect(planned.every((p) => p.kind === "optimization")).toBe(true);
  });

  it("OBSERVE: never frames sub-threshold leakage as the executive story", () => {
    const decision = emptyDecision();
    const story = buildExecutiveRiskStory({
      mode: "OBSERVE",
      decision,
      threatLabel: "Wasted ad spend",
      threatAmountMonthly: 7274,
      scan: {
        campaignsScanned: 17,
        potentialOpportunities: 5,
        thresholdCurrent: 61,
        thresholdRequired: 75,
      },
    });
    expect(story.showFinancialLeakage).toBe(false);
    expect(story.story).not.toMatch(/7,?274/);
    expect(story.sections.some((s) => /Executive Action Threshold/i.test(s.body))).toBe(true);
    expect(story.headline).toMatch(/Building Evidence/i);
  });

  it("ACTION_REQUIRED: story explains THAT decision with matching hero/net", () => {
    const decision = actionDecision();
    const mode = resolveExecutiveMode({
      hasDecision: true,
      businessRecovery: 5899,
      riskLabel: "Low Risk",
    });
    expect(mode).toBe("ACTION_REQUIRED");

    const story = buildExecutiveRiskStory({
      mode,
      decision,
      threatLabel: "Wasted ad spend",
      threatAmountMonthly: 7274,
    });
    const notes = buildExecutiveNotes(mode, decision);
    const plannedSection = buildExecutivePlannedSection(mode);
    const planned = buildExecutivePlannedDecisions(playbook, mode, decision.action);

    expect(story.showFinancialLeakage).toBe(true);
    expect(story.sections.map((s) => s.label)).toEqual([
      "Problem",
      "Recommended Action",
      "Recoverable Opportunity",
      "Expected Net Profit",
    ]);
    expect(story.sections[1]?.body).toBe("Reduce Prospecting Broad");
    expect(story.sections[2]?.body).toContain("5,899");
    expect(story.sections[3]?.body).toContain("636");
    expect(notes.headline).toContain("Reduce Prospecting Broad");
    expect(notes.body).toMatch(/everything else can wait/i);
    expect(plannedSection.title).toBe("Planned for later");
    expect(planned.map((p) => p.title)).not.toContain("Reduce Prospecting Broad");
    expect(planned[0]?.plannedLabel).toBe("Tomorrow");
  });

  it("CRITICAL when high risk + large recovery", () => {
    expect(
      resolveExecutiveMode({
        hasDecision: true,
        riskLabel: "High Risk",
        businessRecovery: 12_000,
      }),
    ).toBe("CRITICAL");
  });
});
