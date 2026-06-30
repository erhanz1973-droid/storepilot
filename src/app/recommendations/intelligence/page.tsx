import { RecommendationIntelligenceDashboard } from "@/components/recommendations/RecommendationIntelligenceDashboard";
import { RecommendationTimeline } from "@/components/recommendations/RecommendationTimeline";
import { buildIntelligenceDashboard } from "@/lib/db/recommendation-intelligence";
import { resolveActiveStoreId } from "@/lib/store/context";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RecommendationIntelligencePage() {
  const storeId = await resolveActiveStoreId();
  const dashboard = await buildIntelligenceDashboard(storeId);

  return (
    <>
      <div className="page-header">
        <h2>Recommendation Intelligence</h2>
        <p>
          Measurable AI decisions — approval rates, outcomes, and learning dataset for continuous
          improvement.
        </p>
      </div>

      <RecommendationIntelligenceDashboard dashboard={dashboard} />

      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginTop: 0 }}>Recent Lifecycle Events</h3>
        <RecommendationTimeline events={dashboard.recentTimeline} />
      </div>

      <p className="muted" style={{ marginTop: 20, fontSize: "0.9rem" }}>
        <Link href="/decisions">Open Decisions</Link> · <Link href="/history">Outcome History</Link> ·{" "}
        <Link href="/connections">Run Validation</Link>
      </p>
    </>
  );
}
