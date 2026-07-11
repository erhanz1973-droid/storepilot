"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { EnrichedMarketingCampaign } from "@/lib/analytics/marketing-manager";
import {
  CAMPAIGN_HEALTH_LABELS,
  RECOMMENDATION_LABELS,
} from "@/lib/analytics/marketing-manager";
import type { MarketingBudgetAllocation, MarketingManagerV2 } from "@/lib/analytics/marketing-manager-v2";
import { estimateCampaignRecovery } from "@/lib/analytics/recovery-engine";
import {
  FINANCIAL_IMPACT_LABELS,
  type ExecutivePriorityItem,
  type MarketingExecutiveLayer,
  type SimulatorBaseline,
} from "@/lib/analytics/marketing-executive-layer";
import { CrossModuleReference } from "@/components/executive/CrossModuleReference";
import { ProfitValue } from "./ProfitValue";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function MarketingFollowUpChips({ questions }: { questions: string[] }) {
  if (questions.length === 0) return null;
  return (
    <div className="mkt-dir-followups">
      <span className="muted mkt-dir-followups-label">Ask AI</span>
      <div className="mkt-dir-followup-chips">
        {questions.map((q) => (
          <Link
            key={q}
            href={`/ask-ai?q=${encodeURIComponent(q)}`}
            className="mkt-dir-followup-chip"
          >
            {q}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function MarketingExecutiveSummaryCard({
  executive,
}: {
  executive: MarketingExecutiveLayer;
}) {
  const { executiveSummary } = executive;
  return (
    <section className="card mkt-dir-summary">
      <h2 className="mkt-dir-section-title">{executiveSummary.headline}</h2>
      <div className="mkt-dir-summary-body">
        {executiveSummary.paragraphs.map((p) => (
          <p key={p} className="mkt-dir-summary-line">
            {p}
          </p>
        ))}
        <p className="mkt-dir-summary-priority">
          Today&apos;s highest priority is improving{" "}
          <strong>{executiveSummary.todayPriority}</strong>{" "}
          {executiveSummary.todayPriorityDetail.toLowerCase().includes("landing")
            ? "before increasing advertising spend."
            : `— ${executiveSummary.todayPriorityDetail}.`}
        </p>
      </div>
      <div className="mkt-dir-summary-impact">
        <span className="muted">Estimated monthly marketing improvement</span>
        <strong className="positive">+{fmt(executiveSummary.estimatedMonthlyImprovement)}</strong>
      </div>
    </section>
  );
}

export function MarketingChannelComparisonCard({
  comparison,
}: {
  comparison: MarketingExecutiveLayer["channelComparison"];
}) {
  if (!comparison) return null;

  return (
    <section className="card mkt-dir-channel-compare">
      <h3 style={{ marginTop: 0 }}>Channel Comparison</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
        Meta vs Google — winner highlighted per metric.
      </p>
      <div className="mkt-dir-compare-table">
        <div className="mkt-dir-compare-head">
          <span />
          <span className="mkt-dir-compare-col">Meta Ads</span>
          <span className="mkt-dir-compare-col">Google Ads</span>
        </div>
        {comparison.metrics.map((m) => (
          <div key={m.key} className="mkt-dir-compare-row">
            <span className="muted">{m.label}</span>
            <span className={m.winner === "meta" ? "mkt-dir-winner" : ""}>{m.metaValue}</span>
            <span className={m.winner === "google" ? "mkt-dir-winner" : ""}>{m.googleValue}</span>
          </div>
        ))}
      </div>
      <div className="mkt-dir-ai-rec">
        <span className="mkt-dir-ai-rec-label">AI Recommendation</span>
        <p>{comparison.aiRecommendation}</p>
        <span className="muted">
          Estimated monthly impact:{" "}
          <strong className="positive">+{fmt(comparison.estimatedMonthlyImpact)}</strong>
        </span>
      </div>
    </section>
  );
}

export function MarketingBudgetAllocationExecutive({
  allocation,
  reasons,
}: {
  allocation: MarketingBudgetAllocation;
  reasons: MarketingExecutiveLayer["budgetShiftReasons"];
}) {
  if (allocation.mode === "unavailable") {
    return (
      <section className="card mkt-dir-budget">
        <h3 style={{ marginTop: 0 }}>Budget Allocation</h3>
        <p className="muted" style={{ margin: 0 }}>
          {allocation.unavailableReason ?? allocation.rationale}
        </p>
      </section>
    );
  }

  return (
    <section className="card mkt-dir-budget">
      <h3 style={{ marginTop: 0 }}>Budget Allocation</h3>
      {allocation.mode === "single_channel" && (
        <p className="muted mkt-dir-budget-rationale">{allocation.rationale}</p>
      )}
      {allocation.mode === "cross_channel" && (
        <>
          <p className="muted mkt-dir-budget-rationale">{allocation.rationale}</p>
          <div className="mkt-dir-budget-reasons">
            <span className="muted">Why shift budget?</span>
            <div className="mkt-dir-reason-chips">
              {reasons.map((r) => (
                <span
                  key={r.id}
                  className={`mkt-dir-reason-chip ${r.active ? "active" : ""}`}
                >
                  {r.label}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
      <ul className="mkt-v2-budget-evidence">
        {allocation.evidence.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {allocation.mode === "cross_channel" && allocation.estimatedMonthlyImprovement > 0 && (
        <p className="mkt-dir-financial-impact">
          {FINANCIAL_IMPACT_LABELS.profit_recovery}:{" "}
          <strong className="positive">+{fmt(allocation.estimatedMonthlyImprovement)}/month</strong>
        </p>
      )}
    </section>
  );
}

export function MarketingStrengthsCard({
  strengths,
}: {
  strengths: MarketingExecutiveLayer["strengths"];
}) {
  if (strengths.length === 0) return null;
  return (
    <section className="card mkt-dir-strengths">
      <h3 style={{ marginTop: 0 }}>Marketing Strengths</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
        What is working — not just what needs fixing.
      </p>
      <ul className="mkt-dir-strengths-list">
        {strengths.map((s) => (
          <li key={s.id}>
            <strong>{s.label}</strong>
            <span>{s.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MarketingExecutivePriorityQueue({
  items,
  onSelect,
}: {
  items: ExecutivePriorityItem[];
  onSelect: (campaignId: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className="card mkt-dir-queue">
      <h3 style={{ marginTop: 0 }}>Campaign Priority Queue</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
        Ordered by financial impact — address in sequence.
      </p>
      <ol className="mkt-dir-queue-list">
        {items.map((item) => (
          <li key={item.campaignId} className="mkt-dir-queue-card">
            <button type="button" className="mkt-dir-queue-head" onClick={() => onSelect(item.campaignId)}>
              <span className="mkt-dir-queue-rank">{item.rankLabel}</span>
              <strong>{item.campaignName}</strong>
            </button>
            <div className="mkt-dir-queue-grid">
              <div>
                <span className="muted">Problem</span>
                <p>{item.problem}</p>
              </div>
              <div>
                <span className="muted">Root Cause</span>
                <p>{item.rootCause}</p>
              </div>
              <div>
                <span className="muted">Recommended Action</span>
                <p>{item.recommendedAction}</p>
              </div>
              <div>
                <span className="muted">{FINANCIAL_IMPACT_LABELS[item.financialImpactType]}</span>
                <strong className="positive">+{fmt(item.impactMonthly)}/month</strong>
              </div>
              <div>
                <span className="muted">Recovery Probability</span>
                <strong>{item.recoveryProbabilityPct}%</strong>
              </div>
              <div>
                <span className="muted">Estimated Time Until Results</span>
                <strong>{item.timeUntilResults}</strong>
              </div>
            </div>
            {item.inactionAmountMonthly != null && (
              <p className="mkt-dir-inaction muted">
                If you do nothing: {item.inactionLabel}{" "}
                <strong className="negative">~{fmt(item.inactionAmountMonthly)}/month</strong>
              </p>
            )}
            <MarketingFollowUpChips questions={item.followUpQuestions} />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function MarketingLandingPageIntelligence({
  insights,
  onSelect,
}: {
  insights: MarketingExecutiveLayer["landingPageInsights"];
  onSelect: (campaignId: string) => void;
}) {
  if (insights.length === 0) return null;

  return (
    <section className="card mkt-dir-landing">
      <h3 style={{ marginTop: 0 }}>Landing Page Intelligence</h3>
      {insights.map((lp) => (
        <div key={lp.campaignId} className="mkt-dir-landing-item">
          <button type="button" className="mkt-dir-landing-campaign" onClick={() => onSelect(lp.campaignId)}>
            {lp.campaignName}
          </button>
          <div className="mkt-dir-landing-grid">
            <div>
              <span className="muted">Landing Page URL</span>
              <code>{lp.url}</code>
            </div>
            <div>
              <span className="muted">Main Problem</span>
              <p>{lp.mainProblem}</p>
            </div>
            <div>
              <span className="muted">Suggested Headline</span>
              <strong>{lp.suggestedHeadline}</strong>
            </div>
            <div>
              <span className="muted">Suggested CTA</span>
              <strong>{lp.suggestedCta}</strong>
            </div>
            <div className="mkt-dir-landing-wide">
              <span className="muted">Reasoning</span>
              <p>{lp.reasoning}</p>
            </div>
            <div>
              <span className="muted">Expected Conversion Lift</span>
              <strong className="positive">+{lp.expectedConversionLiftPct}%</strong>
            </div>
            <div>
              <span className="muted">{FINANCIAL_IMPACT_LABELS.profit_recovery}</span>
              <strong className="positive">+{fmt(lp.expectedProfitMonthly)}/month</strong>
            </div>
          </div>
          <MarketingFollowUpChips
            questions={[
              "Generate a better landing page headline.",
              "Should I reduce budget or improve the landing page first?",
              "Show evidence.",
            ]}
          />
        </div>
      ))}
    </section>
  );
}

function simulateOutcome(
  baseline: SimulatorBaseline,
  metaPct: number,
  googlePct: number,
  landingCvr: number,
  targetRoas: number,
) {
  const weeklySpend = baseline.weeklySpend;
  const metaSpend = weeklySpend * (metaPct / 100);
  const googleSpend = weeklySpend * (googlePct / 100);
  const cvrFactor = landingCvr / Math.max(baseline.landingConversionPct, 0.1);
  const roasFactor = targetRoas / Math.max(baseline.expectedRoas, 0.1);

  const revenue = (metaSpend + googleSpend) * targetRoas * Math.min(cvrFactor, 1.4);
  const profit = revenue - (metaSpend + googleSpend);
  const roas = weeklySpend > 0 ? revenue / weeklySpend : targetRoas;
  const cashFlow = profit * 4.33;
  const forecast = profit * 4.33 * 1.05;

  return { revenue, profit, roas, cashFlow, forecast };
}

export function MarketingBudgetSimulator({ baseline }: { baseline: SimulatorBaseline }) {
  const [metaPct, setMetaPct] = useState(baseline.metaBudgetPct);
  const [googlePct, setGooglePct] = useState(baseline.googleBudgetPct);
  const [landingCvr, setLandingCvr] = useState(baseline.landingConversionPct);
  const [targetRoas, setTargetRoas] = useState(baseline.expectedRoas);

  const outcome = useMemo(
    () => simulateOutcome(baseline, metaPct, googlePct, landingCvr, targetRoas),
    [baseline, metaPct, googlePct, landingCvr, targetRoas],
  );

  return (
    <section className="card mkt-dir-simulator">
      <h3 style={{ marginTop: 0 }}>AI Budget Simulator</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
        Adjust levers and see projected weekly outcomes instantly.
      </p>
      <div className="mkt-dir-sim-controls">
        <label>
          <span>Meta Budget {metaPct}%</span>
          <input type="range" min={10} max={80} value={metaPct} onChange={(e) => setMetaPct(Number(e.target.value))} />
        </label>
        <label>
          <span>Google Budget {googlePct}%</span>
          <input type="range" min={10} max={80} value={googlePct} onChange={(e) => setGooglePct(Number(e.target.value))} />
        </label>
        <label>
          <span>Landing Page Conversion {landingCvr}%</span>
          <input type="range" min={0.5} max={8} step={0.1} value={landingCvr} onChange={(e) => setLandingCvr(Number(e.target.value))} />
        </label>
        <label>
          <span>Expected ROAS {targetRoas.toFixed(2)}</span>
          <input type="range" min={0.5} max={5} step={0.1} value={targetRoas} onChange={(e) => setTargetRoas(Number(e.target.value))} />
        </label>
      </div>
      <div className="mkt-dir-sim-outcomes">
        <div>
          <span className="muted">Revenue (weekly)</span>
          <strong>{fmt(outcome.revenue)}</strong>
        </div>
        <div>
          <span className="muted">Profit (weekly)</span>
          <strong className={outcome.profit >= 0 ? "positive" : "negative"}>{fmt(outcome.profit)}</strong>
        </div>
        <div>
          <span className="muted">ROAS</span>
          <strong>{outcome.roas.toFixed(2)}</strong>
        </div>
        <div>
          <span className="muted">{FINANCIAL_IMPACT_LABELS.cash_flow_improvement}</span>
          <strong className={outcome.cashFlow >= 0 ? "positive" : "negative"}>{fmt(outcome.cashFlow)}</strong>
        </div>
        <div>
          <span className="muted">Monthly Forecast</span>
          <strong className={outcome.forecast >= 0 ? "positive" : "negative"}>{fmt(outcome.forecast)}</strong>
        </div>
      </div>
    </section>
  );
}

export function MarketingCreativeIntelligenceExecutive({
  insights,
}: {
  insights: MarketingExecutiveLayer["enhancedCreatives"];
}) {
  if (insights.length === 0) return null;

  return (
    <section className="card mkt-dir-creative">
      <h3 style={{ marginTop: 0 }}>Creative Intelligence</h3>
      <ul className="mkt-dir-creative-list">
        {insights.map((insight) => (
          <li key={insight.id} className={`mkt-dir-creative-item mkt-v2-creative-${insight.severity}`}>
            <span className="mkt-v2-creative-label">{insight.creativeLabel}</span>
            <div className="mkt-dir-creative-compare">
              <div>
                <span className="muted">Current Message</span>
                <p>{insight.currentMessage}</p>
              </div>
              <div>
                <span className="muted">Suggested Message</span>
                <p>{insight.suggestedMessage}</p>
              </div>
            </div>
            <div className="mkt-dir-creative-meta">
              <div>
                <span className="muted">Reason</span>
                <p>{insight.reason}</p>
              </div>
              <div>
                <span className="muted">Expected Improvement</span>
                <strong>{insight.expectedImprovement}</strong>
              </div>
            </div>
            <Link
              href={`/ask-ai?q=${encodeURIComponent(`Generate new creative for ${insight.creativeLabel}`)}`}
              className="btn btn-secondary btn-sm"
            >
              Generate New Creative
            </Link>
            <MarketingFollowUpChips questions={["Show me the worst ad set.", "Show evidence."]} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MarketingForecastExecutive({
  forecast,
}: {
  forecast: MarketingExecutiveLayer["enhancedForecast"];
}) {
  return (
    <section className="card mkt-dir-forecast">
      <h3 style={{ marginTop: 0 }}>Marketing Forecast</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
        Worst, expected, and best case — with assumptions behind each scenario.
      </p>
      <div className="mkt-v2-scenario-grid">
        {forecast.scenarios.map((scenario) => (
          <div
            key={scenario.label}
            className={`mkt-v2-scenario mkt-v2-scenario-${scenario.label.replace(/\s/g, "-").toLowerCase()}`}
          >
            <h4>{scenario.label}</h4>
            <div className="mkt-v2-scenario-metrics">
              <div>
                <span className="muted">Revenue</span>
                <strong>{fmt(scenario.revenue)}</strong>
              </div>
              <div>
                <span className="muted">Profit</span>
                <strong>{scenario.profit != null ? fmt(scenario.profit) : "—"}</strong>
              </div>
              <div>
                <span className="muted">ROAS</span>
                <strong>{scenario.roas.toFixed(2)}</strong>
              </div>
            </div>
            <span className="muted mkt-v2-scenario-conf">{scenario.confidencePct}% confidence</span>
            <div className="mkt-dir-scenario-assumptions">
              <span className="muted">Main Assumptions</span>
              <ul>
                {scenario.scenarioAssumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
      <p className="mkt-v2-scenario-outlook">{forecast.aiOutlook}</p>
    </section>
  );
}

export function MarketingHealthScoreBreakdown({
  breakdowns,
}: {
  breakdowns: MarketingExecutiveLayer["healthBreakdowns"];
}) {
  const [openChannel, setOpenChannel] = useState<string | null>(null);

  if (breakdowns.length === 0) return null;

  return (
    <section className="card mkt-dir-health-breakdown">
      <h3 style={{ marginTop: 0 }}>Marketing Health</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
        Click a score to see exactly what drives it.
      </p>
      <div className="mkt-dir-health-list">
        {breakdowns.map((b) => (
          <div key={b.channel} className="mkt-dir-health-item">
            <button
              type="button"
              className="mkt-dir-health-toggle"
              onClick={() => setOpenChannel(openChannel === b.channel ? null : b.channel)}
            >
              <span>{b.label}</span>
              <strong>{b.overallScore}/100</strong>
            </button>
            {openChannel === b.channel && (
              <ul className="mkt-dir-health-factors">
                {b.factors.map((f) => (
                  <li key={f.id}>
                    <span>{f.label}</span>
                    <div className="mkt-dir-factor-bar">
                      <div style={{ width: `${f.score}%` }} />
                    </div>
                    <span className="muted">{f.contributionPct}% weight · {f.score}/100</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function MarketingCampaignCards({
  campaigns,
  channel,
  onSelect,
}: {
  campaigns: EnrichedMarketingCampaign[];
  channel: string;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const rows = campaigns.filter((c) => c.channel === channel);

  if (rows.length === 0) return null;

  return (
    <div className="mkt-dir-campaign-cards">
      {rows.map((c) => {
        const isOpen = expanded === c.id;
        const recovery = estimateCampaignRecovery({
          weeklyProfit: c.profitMeta.value,
          weeklySpend: c.spend,
          recoveryProbabilityPct: c.recoveryProbabilityPct,
          recommendation: c.recommendation,
        });
        return (
          <article key={c.id} className="card mkt-dir-campaign-card">
            <button
              type="button"
              className="mkt-dir-campaign-head"
              onClick={() => setExpanded(isOpen ? null : c.id)}
            >
              <div>
                <strong>{c.campaign}</strong>
                <span className="mkt-dir-campaign-status">{CAMPAIGN_HEALTH_LABELS[c.health]}</span>
              </div>
              <span className="muted">{isOpen ? "▲" : "▼"}</span>
            </button>
            {isOpen && (
              <div className="mkt-dir-campaign-body">
                <div className="mkt-dir-campaign-metrics">
                  <div><span className="muted">Spend</span><strong>${c.spend.toLocaleString()}</strong></div>
                  <div><span className="muted">Revenue</span><strong>${c.revenue.toLocaleString()}</strong></div>
                  <div><span className="muted">Profit</span><ProfitValue meta={c.profitMeta} /></div>
                  <div><span className="muted">ROAS</span><strong>{c.roas.toFixed(2)}</strong></div>
                  <div><span className="muted">CPA</span><strong>${c.cpa.toFixed(0)}</strong></div>
                  <div><span className="muted">CTR</span><strong>{c.ctr.toFixed(2)}%</strong></div>
                </div>
                <p className="mkt-dir-campaign-trend muted">
                  Trend: ROAS {c.roas >= 1.5 ? "↑" : c.roas < 1 ? "↓" : "→"} · CTR {c.ctr >= 1.2 ? "↑" : "↓"}
                </p>
                <div className="mkt-dir-campaign-rec">
                  <span className="muted">AI Recommendation</span>
                  <p>{RECOMMENDATION_LABELS[c.recommendation]} — {c.recommendationReason}</p>
                </div>
                <p className="mkt-dir-campaign-recovery">
                  <span className="muted">{FINANCIAL_IMPACT_LABELS.profit_recovery}</span>{" "}
                  <strong className="positive">+{fmt(recovery)}/month</strong>
                </p>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSelect(c.id)}>
                  View details
                </button>
                <MarketingFollowUpChips questions={[`Why is ${c.campaign} losing money?`, "Compare Meta with Google."]} />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function MarketingExecutiveDecisionCard({
  decision,
}: {
  decision: MarketingExecutiveLayer["executiveDecision"];
}) {
  return (
    <section className="card mkt-dir-decision">
      <h2 className="mkt-dir-section-title">{decision.title}</h2>
      <ol className="mkt-dir-decision-list">
        {decision.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ol>
      <div className="mkt-dir-decision-footer">
        <div>
          <span className="muted">{FINANCIAL_IMPACT_LABELS.profit_recovery}</span>
          <strong className="positive">{decision.expectedBenefit}</strong>
        </div>
        <div>
          <span className="muted">Confidence</span>
          <strong>{decision.confidence}</strong>
        </div>
        <div>
          <span className="muted">Risk</span>
          <strong>{decision.risk}</strong>
        </div>
      </div>
      <p className="muted mkt-dir-decision-risk">{decision.riskReason}</p>
      <MarketingFollowUpChips
        questions={[
          "Compare Meta with Google.",
          "Should I reduce budget or improve the landing page first?",
          "Show evidence.",
        ]}
      />
      <CrossModuleReference
        message="Underperforming campaigns reduce overall profitability."
        targetModule="profit"
        linkLabel="View Financial Impact"
      />
    </section>
  );
}

export function MarketingDirectorHero({ v2 }: { v2: MarketingManagerV2 }) {
  return (
    <div className="mkt-dir-hero">
      <MarketingExecutiveSummaryCard executive={v2.executive} />
    </div>
  );
}
