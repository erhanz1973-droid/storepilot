import { ApprovalDecisionCenter } from "@/components/approvals/ApprovalDecisionCenter";
import { IntegrationIntelligenceGrid } from "@/components/approvals/IntegrationIntelligenceGrid";
import { buildDecisionCenterView } from "@/lib/approvals/decision-center";
import { buildApprovalPresentation } from "@/lib/approvals/presenter";
import { aggregateStoreSnapshot, getDataSourceStatuses } from "@/lib/connectors/registry";
import { getDisconnectedMarketingConnectors } from "@/lib/connectors/capabilities";
import { listProductCosts } from "@/lib/db/product-costs";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { listRecommendations } from "@/lib/services/dashboard";
import { buildStoreStatus } from "@/lib/store-status/build";
import { resolveActiveStoreId } from "@/lib/store/context";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const storeId = await resolveActiveStoreId();
  const items = await listRecommendations();
  const snapshot = await aggregateStoreSnapshot(storeId);
  const dataSources = await getDataSourceStatuses(storeId);
  const storeStatus = buildStoreStatus(snapshot, dataSources);
  const profitDashboard = computeProfitDashboard(snapshot, await listProductCosts(storeId));
  const presentation = buildApprovalPresentation(items, {
    campaigns: snapshot.campaigns,
    storeStatus,
    netMarginPct: profitDashboard?.primary.profitMarginPct ?? undefined,
  });
  const decisionCenter = buildDecisionCenterView(presentation, items, profitDashboard);
  const disconnectedConnectors = getDisconnectedMarketingConnectors(
    snapshot.connectorStates ?? {},
  );

  return (
    <>
      <div className="page-header">
        <h2>Approval Center</h2>
        <p>
          Your AI Decision Center — see today&apos;s executive briefing, understand why StorePilot
          recommends each action, and approve with confidence before anything changes.
        </p>
      </div>

      <ApprovalDecisionCenter view={decisionCenter} />

      <IntegrationIntelligenceGrid connectors={disconnectedConnectors} />

      <p className="muted" style={{ marginTop: 20, fontSize: "0.9rem" }}>
        <Link href="/decisions">Decision Engine</Link> · <Link href="/autopilot">Autopilot</Link> ·{" "}
        <Link href="/history">Outcome history</Link>
      </p>
    </>
  );
}
