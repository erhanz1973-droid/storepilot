import { IntegrationHealthDashboardClient } from "@/components/integration-health/IntegrationHealthDashboardClient";
import { buildIntegrationHealthDashboard } from "@/lib/integration-health/build-dashboard";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function IntegrationHealthPage() {
  const dashboard = await buildIntegrationHealthDashboard();

  return (
    <>
      <div className="page-header">
        <h2>Integration Health</h2>
        <p>
          System readiness, data quality, sync status, and AI trust — not business performance.{" "}
          <Link href="/health">Business Health</Link>
          {" · "}
          <Link href="/connections">Connections</Link>
        </p>
      </div>
      <IntegrationHealthDashboardClient initial={dashboard} />
    </>
  );
}
