import type { CustomerIntelligenceDashboard } from "./engine";
import type { CustomersPageView } from "./types";

export function assembleCustomersPageView(
  dashboard: CustomerIntelligenceDashboard,
): CustomersPageView {
  return {
    dataTier: dashboard.dataTier,
    executiveSummary: dashboard.executiveSummary,
    healthBreakdown: dashboard.healthBreakdown,
    cohortPreview: dashboard.cohortPreview,
    segments: dashboard.segments,
    topCustomers: dashboard.topCustomers,
    acquisition: dashboard.acquisition,
    aiInsights: dashboard.aiInsights,
    ltv: dashboard.ltv,
    cohortsAvailable: dashboard.cohortsAvailable,
    cohortUnavailableReason: dashboard.cohortUnavailableReason,
    cohortRetention: dashboard.cohortRetention,
    opportunities: dashboard.opportunities,
    growthCharts: dashboard.growthCharts,
    analytics: dashboard.analytics,
    allHealthy: dashboard.allHealthy,
  };
}
