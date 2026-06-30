import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { enrichStrategyPlanAsync } from "@/lib/attribution/recommendation-trust";
import type { AttributionDashboard, AttributionModel } from "@/lib/attribution/models";
import { getStoreBusinessGoals } from "@/lib/db/business-goals";
import { getCachedStoreBundle } from "@/lib/services/store-bundle";

export async function buildAttributionIntelligenceDashboard(
  options?: { model?: AttributionModel },
): Promise<AttributionDashboard | null> {
  const bundle = await getCachedStoreBundle();
  const businessGoals = await getStoreBusinessGoals(bundle.storeId);
  const dashboard = buildAttributionDashboard(bundle.snapshot, bundle.profitDashboard, {
    ...options,
    businessGoal: businessGoals.primaryGoal,
  });
  if (!dashboard) return null;

  const enrichedPlan = await enrichStrategyPlanAsync(bundle.storeId, dashboard.strategyPlan);

  return {
    ...dashboard,
    strategyPlan: enrichedPlan,
    attributionOpportunities: dashboard.attributionOpportunities.map((opp) => {
      const action = enrichedPlan.actions.find((a) => a.id === opp.id);
      if (!action) return opp;
      return {
        ...opp,
        evidence: [
          ...opp.evidence,
          { label: "Impact type", value: action.impact.simulationStatus },
          ...(action.impact.observedStatus
            ? [{ label: "Observed", value: action.impact.observedStatus }]
            : []),
        ],
      };
    }),
  };
}
