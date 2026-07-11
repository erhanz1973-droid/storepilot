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
        <h2>Morning Risk Briefing</h2>
        <p>
          Your daily executive risk check — what could hurt the business most, what to do first, and
          what happens if you wait.{" "}
          <Link href="/ask-ai?q=What+is+my+biggest+risk%3F">Ask AI</Link>
          {" · "}
          <Link href="/">Executive Dashboard</Link>
        </p>
      </div>
      <BusinessHealthDashboardClient dashboard={dashboard} />
    </>
  );
}
