import { buildIntelligenceDashboard } from "@/lib/db/recommendation-intelligence";
import { listOutcomeRecords } from "@/lib/db/outcome-records";
import { buildProductIntelligenceDashboard } from "@/lib/services/products";
import { getCachedDashboard } from "@/lib/services/dashboard";
import { getCachedActiveStoreId, getCachedStoreBundle } from "@/lib/services/store-bundle";
import { buildWeeklyBriefingReport } from "@/lib/reports/build-weekly-briefing";
import type { WeeklyBriefingReport } from "@/lib/reports/types";

export async function buildReportsPageData(): Promise<WeeklyBriefingReport> {
  const storeId = await getCachedActiveStoreId();
  const [dashboard, bundle, productIntelligence, intelligence, outcomes] = await Promise.all([
    getCachedDashboard(storeId),
    getCachedStoreBundle(),
    buildProductIntelligenceDashboard(),
    buildIntelligenceDashboard(storeId),
    listOutcomeRecords(storeId, 20),
  ]);

  return buildWeeklyBriefingReport({
    dashboard,
    snapshot: bundle.snapshot,
    profitDashboard: bundle.profitDashboard,
    productIntelligence,
    intelligence,
    outcomeRecords: outcomes,
  });
}
