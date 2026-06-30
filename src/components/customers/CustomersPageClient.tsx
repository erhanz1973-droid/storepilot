"use client";

import { CustomerAcquisitionPanel } from "@/components/customers/CustomerAcquisitionPanel";
import { CustomerAiInsights } from "@/components/customers/CustomerAiInsights";
import { CustomerCohortsPanel } from "@/components/customers/CustomerCohortsPanel";
import { CustomerDetailDrawer } from "@/components/customers/CustomerDetailDrawer";
import { CustomerGeoPanel } from "@/components/customers/CustomerGeoPanel";
import { CustomerGrowthSection } from "@/components/customers/CustomerGrowthSection";
import { CustomerHealthScorePanel } from "@/components/customers/CustomerHealthScorePanel";
import { CustomerIntelligenceOverview } from "@/components/customers/CustomerIntelligenceOverview";
import { CustomerLtvPanel } from "@/components/customers/CustomerLtvPanel";
import { CustomerOpportunitiesSection } from "@/components/customers/CustomerOpportunitiesSection";
import { CustomerRepeatBuyersPanel } from "@/components/customers/CustomerRepeatBuyersPanel";
import { CustomerRevenueBySegment } from "@/components/customers/CustomerRevenueBySegment";
import { CustomerRfmPanel } from "@/components/customers/CustomerRfmPanel";
import { CustomerSegmentsPanel } from "@/components/customers/CustomerSegmentsPanel";
import { CustomerTopTable } from "@/components/customers/CustomerTopTable";
import { CustomersExecutiveSummaryCard } from "@/components/customers/CustomersExecutiveSummaryCard";
import type { CustomerRecord, CustomersPageView } from "@/lib/customers/types";
import { useState } from "react";

export function CustomersPageClient({ view }: { view: CustomersPageView }) {
  const [drawerCustomer, setDrawerCustomer] = useState<CustomerRecord | null>(null);
  const hasRecords = view.dataTier === "record_level" && view.topCustomers.length > 0;

  return (
    <div className="customers-page">
      <CustomersExecutiveSummaryCard summary={view.executiveSummary} dataTier={view.dataTier} />
      <CustomerHealthScorePanel health={view.healthBreakdown} />
      <CustomerAiInsights insights={view.aiInsights} />
      {hasRecords && (
        <CustomerOpportunitiesSection
          opportunities={view.opportunities}
          allHealthy={view.allHealthy}
        />
      )}
      <CustomerIntelligenceOverview analytics={view.analytics} />
      <CustomerTopTable customers={view.topCustomers} onSelect={setDrawerCustomer} />
      {hasRecords && (
        <>
          <div className="customers-two-col">
            <CustomerRepeatBuyersPanel
              customers={view.analytics.repeatBuyerCustomers}
              onSelect={setDrawerCustomer}
            />
            <CustomerLtvPanel ltv={view.ltv} />
          </div>
          <CustomerSegmentsPanel segments={view.segments} />
          <CustomerRevenueBySegment segments={view.segments} />
          <CustomerRfmPanel segments={view.analytics.rfmSegments} />
          <CustomerGrowthSection charts={view.growthCharts} />
          <div className="customers-two-col">
            <CustomerAcquisitionPanel acquisition={view.acquisition} />
            <CustomerGeoPanel regions={view.analytics.geographicDistribution} />
          </div>
        </>
      )}
      {!hasRecords && <CustomerLtvPanel ltv={view.ltv} />}
      <CustomerCohortsPanel
        available={view.cohortsAvailable}
        cohortPreview={view.cohortPreview}
        cohorts={view.cohortRetention}
      />
      <CustomerDetailDrawer
        customer={drawerCustomer}
        open={drawerCustomer != null}
        onClose={() => setDrawerCustomer(null)}
      />
    </div>
  );
}
