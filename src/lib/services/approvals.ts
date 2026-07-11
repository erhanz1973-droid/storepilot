import { buildDecisionCenterView } from "@/lib/approvals/decision-center";
import { buildApprovalPresentation } from "@/lib/approvals/presenter";
import { applyPlanToDecisionCenter } from "@/lib/billing/apply-approval-entitlements";
import { resolveAdvertisingEntitlements } from "@/lib/billing/resolve-entitlements-light";
import { getDataSourceStatuses } from "@/lib/connectors/registry";
import { getDisconnectedMarketingConnectors } from "@/lib/connectors/capabilities";
import { buildIntelligenceDashboard } from "@/lib/db/recommendation-intelligence";
import { listRecommendations } from "@/lib/services/dashboard";
import { getCachedStoreBundle } from "@/lib/services/store-bundle";
import { buildStoreStatus } from "@/lib/store-status/build";
import { fingerprintData, getOrCompute } from "@/lib/performance/compute-cache";
import { REFRESH_MS } from "@/lib/performance/refresh-schedules";

export async function buildApprovalsPageData() {
  const bundle = await getCachedStoreBundle();
  const fingerprint = fingerprintData({
    storeId: bundle.storeId,
    syncedAt: bundle.snapshot.syncedAt,
  });

  return getOrCompute(
    `approvals-page:${bundle.storeId}`,
    fingerprint,
    REFRESH_MS.dashboardRead,
    async () => {
      const [items, dataSources, intelligence, { entitlements }] = await Promise.all([
        listRecommendations(),
        getDataSourceStatuses(bundle.storeId),
        buildIntelligenceDashboard(bundle.storeId),
        resolveAdvertisingEntitlements(),
      ]);

      const storeStatus = buildStoreStatus(bundle.snapshot, dataSources);
      const presentation = buildApprovalPresentation(items, {
        campaigns: bundle.snapshot.campaigns,
        storeStatus,
        netMarginPct: bundle.profitDashboard?.primary.profitMarginPct ?? undefined,
      });
      const decisionCenterRaw = buildDecisionCenterView(
        presentation,
        items,
        bundle.profitDashboard,
        {
          dataSources,
          intelligence,
        },
      );
      const decisionCenter = applyPlanToDecisionCenter(decisionCenterRaw, entitlements);
      const disconnectedConnectors = getDisconnectedMarketingConnectors(
        bundle.snapshot.connectorStates ?? {},
      );

      return { decisionCenter, disconnectedConnectors };
    },
  );
}
