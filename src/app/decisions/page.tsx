import { BusinessModelSelector } from "@/components/business-model/BusinessModelSelector";
import { BusinessModelHealthCard } from "@/components/business-model/BusinessModelHealthCard";
import { MerchantDnaPanel } from "@/components/merchant-dna/MerchantDnaPanel";
import { DecisionCard } from "@/components/decisions/DecisionCard";
import { MerchantModeSelector } from "@/components/decisions/MerchantModeSelector";
import { ProfitStrategyPanel } from "@/components/decisions/ProfitStrategyPanel";
import { RecommendationValidationBlocker } from "@/components/recommendations/RecommendationEvidencePanel";
import { buildReadOnlyDashboard } from "@/lib/services/dashboard";
import { getCachedStoreBundle } from "@/lib/services/store-bundle";
import { markRecommendationsDisplayed } from "@/lib/recommendations/intelligence/lifecycle";
import { resolveActiveStoreId } from "@/lib/store/context";
import { buildProfitDecisionPlan } from "@/lib/services/profit-decisions";
import { resolveMerchantMode } from "@/lib/store/merchant-mode";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DecisionsPage() {
  const bundle = await getCachedStoreBundle();
  const [dashboard, profitPlan, merchantMode] = await Promise.all([
    buildReadOnlyDashboard(bundle.storeId, bundle.snapshot),
    buildProfitDecisionPlan(),
    resolveMerchantMode(),
  ]);
  const items = (dashboard.decisionCenter ?? []).filter((i) => i.status === "open");

  const openRecIds = items
    .map((i) => i.recommendationId)
    .filter((id): id is string => Boolean(id));
  if (openRecIds.length > 0) {
    const storeId = await resolveActiveStoreId();
    await markRecommendationsDisplayed(storeId, openRecIds);
  }

  return (
    <>
      <div className="page-header">
        <h2>Decisions</h2>
        <p>
          The Decision Engine compares strategies, explains why each action wins, and tracks
          outcomes after approval. Adjust your business mode to change how decisions are ranked.
        </p>
      </div>

      <MerchantModeSelector initialMode={merchantMode} />

      {dashboard.merchantDna && (
        <div style={{ marginBottom: 16 }}>
          <MerchantDnaPanel
            dna={dashboard.merchantDna}
            benchmark={dashboard.merchantBenchmark}
          />
        </div>
      )}

      {dashboard.businessProfile && (
        <div style={{ display: "grid", gap: 16, marginBottom: 16 }}>
          <BusinessModelSelector profile={dashboard.businessProfile} />
          {dashboard.businessModelHealth && dashboard.dashboardWidgets && (
            <BusinessModelHealthCard
              health={dashboard.businessModelHealth}
              widgets={dashboard.dashboardWidgets}
              source={dashboard.businessProfile.businessModelSource}
            />
          )}
        </div>
      )}

      <ProfitStrategyPanel plan={profitPlan} />

      {dashboard.validationGate && (
        <RecommendationValidationBlocker gate={dashboard.validationGate} />
      )}

      {items.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            No open strategy comparisons right now. Pending autopilot actions live on{" "}
            <Link href="/autopilot#pending-actions">Autopilot</Link> and{" "}
            <Link href="/approvals">Approval Center</Link>.
          </p>
        </div>
      ) : (
        <div className="stack">
          {items.map((item) => (
            <DecisionCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <p className="muted" style={{ marginTop: 20, fontSize: "0.9rem" }}>
        <Link href="/approvals">Approval Center</Link> · <Link href="/autopilot">Autopilot rules</Link> ·{" "}
        <Link href="/history">View outcome results</Link>
      </p>
    </>
  );
}
