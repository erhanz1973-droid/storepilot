"use client";

import type { SalesManagerView } from "@/lib/analytics/sales-manager";
import { TrendChart } from "@/components/analytics/TrendChart";
import {
  CustomerValueSection,
  DiscountInsightCard,
  OrderIntelligenceSection,
  RevenueDriversSection,
  RevenueQualityCard,
  SalesBriefCard,
  SalesBusinessKpiRow,
  SalesOpportunitySection,
  SecondaryMetricsRow,
  TrendCommentaryPanel,
} from "./sales/SalesV2Sections";

type Props = SalesManagerView;

export function SalesManagerClient({ v2 }: Props) {
  return (
    <div className="sal-v2-page">
      <SalesBriefCard brief={v2.brief} />
      <SalesBusinessKpiRow kpis={v2.businessKpis} />

      <div className="sal-v2-main-grid">
        <RevenueQualityCard quality={v2.revenueQuality} />
        <CustomerValueSection value={v2.customerValue} />
      </div>

      <RevenueDriversSection drivers={v2.drivers} />
      <SalesOpportunitySection opportunities={v2.opportunities} />
      <OrderIntelligenceSection orders={v2.orders} highlights={v2.orderHighlights} />

      {v2.charts.length > 0 && (
        <>
          <TrendCommentaryPanel commentary={v2.trendCommentary} />
          <div className="analytics-charts-grid sal-v2-charts">
            {v2.charts.map((chart) => (
              <TrendChart key={chart.id} chart={chart} />
            ))}
          </div>
        </>
      )}

      <DiscountInsightCard insight={v2.discountInsight} />
      <SecondaryMetricsRow metrics={v2.secondaryMetrics} />

      {v2.totalRecoverableMonthly > 0 && (
        <p className="muted sal-v2-total-recovery">
          Sales recoverable profit:{" "}
          <strong className="positive">
            +$
            {v2.totalRecoverableMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            /month
          </strong>{" "}
          (shared recovery engine)
        </p>
      )}
    </div>
  );
}
