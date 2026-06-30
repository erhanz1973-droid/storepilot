import { AcquisitionKpiStrip } from "@/components/attribution/AcquisitionKpiStrip";
import { AttributionConfidenceBanner } from "@/components/attribution/AttributionConfidenceBanner";
import { AttributionExecutiveSummaryCard } from "@/components/attribution/AttributionExecutiveSummaryCard";
import { AttributionStrategyPanel } from "@/components/attribution/AttributionStrategyPanel";
import { CampaignProfitTableSortable } from "@/components/attribution/CampaignProfitTableSortable";
import { ChannelProfitTable } from "@/components/attribution/ChannelProfitTable";
import { CreativeIntelligenceGrid } from "@/components/attribution/CreativeIntelligenceGrid";
import { JourneyTimeline } from "@/components/attribution/JourneyTimeline";
import { ATTRIBUTION_MODEL_LABELS } from "@/lib/attribution/models";
import type { AttributionDashboard } from "@/lib/attribution/models";
import Link from "next/link";

export function AttributionAnalyticsContent({
  dashboard,
}: {
  dashboard: AttributionDashboard | null;
}) {
  if (!dashboard) {
    return (
      <div className="card">
        <p className="muted" style={{ margin: 0 }}>
          Connect Shopify and Meta Ads to unlock multi-touch attribution.{" "}
          <Link href="/connections?tab=commerce">Connect your store</Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <AttributionConfidenceBanner confidence={dashboard.confidence} />
      <AcquisitionKpiStrip metrics={dashboard.acquisition} />

      <div className="card" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          Model: <strong>{ATTRIBUTION_MODEL_LABELS[dashboard.model]}</strong>
        </p>
      </div>

      {dashboard.strategyPlan.actions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <AttributionExecutiveSummaryCard summary={dashboard.strategyPlan.executiveSummary} />
        </div>
      )}

      {dashboard.strategyPlan.actions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <AttributionStrategyPanel plan={dashboard.strategyPlan} />
        </div>
      )}

      <ChannelProfitTable rows={dashboard.channels} />
      <CampaignProfitTableSortable rows={dashboard.campaigns} />
      <CreativeIntelligenceGrid creatives={dashboard.creatives} />

      {dashboard.sampleJourneys.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Customer Journeys</h3>
          <JourneyTimeline journeys={dashboard.sampleJourneys} />
        </div>
      )}
    </>
  );
}
