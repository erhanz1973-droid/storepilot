import { ApprovalDecisionCenter } from "@/components/approvals/ApprovalDecisionCenter";
import { PlaybookApprovalBanner } from "@/components/approvals/PlaybookApprovalBanner";
import { IntegrationIntelligenceGrid } from "@/components/approvals/IntegrationIntelligenceGrid";
import { PlanScaleBanner } from "@/components/billing/PlanScaleBanner";
import { buildApprovalsPageData } from "@/lib/services/approvals";
import Link from "next/link";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const { decisionCenter, disconnectedConnectors } = await buildApprovalsPageData();

  return (
    <>
      <div className="page-header">
        <h2>Approval Center</h2>
        <p>
          Your AI Decision Center — see today&apos;s executive briefing, understand why StorePilot
          recommends each action, and approve with confidence before anything changes.
        </p>
      </div>

      <Suspense fallback={null}>
        <PlaybookApprovalBanner />
      </Suspense>

      {decisionCenter.planUsage && (
        <PlanScaleBanner
          entitlements={decisionCenter.planUsage}
          unlockedCampaignName={decisionCenter.planUsage.unlockedCampaignName}
        />
      )}

      <ApprovalDecisionCenter view={decisionCenter} />

      <IntegrationIntelligenceGrid connectors={disconnectedConnectors} />

      <p className="muted" style={{ marginTop: 20, fontSize: "0.9rem" }}>
        <Link href="/decisions">Decision Engine</Link> · <Link href="/autopilot">Autopilot</Link> ·{" "}
        <Link href="/history">Outcome history</Link>
      </p>
    </>
  );
}
