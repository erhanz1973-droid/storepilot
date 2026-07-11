import { buildReadOnlyDashboard } from "@/lib/services/dashboard";
import { buildCustomerIntelligence } from "@/lib/customers/engine";
import { getCachedStoreBundle } from "@/lib/services/store-bundle";
import { buildUnifiedExecutiveBrief } from "@/lib/insights/unified-executive-brief";
import { resolveAdvertisingEntitlements } from "@/lib/services/advertising";

export async function buildExecutiveInsightsPageData() {
  const [bundle, { entitlements }] = await Promise.all([
    getCachedStoreBundle(),
    resolveAdvertisingEntitlements(),
  ]);
  const dashboard = await buildReadOnlyDashboard(bundle.storeId, bundle.snapshot);

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
    planUsage: entitlements,
  });

  return { dashboard, brief };
}
