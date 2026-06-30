import { buildDashboard } from "@/lib/services/dashboard";
import { buildCustomerIntelligence } from "@/lib/customers/engine";
import { getCachedStoreBundle } from "@/lib/services/store-bundle";
import { buildUnifiedExecutiveBrief } from "@/lib/insights/unified-executive-brief";

export async function buildExecutiveInsightsPageData() {
  const [dashboard, bundle] = await Promise.all([
    buildDashboard(),
    getCachedStoreBundle(),
  ]);

  const customerIntelligence = buildCustomerIntelligence({
    snapshot: bundle.snapshot,
    attribution: dashboard.attributionDashboard,
    profitDashboard: dashboard.profitDashboard,
  });

  const brief = buildUnifiedExecutiveBrief({
    dashboard,
    snapshot: bundle.snapshot,
    decisions: dashboard.decisionCenter,
    customerIntelligence,
  });

  return { dashboard, brief };
}
