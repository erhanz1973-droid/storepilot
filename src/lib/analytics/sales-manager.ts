import type { ProfitDashboard } from "@/lib/profit/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import { buildSalesManagerV2, type SalesManagerV2 } from "@/lib/analytics/sales-manager-v2";

export type SalesManagerView = {
  v2: SalesManagerV2;
  syncedAt: string;
};

export function buildSalesManagerView(input: {
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
}): SalesManagerView {
  return {
    v2: buildSalesManagerV2(input),
    syncedAt: input.snapshot.syncedAt,
  };
}

export type { SalesManagerV2 } from "@/lib/analytics/sales-manager-v2";
