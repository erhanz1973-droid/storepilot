"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnalyticsTabs } from "@/components/analytics/AnalyticsTabs";
import type {
  CampaignComparisonHighlight,
  EnrichedMarketingCampaign,
  MarketingManagerView,
  MarketingPlatformSummary,
} from "@/lib/analytics/marketing-manager";
import {
  CAMPAIGN_HEALTH_EMOJI,
  CAMPAIGN_HEALTH_LABELS,
  RECOMMENDATION_LABELS,
} from "@/lib/analytics/marketing-manager";
import type { MarketingChannel } from "@/lib/analytics/types";
import { CampaignDetailDrawer } from "./marketing/CampaignDetailDrawer";
import {
  MarketingBudgetAllocationCard,
  MarketingCampaignTimelines,
  MarketingCreativeIntelligence,
  MarketingEfficiencyCard,
  MarketingOpportunityMap,
  MarketingPlatformHealthCard,
  MarketingPriorityQueue,
  MarketingScenarioForecastCard,
  MarketingSimulationPanel,
  MarketingV2HeroRow,
} from "./marketing/MarketingV2Sections";
import { ProfitValue } from "./marketing/ProfitValue";

const TABS = [
  { id: "meta", label: "Meta Ads" },
  { id: "google", label: "Google Ads" },
  { id: "tiktok", label: "TikTok" },
  { id: "pinterest", label: "Pinterest" },
] as const;

type Props = MarketingManagerView;

function PlatformSummary({ platform }: { platform: MarketingPlatformSummary }) {
  if (!platform.connected) {
    return (
      <div className="card mkt-platform-summary">
        <h3 style={{ marginTop: 0 }}>{platform.label} Summary</h3>
        <p className="muted" style={{ margin: 0 }}>
          Not connected.{" "}
          <Link href="/connections">Connect {platform.label}</Link> to unlock AI marketing insights.
        </p>
      </div>
    );
  }

  return (
    <div className="card mkt-platform-summary">
      <h3 style={{ marginTop: 0 }}>{platform.label} Summary</h3>
      <div className="mkt-summary-grid">
        <div><span className="muted">Spend</span><strong>${platform.spend.toLocaleString()}</strong></div>
        <div><span className="muted">Revenue</span><strong>${platform.revenue.toLocaleString()}</strong></div>
        <div><span className="muted">ROAS</span><strong>{platform.roas.toFixed(2)}</strong></div>
        <div>
          <span className="muted">Profit</span>
          <ProfitValue meta={platform.profitMeta} />
        </div>
        <div>
          <span className="muted">Business Status</span>
          <strong className={platform.businessStatus === "unprofitable" ? "negative" : ""}>
            {platform.businessStatusLabel}
          </strong>
        </div>
      </div>
      <p className="mkt-ai-summary">{platform.aiSummary}</p>
    </div>
  );
}

function ComparisonCards({
  highlights,
  onSelect,
}: {
  highlights: CampaignComparisonHighlight[];
  onSelect: (id: string) => void;
}) {
  if (highlights.length === 0) return null;
  return (
    <div className="mkt-comparison-grid">
      {highlights.map((h) => (
        <button
          key={h.id}
          type="button"
          className="card mkt-comparison-card"
          onClick={() => onSelect(h.campaignId)}
        >
          <span className="muted mkt-comparison-label">{h.label}</span>
          <strong className="mkt-comparison-value">{h.value}</strong>
          <span className="muted" style={{ fontSize: "0.8rem" }}>{h.campaignName}</span>
        </button>
      ))}
    </div>
  );
}

export function MarketingManagerClient(props: Props) {
  const { v2 } = props;
  const [tab, setTab] = useState<string>("meta");
  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [recFilter, setRecFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeSimId, setActiveSimId] = useState<string | null>(v2.simulations[0]?.id ?? null);

  const channel = tab as MarketingChannel;
  const platform = props.platforms.find((p) => p.channel === channel)!;
  const comparisons = props.comparisons[channel] ?? [];

  const rows = useMemo(() => {
    let list = props.campaigns.filter((c) => c.channel === channel);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.campaign.toLowerCase().includes(q) ||
          RECOMMENDATION_LABELS[c.recommendation].toLowerCase().includes(q) ||
          CAMPAIGN_HEALTH_LABELS[c.health].toLowerCase().includes(q),
      );
    }
    if (healthFilter !== "all") list = list.filter((c) => c.health === healthFilter);
    if (recFilter !== "all") list = list.filter((c) => c.recommendation === recFilter);
    return list.sort((a, b) => b.shareOfSpendPct - a.shareOfSpendPct);
  }, [props.campaigns, channel, search, healthFilter, recFilter]);

  const selected = selectedId
    ? props.campaigns.find((c) => c.id === selectedId) ?? null
    : null;

  return (
    <div className="mkt-v2-page">
      <MarketingV2HeroRow v2={v2} />

      <div className="mkt-v2-main-grid">
        <MarketingBudgetAllocationCard allocation={v2.budgetAllocation} />
        <div className="mkt-v2-side-stack">
          <MarketingEfficiencyCard efficiency={v2.marketingEfficiency} />
          <MarketingPlatformHealthCard details={v2.platformHealthDetails} />
        </div>
      </div>

      <MarketingPriorityQueue items={v2.priorityQueue} onSelect={setSelectedId} />

      <div className="mkt-v2-secondary-grid">
        <MarketingCampaignTimelines timelines={v2.campaignTimelines} onSelect={setSelectedId} />
        <MarketingSimulationPanel
          simulations={v2.simulations}
          activeId={activeSimId}
          onSelect={setActiveSimId}
        />
      </div>

      <MarketingOpportunityMap groups={v2.opportunityGroups} onSelect={setSelectedId} />
      <MarketingCreativeIntelligence insights={v2.creativeInsights} />
      <MarketingScenarioForecastCard forecast={v2.scenarioForecast} />

      <div className="mkt-v2-drilldown">
        <h2 className="mkt-v2-section-title">Campaign Details</h2>
        <p className="muted mkt-v2-section-sub">
          Channel-level drill-down when you need raw campaign data.
        </p>
        <AnalyticsTabs tabs={[...TABS]} active={tab} onChange={setTab} />
        <PlatformSummary platform={platform} />
        <ComparisonCards highlights={comparisons} onSelect={setSelectedId} />

        {rows.length === 0 ? (
          <div className="card">
            <p className="muted" style={{ margin: 0 }}>
              {platform.connected
                ? "No campaigns match your filters."
                : `Connect ${platform.label} in Settings → Connections.`}
            </p>
          </div>
        ) : (
          <div className="card mkt-table-wrap">
            <div className="mkt-table-toolbar">
              <input
                type="search"
                className="analytics-table-search"
                placeholder="Search campaign, health, recommendation…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select value={healthFilter} onChange={(e) => setHealthFilter(e.target.value)}>
                <option value="all">All business status</option>
                {Object.entries(CAMPAIGN_HEALTH_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <select value={recFilter} onChange={(e) => setRecFilter(e.target.value)}>
                <option value="all">All recommendations</option>
                {Object.entries(RECOMMENDATION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div className="analytics-table-scroll">
              <table className="analytics-table mkt-campaign-table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Business Status</th>
                    <th>Recommendation</th>
                    <th className="align-right">Recovery</th>
                    <th className="align-right">Spend</th>
                    <th className="align-right">Revenue</th>
                    <th className="align-right">ROAS</th>
                    <th className="align-right">Profit</th>
                    <th className="align-right">Margin</th>
                    <th className="align-right">% Spend</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="mkt-row-clickable" onClick={() => setSelectedId(row.id)}>
                      <td><strong>{row.campaign}</strong></td>
                      <td>
                        {CAMPAIGN_HEALTH_EMOJI[row.health]} {CAMPAIGN_HEALTH_LABELS[row.health]}
                      </td>
                      <td><span className="mkt-rec-pill">{RECOMMENDATION_LABELS[row.recommendation]}</span></td>
                      <td className="align-right">
                        <span className={row.recoveryProbabilityPct < 20 ? "negative" : ""}>
                          {row.recoveryProbabilityPct}%
                        </span>
                      </td>
                      <td className="align-right">${row.spend.toLocaleString()}</td>
                      <td className="align-right">${row.revenue.toLocaleString()}</td>
                      <td className="align-right">{row.roas.toFixed(2)}</td>
                      <td className="align-right"><ProfitValue meta={row.profitMeta} /></td>
                      <td className="align-right">
                        {row.marginMeta.status === "unavailable" ? (
                          <ProfitValue meta={row.marginMeta} />
                        ) : (
                          `${row.margin.toFixed(1)}%`
                        )}
                      </td>
                      <td className="align-right">{row.shareOfSpendPct}%</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="mkt-row-actions">
                          {row.decisionId && (
                            <Link href={`/decisions#${row.decisionId}`} className="btn btn-primary btn-sm">
                              Approve
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <CampaignDetailDrawer campaign={selected} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
