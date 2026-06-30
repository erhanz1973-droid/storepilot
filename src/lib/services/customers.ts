import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { buildCustomerIntelligence } from "@/lib/customers/engine";
import { assembleCustomersPageView } from "@/lib/customers/page-view";
import type { CustomersPageView } from "@/lib/customers/types";
import { getCachedStoreBundle } from "@/lib/services/store-bundle";

export async function buildCustomersPageData(): Promise<{
  view: CustomersPageView;
  syncedAt: string;
} | null> {
  const bundle = await getCachedStoreBundle();
  const attributionDashboard = buildAttributionDashboard(
    bundle.snapshot,
    bundle.profitDashboard,
  );
  const intelligence = buildCustomerIntelligence({
    snapshot: bundle.snapshot,
    attribution: attributionDashboard,
    profitDashboard: bundle.profitDashboard,
  });
  if (!intelligence) return null;
  return {
    view: assembleCustomersPageView(intelligence),
    syncedAt: bundle.snapshot.syncedAt,
  };
}
