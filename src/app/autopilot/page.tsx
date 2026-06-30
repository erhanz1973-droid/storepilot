import Link from "next/link";
import { AutopilotHistoryPanel } from "@/components/autopilot/operations/AutopilotHistoryPanel";
import { AutopilotRuleGroups } from "@/components/autopilot/operations/AutopilotRuleGroups";
import { AutopilotSafetyPanel } from "@/components/autopilot/operations/AutopilotSafetyPanel";
import { AutopilotStatusCard } from "@/components/autopilot/operations/AutopilotStatusCard";
import { AutopilotVisionBanner } from "@/components/autopilot/operations/AutopilotVisionBanner";
import { buildAutopilotOperationsView } from "@/lib/autopilot/operations";
import { buildAutopilotIntelligenceDashboard } from "@/lib/services/autopilot";

export const dynamic = "force-dynamic";

export default async function AutopilotPage() {
  const dashboard = await buildAutopilotIntelligenceDashboard();
  const ops = buildAutopilotOperationsView(dashboard);

  return (
    <>
      <div className="page-header">
        <h2>Autopilot</h2>
        <p>
          Your AI Operations Center — see what StorePilot is deciding for you today, then review and
          approve before anything changes in your store or ad accounts.
        </p>
      </div>

      {!ops.connected && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p className="muted" style={{ margin: 0 }}>
            Connect your store and ad platforms to activate monitoring. Rules show as Ready until
            data syncs. <Link href="/connections">Open Connections</Link>
          </p>
        </div>
      )}

      <div className="autopilot-ops-layout">
        <div className="autopilot-ops-main">
          <AutopilotStatusCard status={ops.status} />
          <AutopilotRuleGroups groups={ops.groups} />
        </div>
        <aside className="autopilot-ops-sidebar">
          <AutopilotHistoryPanel history={ops.history} />
          <AutopilotSafetyPanel guarantees={ops.safetyGuarantees} />
          <AutopilotVisionBanner statement={ops.visionStatement} />
        </aside>
      </div>

      <p className="muted" style={{ marginTop: 20, fontSize: "0.9rem" }}>
        <Link href="/decisions">Today&apos;s decisions</Link> ·{" "}
        <Link href="/approvals">Approval Center</Link>
      </p>
    </>
  );
}
