import { buildIntelligenceDashboard } from "@/lib/db/recommendation-intelligence";
import { listOutcomeRecords } from "@/lib/db/outcome-records";
import { buildProductIntelligenceDashboard } from "@/lib/services/products";
import { buildReadOnlyDashboard } from "@/lib/services/dashboard";
import { getCachedStoreBundle } from "@/lib/services/store-bundle";
import { buildWeeklyBriefingReport } from "@/lib/reports/build-weekly-briefing";
import type { WeeklyBriefingReport } from "@/lib/reports/types";

export async function buildReportsPageData(): Promise<WeeklyBriefingReport> {
  const bundle = await getCachedStoreBundle();
  const storeId = bundle.storeId;
  const [dashboard, productIntelligence, intelligence, outcomes] = await Promise.all([
    buildReadOnlyDashboard(storeId, bundle.snapshot),
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
