"use client";

import Link from "next/link";
import type {
  MarketingAutopilotReadiness,
  MarketingBrief,
  MarketingBudgetAllocation,
  MarketingCreativeInsight,
  MarketingEfficiency,
  MarketingManagerV2,
  MarketingOpportunityGroup,
  MarketingPriorityItem,
  MarketingSimulation,
  PlatformHealthDetail,
} from "@/lib/analytics/marketing-manager-v2";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function MarketingBriefCard({ brief }: { brief: MarketingBrief }) {
  return (
    <section className="card mkt-v2-brief">
      <div className="mkt-v2-brief-header">
        <span className="mkt-v2-brief-icon" aria-hidden>
          ✦
        </span>
        <div>
          <p className="mkt-v2-brief-greeting">{brief.greeting}.</p>
          <p className="muted mkt-v2-brief-sub">Your AI Marketing Manager</p>
        </div>
      </div>
      <div className="mkt-v2-brief-body">
        {brief.lines.map((line) => (
          <p key={line} className="mkt-v2-brief-line">
            {line}
          </p>
        ))}
      </div>
      {brief.todayPriority && (
        <div className="mkt-v2-brief-priority">
          <span className="mkt-v2-priority-label">Today&apos;s highest priority</span>
          <strong>{brief.todayPriority}</strong>
          {brief.todayPriorityAction && (
            <span className="mkt-v2-priority-action">{brief.todayPriorityAction}</span>
          )}
        </div>
      )}
    </section>
  );
}

export function MarketingAutopilotCard({ readiness }: { readiness: MarketingAutopilotReadiness }) {
  return (
    <section className="card mkt-v2-autopilot">
      <h3 style={{ marginTop: 0 }}>AI Autopilot Readiness</h3>
      <div className="mkt-v2-autopilot-grid">
        <div>
          <span className="muted">Marketing Actions Ready</span>
          <strong className="mkt-v2-autopilot-stat">{readiness.actionsReady}</strong>
        </div>
        <div>
          <span className="muted">Estimated Recovery</span>
          <strong className="mkt-v2-autopilot-stat positive">
            +{fmt(readiness.estimatedRecoveryMonthly)}
          </strong>
        </div>
        <div>
          <span className="muted">One-click execution</span>
          <strong
            className={`mkt-v2-autopilot-stat ${readiness.oneClickAvailable ? "positive" : ""}`}
          >
            {readiness.oneClickLabel}
          </strong>
        </div>
      </div>
      {readiness.oneClickAvailable && (
        <Link href="/decisions" className="btn btn-primary btn-sm mkt-v2-autopilot-cta">
          Execute {readiness.executableCount} ready action{readiness.executableCount === 1 ? "" : "s"}
        </Link>
      )}
    </section>
  );
}

function BudgetBar({ label, shares }: { label: string; shares: { label: string; pct: number }[] }) {
  return (
    <div className="mkt-v2-budget-col">
      <span className="muted mkt-v2-budget-label">{label}</span>
      <div className="mkt-v2-budget-bar">
        {shares.map((s) => (
          <div
            key={`${label}-${s.label}`}
            className={`mkt-v2-budget-segment mkt-v2-budget-${s.label.toLowerCase()}`}
            style={{ width: `${Math.max(s.pct, 4)}%` }}
            title={`${s.label} ${s.pct}%`}
          />
        ))}
      </div>
      <div className="mkt-v2-budget-legend">
        {shares.map((s) => (
          <span key={`${label}-leg-${s.label}`}>
            <strong>{s.label}</strong> {s.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

export function MarketingBudgetAllocationCard({ allocation }: { allocation: MarketingBudgetAllocation }) {
  return (
    <section className="card mkt-v2-budget">
      <h3 style={{ marginTop: 0 }}>Budget Allocation</h3>
      <p className="muted mkt-v2-budget-rationale">{allocation.rationale}</p>
      <div className="mkt-v2-budget-grid">
        <BudgetBar label="Current Budget" shares={allocation.current} />
        <BudgetBar label="Suggested Budget" shares={allocation.suggested} />
      </div>
      <ul className="mkt-v2-budget-evidence">
        {allocation.evidence.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mkt-v2-budget-improvement">
        Expected improvement{" "}
        <strong className="positive">+{fmt(allocation.estimatedMonthlyImprovement)}/month</strong>
      </p>
    </section>
  );
}

export function MarketingEfficiencyCard({ efficiency }: { efficiency: MarketingEfficiency }) {
  return (
    <section className="card mkt-v2-efficiency">
      <h3 style={{ marginTop: 0 }}>Marketing Efficiency</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
        Revenue generated per advertising dollar spent.
      </p>
      <div className="mkt-v2-efficiency-grid">
        <div>
          <span className="muted">Current</span>
          <strong>{efficiency.currentLabel}</strong>
        </div>
        <div>
          <span className="muted">Target</span>
          <strong>{efficiency.targetLabel}</strong>
        </div>
        <div>
          <span className="muted">Gap</span>
          <strong className={efficiency.gap < 0 ? "negative" : "positive"}>
            {efficiency.gapLabel}
          </strong>
        </div>
      </div>
    </section>
  );
}

export function MarketingPlatformHealthCard({
  details,
}: {
  details: PlatformHealthDetail[];
}) {
  return (
    <section className="card mkt-v2-health">
      <h3 style={{ marginTop: 0 }}>Marketing Performance vs Targets</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
        Targets beat abstract scores — see exactly where each platform stands.
      </p>
      <div className="mkt-v2-health-grid">
        {details.map((p) => (
          <div key={p.channel} className="mkt-v2-health-item">
            <div className="mkt-v2-health-head">
              <span>{p.label}</span>
              {p.connected ? (
                <strong className={p.score != null && p.score < 40 ? "negative" : ""}>
                  {p.businessStatusLabel}
                  {p.score != null ? ` · ${p.score}/100` : ""}
                </strong>
              ) : (
                <span className="muted mkt-v2-no-data">
                  Connect this channel to unlock advertising health
                </span>
              )}
            </div>
            {p.connected && p.metrics.length > 0 && (
              <div className="mkt-v2-target-table">
                {p.metrics.map((m) => (
                  <div key={`${p.channel}-${m.label}`} className="mkt-v2-target-row">
                    <span className="muted">{m.label}</span>
                    <div className="mkt-v2-target-values">
                      <span>
                        <span className="muted">Current </span>
                        <strong>{m.currentLabel}</strong>
                      </span>
                      <span>
                        <span className="muted">Target </span>
                        <strong>{m.targetLabel}</strong>
                      </span>
                      <span>
                        <span className="muted">Gap </span>
                        <strong className={m.negativeGap ? "negative" : "positive"}>
                          {m.gapLabel}
                        </strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {p.connected && p.explanation.length > 0 && (
              <ul className="mkt-v2-health-reasons">
                {p.explanation.slice(0, 3).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            {!p.connected && (
              <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
                <Link href="/connections">Connect {p.label}</Link> to unlock performance scoring.
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** @deprecated use MarketingPlatformHealthCard */
export function MarketingHealthScores({
  details,
}: {
  details: PlatformHealthDetail[];
}) {
  return <MarketingPlatformHealthCard details={details} />;
}

export function MarketingPriorityQueue({
  items,
  onSelect,
}: {
  items: MarketingPriorityItem[];
  onSelect: (campaignId: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className="card mkt-v2-queue">
      <h3 style={{ marginTop: 0 }}>Campaign Priority Queue</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
        Do these in order — highest impact first.
      </p>
      <ol className="mkt-v2-queue-list">
        {items.map((item, i) => (
          <li key={item.campaignId}>
            <button type="button" className="mkt-v2-queue-item" onClick={() => onSelect(item.campaignId)}>
              <div className="mkt-v2-queue-rank">
                <span className="mkt-v2-queue-rank-label">{item.rankLabel}</span>
                {i < items.length - 1 && <span className="mkt-v2-queue-arrow" aria-hidden>↓</span>}
              </div>
              <div className="mkt-v2-queue-body">
                <strong>{item.campaignName}</strong>
                <span className="mkt-v2-queue-action">{item.action}</span>
                <ul className="mkt-v2-queue-why">
                  {item.whyBullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
              <div className="mkt-v2-queue-impact">
                <span className="muted">Impact</span>
                <strong className="positive">+{fmt(item.impactMonthly)}/month</strong>
                <span className="muted mkt-v2-queue-recovery">
                  Recovery {item.recoveryProbabilityPct}%
                </span>
              </div>
              {item.decisionId && (
                <Link
                  href={`/decisions#${item.decisionId}`}
                  className="btn btn-primary btn-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  Approve
                </Link>
              )}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function MarketingCampaignTimelines({
  timelines,
  onSelect,
}: {
  timelines: MarketingManagerV2["campaignTimelines"];
  onSelect: (campaignId: string) => void;
}) {
  if (timelines.length === 0) return null;

  return (
    <section className="card mkt-v2-timeline">
      <h3 style={{ marginTop: 0 }}>Campaign Timeline</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
        7-day trend signals — not just current snapshots.
      </p>
      <div className="mkt-v2-timeline-grid">
        {timelines.map((entry) => (
          <button
            key={entry.campaignId}
            type="button"
            className="mkt-v2-timeline-card"
            onClick={() => onSelect(entry.campaignId)}
          >
            <div className="mkt-v2-timeline-head">
              <strong>{entry.campaignName}</strong>
              <span className="muted">{entry.periodLabel}</span>
            </div>
            <div className="mkt-v2-timeline-metrics">
              {entry.metrics.map((m) => (
                <span
                  key={`${entry.campaignId}-${m.label}`}
                  className={`mkt-v2-trend mkt-v2-trend-${m.direction}`}
                >
                  {m.note}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

export function MarketingOpportunityMap({
  groups,
  onSelect,
}: {
  groups: MarketingOpportunityGroup[];
  onSelect: (campaignId: string) => void;
}) {
  if (groups.length === 0) return null;

  return (
    <section className="card mkt-v2-opportunity">
      <h3 style={{ marginTop: 0 }}>AI Opportunity Map</h3>
      <div className="mkt-v2-opportunity-grid">
        {groups.map((group) => (
          <div key={group.id} className="mkt-v2-opportunity-group">
            <h4>{group.title}</h4>
            <ul>
              {group.items.map((item) => (
                <li key={item.campaignId}>
                  <button type="button" onClick={() => onSelect(item.campaignId)}>
                    <span>{item.campaignName}</span>
                    <span className="muted">{item.action}</span>
                    <strong className="positive">+{fmt(item.impactMonthly)}/mo</strong>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MarketingCreativeIntelligence({
  insights,
}: {
  insights: MarketingCreativeInsight[];
}) {
  if (insights.length === 0) return null;

  return (
    <section className="card mkt-v2-creative">
      <h3 style={{ marginTop: 0 }}>Creative Intelligence</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
        Meta performance combined with GA4 conversion signals.
      </p>
      <ul className="mkt-v2-creative-list">
        {insights.map((insight) => (
          <li key={insight.id} className={`mkt-v2-creative-item mkt-v2-creative-${insight.severity}`}>
            <span className="mkt-v2-creative-label">{insight.creativeLabel}</span>
            <p>{insight.insight}</p>
            <p className="mkt-v2-creative-rec">{insight.recommendation}</p>
            {insight.suggestedHeadline && (
              <p className="mkt-v2-creative-action">
                Recommended headline: <strong>{insight.suggestedHeadline}</strong>
              </p>
            )}
            {insight.suggestedCta && (
              <p className="mkt-v2-creative-action">
                Recommended CTA: <strong>{insight.suggestedCta}</strong>
              </p>
            )}
            {insight.creativeConcepts && insight.creativeConcepts.length > 0 && (
              <div className="mkt-v2-creative-concepts">
                <span className="muted">Generate new creative concepts:</span>
                <ul>
                  {insight.creativeConcepts.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MarketingSimulationPanel({
  simulations,
  activeId,
  onSelect,
}: {
  simulations: MarketingSimulation[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  if (simulations.length === 0) return null;

  const active = simulations.find((s) => s.id === activeId) ?? simulations[0];

  return (
    <section className="card mkt-v2-simulation">
      <h3 style={{ marginTop: 0 }}>AI Simulation</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
        Compare multiple scenarios — each shows predicted monthly profit impact.
      </p>
      <div className="mkt-v2-sim-list">
        {simulations.map((sim) => (
          <button
            key={sim.id}
            type="button"
            className={`mkt-v2-sim-row ${active?.id === sim.id ? "active" : ""}`}
            onClick={() => onSelect(sim.id)}
          >
            <span>{sim.label}</span>
            <strong className="positive">{sim.predictedValue}</strong>
            <span className="muted">{sim.confidencePct}% conf.</span>
          </button>
        ))}
      </div>
      {active && (
        <div className="mkt-v2-sim-result">
          <span className="muted">{active.predictedMetric}</span>
          <strong className="positive">{active.predictedValue}</strong>
          <span className="muted mkt-v2-sim-conf">{active.confidencePct}% confidence</span>
        </div>
      )}
    </section>
  );
}

export function MarketingScenarioForecastCard({
  forecast,
}: {
  forecast: MarketingManagerV2["scenarioForecast"];
}) {
  return (
    <section className="card mkt-v2-scenario-forecast">
      <h3 style={{ marginTop: 0 }}>Marketing Forecast</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
        Realistic range — not a single guess.
      </p>
      <div className="mkt-v2-scenario-grid">
        {forecast.scenarios.map((scenario) => (
          <div key={scenario.label} className={`mkt-v2-scenario mkt-v2-scenario-${scenario.label.replace(/\s/g, "-").toLowerCase()}`}>
            <h4>{scenario.label}</h4>
            <div className="mkt-v2-scenario-metrics">
              <div>
                <span className="muted">Spend</span>
                <strong>{fmt(scenario.spend)}</strong>
              </div>
              <div>
                <span className="muted">Revenue</span>
                <strong>{fmt(scenario.revenue)}</strong>
              </div>
              <div>
                <span className="muted">Profit</span>
                <strong>
                  {scenario.profit != null ? fmt(scenario.profit) : "—"}
                </strong>
              </div>
            </div>
            <span className="muted mkt-v2-scenario-conf">{scenario.confidencePct}% confidence</span>
          </div>
        ))}
      </div>
      <p className="mkt-v2-scenario-outlook">{forecast.aiOutlook}</p>
      <div className="mkt-v2-forecast-assumptions">
        <h4>Forecast based on</h4>
        <ul>
          {forecast.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <p className="muted mkt-v2-forecast-conf">
          Overall confidence: <strong>{forecast.overallConfidencePct}%</strong>
        </p>
      </div>
    </section>
  );
}

export function MarketingV2HeroRow({ v2 }: { v2: MarketingManagerV2 }) {
  return (
    <div className="mkt-v2-hero-row">
      <MarketingBriefCard brief={v2.brief} />
      <MarketingAutopilotCard readiness={v2.autopilotReadiness} />
    </div>
  );
}
