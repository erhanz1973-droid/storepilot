"use client";

import type { TrafficManagerView } from "@/lib/analytics/traffic-manager";
import { TrendChart } from "@/components/analytics/TrendChart";
import {
  TrafficBriefCard,
  TrafficBusinessKpiRow,
  TrafficDeviceSection,
  TrafficGa4EmptyState,
  TrafficHealthCard,
  TrafficLandingPagesSection,
  TrafficOpportunitySection,
  TrafficChannelProfitabilitySection,
  TrafficSourceQualitySection,
} from "./traffic/TrafficV2Sections";

type Props = Pick<TrafficManagerView, "charts" | "v2">;

export function TrafficManagerClient({ charts, v2 }: Props) {
  if (v2.requiresGa4) {
    return (
      <div className="trf-v2-page">
        <TrafficBriefCard brief={v2.brief} />
        <TrafficBusinessKpiRow kpis={v2.businessKpis} />
        <TrafficGa4EmptyState />
      </div>
    );
  }

  return (
    <div className="trf-v2-page">
      <TrafficBriefCard brief={v2.brief} />
      <TrafficBusinessKpiRow kpis={v2.businessKpis} />
      <TrafficHealthCard health={v2.healthScore} />

      <div className="trf-v2-main-grid">
        <TrafficSourceQualitySection sources={v2.sourceQuality} />
        <TrafficChannelProfitabilitySection sources={v2.sourceQuality} />
      </div>

      <TrafficDeviceSection devices={v2.deviceIntelligence} />
      <TrafficLandingPagesSection pages={v2.landingPages} />
      <TrafficOpportunitySection opportunities={v2.opportunities} />

      {charts.length > 0 && (
        <div className="analytics-charts-grid trf-v2-charts">
          {charts.map((chart) => (
            <TrendChart key={chart.id} chart={chart} />
          ))}
        </div>
      )}

      {v2.totalRecoverableMonthly > 0 && (
        <p className="muted trf-v2-total-recovery">
          Traffic &amp; landing page recoverable profit:{" "}
          <strong className="positive">
            +$
            {v2.totalRecoverableMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            /month
          </strong>{" "}
          (uses shared recovery engine — reconciles with Executive totals)
        </p>
      )}
    </div>
  );
}
