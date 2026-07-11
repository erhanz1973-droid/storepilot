import { ChannelProfitCards } from "@/components/profit/ChannelProfitCards";
import { ProfitAiSummaryCard } from "@/components/profit/ProfitAiSummaryCard";
import { ProfitCfoDecisionCard } from "@/components/profit/ProfitCfoDecisionCard";
import { ExecutiveStoryNav } from "@/components/executive/ExecutiveStoryNav";
import { ProfitConfidenceBreakdown } from "@/components/profit/ProfitConfidenceBreakdown";
import { ProfitFormulaExpandable } from "@/components/profit/ProfitFormulaExpandable";
import { ProfitKpiStrip } from "@/components/profit/ProfitKpiStrip";
import { ProfitRecoverySection } from "@/components/profit/ProfitRecoverySection";
import { ProfitTimelineSection } from "@/components/profit/ProfitTimelineSection";
import { ProfitWaterfallChart } from "@/components/profit/ProfitWaterfallChart";
import { ProductAttributionWidgets } from "@/components/profit/ProductAttributionWidgets";
import { ProductProfitCategoriesSection } from "@/components/profit/ProductProfitCategoriesSection";
import { ProductProfitTableWithAttribution } from "@/components/profit/ProductProfitTableWithAttribution";
import { WhyLosingMoneyCard } from "@/components/profit/WhyLosingMoneyCard";
import Link from "next/link";
import type { ProfitPageView } from "@/lib/profit/profit-page-view";
import type { ProductAttributionDashboard } from "@/lib/attribution/product-types";
import type { ProfitDashboard } from "@/lib/profit/types";

type ProfitPageData = {
  dashboard: ProfitDashboard;
  view: ProfitPageView;
  productAttribution: ProductAttributionDashboard | null;
};

export async function ProfitAnalyticsContent({ data }: { data: ProfitPageData | null }) {
  if (!data) {
    return (
      <div className="card">
        <p className="muted" style={{ margin: 0 }}>
          Profit calculation requires order history.{" "}
          <Link href="/connections?tab=commerce">Connect your store</Link> to get started.
        </p>
      </div>
    );
  }

  const { dashboard, view, productAttribution } = data;

  return (
    <div className="profit-page profit-cfo-page">
      <ProfitAiSummaryCard summary={view.aiSummary} />

      <ProfitWaterfallChart waterfall={view.waterfall} />

      <ProfitConfidenceBreakdown
        categories={view.confidenceCategories}
        confidence={dashboard.confidence}
        explanation={view.confidenceExplanation}
        setupImpacts={view.setupImpacts}
        setupComplete={view.setupComplete}
      />

      {view.whyLosingMoney && <WhyLosingMoneyCard insight={view.whyLosingMoney} />}

      <ProfitRecoverySection recovery={view.recovery} />

      <ProfitKpiStrip kpis={dashboard.kpis} />

      <ProfitTimelineSection charts={view.timelineCharts} />

      <ChannelProfitCards cards={view.channelCards} />

      <ProductProfitCategoriesSection categories={view.productCategories} />

      {productAttribution && <ProductAttributionWidgets attribution={productAttribution} />}

      <ProductProfitTableWithAttribution
        rows={view.enrichedProducts}
        attribution={productAttribution}
        title="Full Product Profitability"
      />

      <ProfitFormulaExpandable period={dashboard.primary} />

      <ProfitCfoDecisionCard decision={view.cfoDecision} />

      <ExecutiveStoryNav current="profit" />
    </div>
  );
}
