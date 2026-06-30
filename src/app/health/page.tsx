import { BusinessHealthDashboardClient } from "@/components/business-health/BusinessHealthDashboardClient";
import { buildBusinessHealthDashboard } from "@/lib/business-health/build-dashboard";
import { normalizeBusinessHealthDashboard } from "@/lib/business-health/normalize";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const dashboard = normalizeBusinessHealthDashboard(await buildBusinessHealthDashboard());

  return (
    <>
      <div className="page-header">
        <h2>Health</h2>
        <p>
          Daily executive health check — profit, marketing, inventory, customers, and cash flow with
          prioritized actions.{" "}
          <Link href="/">Executive Dashboard</Link>
          {" · "}
          <Link href="/integration-health">Integration Health</Link>
        </p>
      </div>
      <BusinessHealthDashboardClient dashboard={dashboard} />
    </>
  );
}
