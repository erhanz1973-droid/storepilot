"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnalyticsTabs } from "@/components/analytics/AnalyticsTabs";
import type {
  CampaignComparisonHighlight,
  MarketingManagerView,
  MarketingPlatformSummary,
} from "@/lib/analytics/marketing-manager";
import type { MarketingChannel } from "@/lib/analytics/types";
import { CampaignDetailDrawer } from "./marketing/CampaignDetailDrawer";
import {
  MarketingBudgetAllocationExecutive,
  MarketingBudgetSimulator,
  MarketingCampaignCards,
  MarketingChannelComparisonCard,
  MarketingCreativeIntelligenceExecutive,
  MarketingDirectorHero,
  MarketingExecutiveDecisionCard,
  MarketingExecutivePriorityQueue,
  MarketingForecastExecutive,
  MarketingHealthScoreBreakdown,
  MarketingLandingPageIntelligence,
  MarketingStrengthsCard,
} from "./marketing/MarketingExecutiveSections";
import { ExecutiveStoryNav } from "@/components/executive/ExecutiveStoryNav";
import {
  MarketingEfficiencyCard,
  MarketingPlatformHealthCard,
} from "./marketing/MarketingV2Sections";

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
  const { executive } = v2;
  const [tab, setTab] = useState<string>("meta");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const channel = tab as MarketingChannel;
  const platform = props.platforms.find((p) => p.channel === channel)!;
  const comparisons = props.comparisons[channel] ?? [];

  const selected = selectedId
    ? props.campaigns.find((c) => c.id === selectedId) ?? null
    : null;

  const channelCampaigns = useMemo(
    () => props.campaigns.filter((c) => c.channel === channel),
    [props.campaigns, channel],
  );

  return (
    <div className="mkt-v2-page mkt-director-page">
      <MarketingDirectorHero v2={v2} />

      <div className="mkt-dir-primary-grid">
        <MarketingChannelComparisonCard comparison={executive.channelComparison} />
        <MarketingBudgetAllocationExecutive
          allocation={v2.budgetAllocation}
          reasons={executive.budgetShiftReasons}
        />
      </div>

      <MarketingStrengthsCard strengths={executive.strengths} />

      <MarketingExecutivePriorityQueue
        items={executive.executivePriorities}
        onSelect={setSelectedId}
      />

      <MarketingLandingPageIntelligence
        insights={executive.landingPageInsights}
        onSelect={setSelectedId}
      />

      <div className="mkt-dir-secondary-grid">
        <MarketingBudgetSimulator baseline={executive.simulatorBaseline} />
        <div className="mkt-dir-side-stack">
          <MarketingEfficiencyCard efficiency={v2.marketingEfficiency} />
          <MarketingHealthScoreBreakdown breakdowns={executive.healthBreakdowns} />
        </div>
      </div>

      <MarketingCreativeIntelligenceExecutive insights={executive.enhancedCreatives} />
      <MarketingForecastExecutive forecast={executive.enhancedForecast} />

      <div className="mkt-v2-drilldown">
        <h2 className="mkt-v2-section-title">Campaign Details</h2>
        <p className="muted mkt-v2-section-sub">
          Expand any campaign for metrics, trend, and AI recommendation.
        </p>
        <AnalyticsTabs tabs={[...TABS]} active={tab} onChange={setTab} />
        <PlatformSummary platform={platform} />
        <ComparisonCards highlights={comparisons} onSelect={setSelectedId} />

        {channelCampaigns.length === 0 ? (
          <div className="card">
            <p className="muted" style={{ margin: 0 }}>
              {platform.connected
                ? "No campaigns for this channel."
                : `Connect ${platform.label} in Settings → Connections.`}
            </p>
          </div>
        ) : (
          <MarketingCampaignCards
            campaigns={props.campaigns}
            channel={channel}
            onSelect={setSelectedId}
          />
        )}
      </div>

      <MarketingPlatformHealthCard details={v2.platformHealthDetails} />

      <MarketingExecutiveDecisionCard decision={executive.executiveDecision} />

      <ExecutiveStoryNav current="marketing" />

      {selected && (
        <CampaignDetailDrawer campaign={selected} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
