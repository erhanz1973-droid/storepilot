import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { MerchantBusinessProfile } from "@/lib/business-model/types";
import { buildRecoveryOpportunities } from "@/lib/profit/profit-page-view";
import { buildSalesManagerV2 } from "@/lib/analytics/sales-manager-v2";
import {
  buildUnifiedExecutivePlaybook,
  type DailyAiPlaybook,
  type ExecutiveFocusSummary,
} from "@/lib/analytics/ai-daily-playbook";
import type { StoreHealthScore } from "@/lib/store-health/score";

export function buildExecutiveUnifiedLayer(input: {
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  storeHealth?: StoreHealthScore | null;
  topThreatLabel?: string;
  businessProfile?: MerchantBusinessProfile | null;
}): { dailyPlaybook: DailyAiPlaybook; executiveFocus: ExecutiveFocusSummary } {
  const salesV2 = buildSalesManagerV2({
    snapshot: input.snapshot,
    profitDashboard: input.profitDashboard ?? null,
  });

  const profitRecovery = input.profitDashboard
    ? buildRecoveryOpportunities(input.profitDashboard, input.snapshot)
    : [];

  const { playbook, focus } = buildUnifiedExecutivePlaybook({
    snapshot: input.snapshot,
    profitDashboard: input.profitDashboard,
    revenueStudio: salesV2.revenueStudio,
    salesOpportunities: salesV2.opportunities,
    profitRecovery,
    businessHealthScore: input.storeHealth?.score,
    businessHealthLabel: input.storeHealth?.label,
    topThreatLabel: input.topThreatLabel,
    businessProfile: input.businessProfile,
  });

  return { dailyPlaybook: playbook, executiveFocus: focus };
}
